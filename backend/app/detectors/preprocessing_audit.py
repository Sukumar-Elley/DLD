import pandas as pd
import numpy as np
from typing import List
from app.detectors.base import BaseDetector
from app.models.schemas import LeakageViolation, LeakageType, SeverityLevel


class PreprocessingAuditDetector(BaseDetector):
    """
    Audits dataset for structural anti-patterns that indicate common
    preprocessing mistakes:

    1. Zero-mean unit-variance features (StandardScaler applied globally)
    2. [0,1]-range features (MinMaxScaler applied globally)
    3. Constant or near-constant features (degenerate after global imputation)
    4. Stratification violations (class imbalance hints at leaky over-sampling)
    5. Integer-encoded categoricals (LabelEncoder applied before split)
    6. Suspiciously round numeric values (binning applied globally)
    """

    def detect(self) -> List[LeakageViolation]:
        violations = []
        numeric_cols = [c for c in self.get_numeric_columns() if c != self.target_column]

        for col in numeric_cols:
            series = self.df[col].dropna()
            if len(series) < 10:
                continue

            mu = float(series.mean())
            sigma = float(series.std())
            col_min = float(series.min())
            col_max = float(series.max())

            # 1. StandardScaler applied globally
            if abs(mu) < 0.01 and 0.98 < sigma < 1.02:
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.PREPROCESSING_AUDIT,
                    affected_feature=col,
                    severity=SeverityLevel.HIGH,
                    severity_score=0.80,
                    detector_name="PreprocessingAudit/StandardScaler",
                    confidence=0.85,
                    description=(
                        f"Feature '{col}' has mean≈0 ({mu:.4f}) and std≈1 ({sigma:.4f}), "
                        f"strongly indicating StandardScaler.fit_transform() was applied to the "
                        f"full dataset before train/test splitting. This contaminates the test "
                        f"set with global mean and std statistics."
                    ),
                    remediation=(
                        f"Replace scaler.fit_transform(df['{col}']) with:\n"
                        f"  scaler.fit(X_train[['{col}']]).transform(X_test[['{col}']])\n"
                        f"Or use sklearn Pipeline to enforce correct ordering automatically."
                    ),
                    statistical_evidence={
                        "mean": round(mu, 6), "std": round(sigma, 6),
                        "anti_pattern": "StandardScaler applied before split"
                    }
                ))

            # 2. MinMaxScaler applied globally
            elif abs(col_min) < 0.001 and abs(col_max - 1.0) < 0.001 and sigma > 0.05:
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.PREPROCESSING_AUDIT,
                    affected_feature=col,
                    severity=SeverityLevel.HIGH,
                    severity_score=0.78,
                    detector_name="PreprocessingAudit/MinMaxScaler",
                    confidence=0.82,
                    description=(
                        f"Feature '{col}' is exactly bounded [0, 1] (min={col_min:.4f}, "
                        f"max={col_max:.4f}), indicating MinMaxScaler was applied to the full "
                        f"dataset before splitting. Test set min/max were used to define the "
                        f"scale, leaking test distribution into training."
                    ),
                    remediation=(
                        f"Use MinMaxScaler fitted only on X_train:\n"
                        f"  scaler = MinMaxScaler()\n"
                        f"  scaler.fit(X_train[['{col}']])\n"
                        f"  X_test[['{col}']] = scaler.transform(X_test[['{col}']])"
                    ),
                    statistical_evidence={
                        "min": round(col_min, 6), "max": round(col_max, 6),
                        "anti_pattern": "MinMaxScaler applied before split"
                    }
                ))

            # 3. Near-constant features (degenerate imputation)
            elif sigma < 1e-5 and col_max != col_min:
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.PREPROCESSING_AUDIT,
                    affected_feature=col,
                    severity=SeverityLevel.MEDIUM,
                    severity_score=0.55,
                    detector_name="PreprocessingAudit/NearConstant",
                    confidence=0.7,
                    description=(
                        f"Feature '{col}' is near-constant (std={sigma:.2e}) despite "
                        f"range [{col_min:.4f}, {col_max:.4f}]. This may indicate global "
                        f"mean/median imputation was applied after splitting, propagating "
                        f"a single imputed value across both sets."
                    ),
                    remediation=(
                        f"Fit imputers (SimpleImputer, KNNImputer) on X_train only. "
                        f"Apply transform to X_test separately."
                    ),
                    statistical_evidence={
                        "std": round(sigma, 8), "min": round(col_min, 4), "max": round(col_max, 4)
                    }
                ))

            # 4. Suspiciously round values (global binning)
            round_ratio = self._compute_round_ratio(series)
            if round_ratio > 0.95 and series.nunique() < 20 and sigma > 0:
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.PREPROCESSING_AUDIT,
                    affected_feature=col,
                    severity=SeverityLevel.LOW,
                    severity_score=0.35,
                    detector_name="PreprocessingAudit/GlobalBinning",
                    confidence=0.6,
                    description=(
                        f"{round_ratio*100:.1f}% of values in '{col}' are exact integers "
                        f"with only {series.nunique()} unique values. This pattern suggests "
                        f"binning or discretization was applied globally, potentially using "
                        f"test set quantiles to define bin edges."
                    ),
                    remediation=(
                        f"Compute quantile/bin edges on X_train only. Apply the same "
                        f"edges to X_test using pandas.cut(X_test['{col}'], bins=train_bins)."
                    ),
                    statistical_evidence={
                        "round_ratio": round(round_ratio, 4),
                        "unique_values": int(series.nunique()),
                    }
                ))

        # 5. Label-encoded categoricals with suspicious integer patterns
        for col in self.get_categorical_columns():
            if col == self.target_column:
                continue
            v = self._check_integer_encoded_categorical(col)
            if v:
                violations.append(v)

        # 6. Class imbalance + over-sampling detection
        if self.target_column and self.target_column in self.df.columns:
            v = self._check_oversampling_leakage()
            if v:
                violations.append(v)

        return violations

    def _compute_round_ratio(self, series: pd.Series) -> float:
        try:
            return float((series == series.round()).mean())
        except Exception:
            return 0.0

    def _check_integer_encoded_categorical(self, col: str) -> LeakageViolation:
        """Detect object columns that look like they've been label-encoded."""
        try:
            series = self.df[col].dropna()
            numeric_strings = pd.to_numeric(series, errors='coerce')
            if numeric_strings.notna().mean() > 0.95:
                vals = numeric_strings.dropna()
                if vals.nunique() < 30 and (vals == vals.astype(int)).all():
                    return LeakageViolation(
                        leakage_type=LeakageType.PREPROCESSING_AUDIT,
                        affected_feature=col,
                        severity=SeverityLevel.MEDIUM,
                        severity_score=0.52,
                        detector_name="PreprocessingAudit/LabelEncoded",
                        confidence=0.65,
                        description=(
                            f"Column '{col}' is stored as string/object but contains "
                            f"only integer-like values ({vals.nunique()} unique). "
                            f"This suggests LabelEncoder was applied globally before splitting, "
                            f"potentially leaking category frequencies into the test set."
                        ),
                        remediation=(
                            f"Apply LabelEncoder or OrdinalEncoder inside a Pipeline fitted "
                            f"only on X_train. Use handle_unknown='use_encoded_value' to handle "
                            f"unseen categories in test data."
                        ),
                        statistical_evidence={
                            "unique_integer_values": int(vals.nunique()),
                            "dtype": str(self.df[col].dtype)
                        }
                    )
        except Exception:
            pass
        return None

    def _check_oversampling_leakage(self) -> LeakageViolation:
        """
        Detect if SMOTE or similar oversampling was applied before splitting.
        Signs: perfectly integer row counts per class OR suspicious class ratios.
        """
        try:
            target = self.df[self.target_column]
            counts = target.value_counts()
            if len(counts) < 2:
                return None

            # Perfect balance after over-sampling
            max_c, min_c = counts.max(), counts.min()
            balance_ratio = min_c / max_c if max_c > 0 else 0

            if balance_ratio > 0.98 and len(counts) >= 2:
                return LeakageViolation(
                    leakage_type=LeakageType.PREPROCESSING_AUDIT,
                    affected_feature=self.target_column,
                    severity=SeverityLevel.HIGH,
                    severity_score=0.75,
                    detector_name="PreprocessingAudit/OverSampling",
                    confidence=0.8,
                    description=(
                        f"Target column '{self.target_column}' has perfectly balanced classes "
                        f"(ratio={balance_ratio:.4f}). This strongly suggests SMOTE or another "
                        f"oversampling technique was applied BEFORE train-test splitting, causing "
                        f"synthetic samples from training to appear in the test set."
                    ),
                    remediation=(
                        f"Apply SMOTE ONLY on X_train after splitting:\n"
                        f"  from imblearn.over_sampling import SMOTE\n"
                        f"  X_res, y_res = SMOTE().fit_resample(X_train, y_train)\n"
                        f"Never resample on the full dataset."
                    ),
                    statistical_evidence={
                        "class_counts": {str(k): int(v) for k, v in counts.items()},
                        "balance_ratio": round(float(balance_ratio), 4),
                    }
                )
        except Exception:
            pass
        return None
