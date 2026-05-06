import pandas as pd
import numpy as np
from typing import List
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from scipy.stats import pointbiserialr, pearsonr, f_oneway
from app.detectors.base import BaseDetector
from app.models.schemas import LeakageViolation, LeakageType, SeverityLevel


class TargetLeakageDetector(BaseDetector):
    """
    Upgraded v2: Multi-signal target leakage detection:
    1. Mutual Information (classif / regression)
    2. Pearson / point-biserial correlation
    3. ANOVA F-test for categorical features vs continuous target
    4. Random Forest importance — model-based leakage signal
    5. Keyword heuristics — name-pattern matching
    6. High-cardinality ID column detection
    7. Perfect-predictor check — features that perfectly split all target classes
    """

    LEAKY_KEYWORDS = [
        "target", "label", "outcome", "result", "output", "prediction",
        "churn", "fraud", "default", "approved", "rejected",
        "final", "actual", "true", "class", "category",
        "is_fraud", "is_default", "has_", "was_", "did_"
    ]

    def __init__(self, df: pd.DataFrame, target_column: str):
        super().__init__(df, target_column)

    def detect(self) -> List[LeakageViolation]:
        if not self.target_column or self.target_column not in self.df.columns:
            return []

        target = self.df[self.target_column].dropna()
        is_clf = self._is_classification(target)
        feature_cols = self.get_non_target_columns()
        violations = []

        # RF importance (model-level signal) — run once on all features
        rf_importance = self._compute_rf_importance(feature_cols, target, is_clf)

        for col in feature_cols:
            stat_score = self._compute_statistical_score(col, target, is_clf)
            rf_score   = rf_importance.get(col, 0.0)
            perfect    = self._is_perfect_predictor(col, target)

            # Fuse scores
            fused = max(stat_score, rf_score * 1.2, 1.0 if perfect else 0.0)
            fused = min(fused, 1.0)

            if fused > 0.50:
                sev = self._sev(fused)
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.TARGET_LEAKAGE,
                    affected_feature=col,
                    severity=sev,
                    severity_score=round(fused, 4),
                    detector_name="TargetLeakage/MultiSignal",
                    confidence=round(min(fused + 0.05, 1.0), 3),
                    description=(
                        f"Feature '{col}' has a fused leakage score of {fused:.3f} "
                        f"(statistical={stat_score:.3f}, RF-importance={rf_score:.3f}, "
                        f"perfect-predictor={perfect}). "
                        f"This strongly indicates '{col}' encodes information about "
                        f"'{self.target_column}' that would not be available at prediction time."
                    ),
                    remediation=(
                        f"1. Verify that '{col}' is measured BEFORE the prediction event occurs.\n"
                        f"2. If '{col}' is derived from '{self.target_column}', remove it.\n"
                        f"3. Use temporal validation to confirm causal ordering.\n"
                        f"4. Re-run the model without '{col}' and compare accuracy — "
                        f"a large drop confirms legitimate leakage."
                    ),
                    statistical_evidence={
                        'fused_score': round(fused, 4),
                        'statistical_score': round(stat_score, 4),
                        'rf_importance': round(rf_score, 4),
                        'perfect_predictor': perfect,
                        'dtype': str(self.df[col].dtype),
                        'unique_values': int(self.df[col].nunique()),
                        'null_ratio': round(float(self.df[col].isnull().mean()), 4),
                    }
                ))

        # Keyword heuristics (always add, but deduplicate)
        existing = {v.affected_feature for v in violations}
        for v in self._check_keywords(feature_cols):
            if v.affected_feature not in existing:
                violations.append(v)
                existing.add(v.affected_feature)

        # ID columns
        for v in self._check_id_columns(feature_cols, target, is_clf):
            if v.affected_feature not in existing:
                violations.append(v)

        return violations

    def _compute_statistical_score(self, col: str, target: pd.Series, is_clf: bool) -> float:
        try:
            series = self.df[col].copy()
            valid = series.notna() & target.notna()
            series, tgt = series[valid], target[valid]
            if len(series) < 10:
                return 0.0

            enc_series = series.copy()
            if series.dtype == 'object':
                enc_series = pd.Series(LabelEncoder().fit_transform(series.astype(str)))

            if is_clf:
                tgt_enc = LabelEncoder().fit_transform(tgt.astype(str))
                mi = mutual_info_classif(enc_series.values.reshape(-1, 1), tgt_enc, random_state=42)[0]
                mi_norm = min(mi / 1.5, 1.0)
                if tgt.nunique() == 2:
                    corr = abs(pointbiserialr(enc_series.values, tgt_enc)[0])
                else:
                    # ANOVA F-test across target classes
                    groups = [enc_series[tgt == cls].values for cls in tgt.unique() if len(enc_series[tgt==cls]) >= 3]
                    if len(groups) >= 2:
                        f, p = f_oneway(*groups)
                        corr = min(1.0 - p, 1.0) if not np.isnan(p) else 0.0
                    else:
                        corr = 0.0
            else:
                tgt_float = pd.to_numeric(tgt, errors='coerce').dropna()
                enc_aligned = enc_series[tgt_float.index]
                mi = mutual_info_regression(enc_aligned.values.reshape(-1, 1), tgt_float.values, random_state=42)[0]
                mi_norm = min(mi / 1.5, 1.0)
                corr = abs(pearsonr(enc_aligned.values, tgt_float.values)[0]) if len(enc_aligned) > 3 else 0.0

            return float(0.55 * mi_norm + 0.45 * corr)
        except Exception:
            return 0.0

    def _compute_rf_importance(self, cols: List[str], target: pd.Series, is_clf: bool) -> dict:
        try:
            df_enc = self.df[cols].copy()
            for c in df_enc.select_dtypes(include='object').columns:
                df_enc[c] = LabelEncoder().fit_transform(df_enc[c].astype(str))
            df_enc = df_enc.fillna(df_enc.median(numeric_only=True))

            valid = target.notna()
            X = df_enc[valid].values[:2000]  # cap for speed
            y = target[valid].values[:2000]

            if is_clf:
                y = LabelEncoder().fit_transform(y.astype(str))
                model = RandomForestClassifier(n_estimators=30, max_depth=4, random_state=42, n_jobs=-1)
            else:
                y = pd.to_numeric(pd.Series(y), errors='coerce').fillna(0).values
                model = RandomForestRegressor(n_estimators=30, max_depth=4, random_state=42, n_jobs=-1)

            model.fit(X, y)
            importances = model.feature_importances_
            # Normalize to [0,1]
            max_imp = importances.max() or 1e-9
            return {col: float(importances[i] / max_imp) for i, col in enumerate(cols)}
        except Exception:
            return {}

    def _is_perfect_predictor(self, col: str, target: pd.Series) -> bool:
        try:
            if target.nunique() < 2 or target.nunique() > 20:
                return False
            combined = pd.DataFrame({'f': self.df[col], 't': target}).dropna()
            if len(combined) < 10:
                return False
            # Check if feature values perfectly partition target classes
            for val in combined['f'].unique()[:20]:
                subset_target = combined[combined['f'] == val]['t']
                if subset_target.nunique() == 1:
                    all_same = all(
                        combined[combined['f'] == v]['t'].nunique() == 1
                        for v in combined['f'].unique()[:20]
                    )
                    return all_same
            return False
        except Exception:
            return False

    def _check_keywords(self, cols: List[str]) -> List[LeakageViolation]:
        violations = []
        for col in cols:
            matched = [kw for kw in self.LEAKY_KEYWORDS if kw in col.lower()]
            if matched:
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.TARGET_LEAKAGE,
                    affected_feature=col,
                    severity=SeverityLevel.MEDIUM,
                    severity_score=0.55,
                    detector_name="TargetLeakage/Keyword",
                    confidence=0.6,
                    description=(
                        f"Feature '{col}' matches leakage-associated keyword(s): {matched}. "
                        f"Column names containing these terms often indicate post-outcome measurements."
                    ),
                    remediation=(
                        f"Confirm '{col}' represents information available before the prediction event. "
                        f"Domain review recommended."
                    ),
                    statistical_evidence={'matched_keywords': matched}
                ))
        return violations

    def _check_id_columns(self, cols, target, is_clf) -> List[LeakageViolation]:
        violations = []
        for col in cols:
            uid_ratio = self.df[col].nunique() / max(len(self.df), 1)
            if uid_ratio > 0.90:
                score = self._compute_statistical_score(col, target, is_clf)
                if score > 0.35:
                    violations.append(LeakageViolation(
                        leakage_type=LeakageType.TARGET_LEAKAGE,
                        affected_feature=col,
                        severity=SeverityLevel.HIGH,
                        severity_score=0.72,
                        detector_name="TargetLeakage/IDColumn",
                        confidence=0.75,
                        description=(
                            f"Column '{col}' has {uid_ratio*100:.1f}% unique values (ID-like) "
                            f"but correlates with the target (score={score:.3f}). "
                            f"ID-based leakage occurs when row IDs implicitly encode group outcomes."
                        ),
                        remediation=(
                            f"Remove '{col}' from features — ID columns must never be predictors. "
                            f"If this is a foreign key, check whether it encodes group-level outcomes "
                            f"that should be excluded."
                        ),
                        statistical_evidence={'unique_ratio': round(uid_ratio, 4), 'stat_score': round(score, 4)}
                    ))
        return violations

    def _is_classification(self, target: pd.Series) -> bool:
        return target.dtype == 'object' or target.nunique() <= 20

    def _sev(self, s):
        if s >= 0.85: return SeverityLevel.CRITICAL
        if s >= 0.70: return SeverityLevel.HIGH
        if s >= 0.50: return SeverityLevel.MEDIUM
        return SeverityLevel.LOW
