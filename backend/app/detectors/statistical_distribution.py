import pandas as pd
import numpy as np
from typing import List
from scipy.stats import ks_2samp, chi2_contingency, mannwhitneyu
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from app.detectors.base import BaseDetector
from app.models.schemas import LeakageViolation, LeakageType, SeverityLevel


class StatisticalDistributionDetector(BaseDetector):
    """
    Advanced detector: uses KS test, chi-square, and Mann-Whitney U
    to detect distributional similarity between train and test splits
    that suggests preprocessing was applied globally (contamination).

    Also detects features whose distributions are suspiciously identical
    to the target — indicating direct statistical leakage.
    """

    def __init__(self, df: pd.DataFrame, target_column: str = None, test_size: float = 0.2):
        super().__init__(df, target_column)
        self.test_size = test_size

    def detect(self) -> List[LeakageViolation]:
        violations = []
        try:
            train_df, test_df = train_test_split(self.df, test_size=self.test_size, random_state=42)
        except Exception:
            return violations

        numeric_cols = [c for c in self.get_numeric_columns() if c != self.target_column]
        cat_cols = [c for c in self.get_categorical_columns() if c != self.target_column]

        # 1. KS test: numeric features suspiciously similar between train/test
        for col in numeric_cols:
            v = self._ks_contamination_check(col, train_df, test_df)
            if v:
                violations.append(v)

        # 2. Chi-square: categorical feature distributions
        for col in cat_cols:
            v = self._chi2_contamination_check(col, train_df, test_df)
            if v:
                violations.append(v)

        # 3. Target distribution leakage: feature mirrors target distribution
        if self.target_column and self.target_column in self.df.columns:
            for col in numeric_cols[:30]:  # cap for performance
                v = self._target_distribution_leakage(col)
                if v:
                    violations.append(v)

        return violations

    def _ks_contamination_check(self, col: str, train_df, test_df) -> LeakageViolation:
        """
        KS test: if train and test come from exactly the same distribution
        (p-value very HIGH, statistic very LOW), suspect global preprocessing.
        """
        try:
            t = train_df[col].dropna().values
            s = test_df[col].dropna().values
            if len(t) < 10 or len(s) < 10:
                return None

            stat, pval = ks_2samp(t, s)

            # Suspicious: distributions are TOO similar (stat < 0.03 AND pval > 0.99)
            # suggests they were scaled/normalized using the same global parameters
            if stat < 0.03 and pval > 0.99:
                severity_score = 1.0 - stat  # closer to 1 = more suspicious
                severity = self._score(severity_score)
                return LeakageViolation(
                    leakage_type=LeakageType.STATISTICAL_DISTRIBUTION,
                    affected_feature=col,
                    severity=severity,
                    severity_score=round(severity_score, 4),
                    detector_name="StatisticalDistribution/KS",
                    confidence=round(pval, 4),
                    description=(
                        f"KS test reveals train and test distributions of '{col}' are "
                        f"statistically indistinguishable (KS={stat:.4f}, p={pval:.4f}). "
                        f"This extreme similarity suggests global normalization/scaling was "
                        f"applied before splitting, contaminating the test set with training statistics."
                    ),
                    remediation=(
                        f"Fit all scalers (StandardScaler, MinMaxScaler, etc.) exclusively on "
                        f"X_train, then call .transform() on X_test. Use sklearn Pipeline to "
                        f"enforce this automatically. Never call .fit_transform() on the full dataset."
                    ),
                    statistical_evidence={
                        "ks_statistic": round(float(stat), 6),
                        "p_value": round(float(pval), 6),
                        "train_mean": round(float(np.mean(t)), 4),
                        "test_mean": round(float(np.mean(s)), 4),
                        "train_std": round(float(np.std(t)), 4),
                        "test_std": round(float(np.std(s)), 4),
                        "interpretation": "p > 0.99 indicates distributions are suspiciously identical"
                    }
                )
        except Exception:
            pass
        return None

    def _chi2_contamination_check(self, col: str, train_df, test_df) -> LeakageViolation:
        """
        Chi-square test on categorical frequencies across train/test.
        If distributions are identical, encoding may have been fitted globally.
        """
        try:
            train_counts = train_df[col].value_counts()
            test_counts = test_df[col].value_counts()
            common = train_counts.index.intersection(test_counts.index)
            if len(common) < 2:
                return None

            observed = np.array([train_counts[common].values, test_counts[common].values])
            chi2, pval, dof, _ = chi2_contingency(observed)

            # Suspicious: p-value very high (distributions match perfectly)
            if pval > 0.999 and len(common) >= 3:
                severity_score = min(pval, 0.9999)
                return LeakageViolation(
                    leakage_type=LeakageType.STATISTICAL_DISTRIBUTION,
                    affected_feature=col,
                    severity=SeverityLevel.MEDIUM,
                    severity_score=0.55,
                    detector_name="StatisticalDistribution/Chi2",
                    confidence=round(float(pval), 4),
                    description=(
                        f"Chi-square test on categorical feature '{col}' shows perfectly "
                        f"matching distributions across train/test splits (chi2={chi2:.4f}, "
                        f"p={pval:.6f}). This may indicate label encoding was applied before "
                        f"splitting, propagating global category frequencies into the test set."
                    ),
                    remediation=(
                        f"Apply LabelEncoder or OrdinalEncoder within a Pipeline fitted only "
                        f"on training data. Use handle_unknown='ignore' for unseen categories."
                    ),
                    statistical_evidence={
                        "chi2_statistic": round(float(chi2), 4),
                        "p_value": round(float(pval), 6),
                        "degrees_of_freedom": int(dof),
                        "common_categories": int(len(common)),
                    }
                )
        except Exception:
            pass
        return None

    def _target_distribution_leakage(self, col: str) -> LeakageViolation:
        """
        Detects features whose cumulative distribution mirrors the target's —
        a sign that the feature may have been derived or transformed using target info.
        """
        try:
            if self.target_column not in self.df.columns:
                return None
            target = self.df[self.target_column].dropna()
            feature = self.df[col].dropna()

            if len(target) < 20 or target.nunique() > 20:
                return None  # regression target, skip

            # Mann-Whitney between feature and each class of target
            classes = target.unique()
            if len(classes) != 2:
                return None

            mask_a = self.df[self.target_column] == classes[0]
            mask_b = self.df[self.target_column] == classes[1]
            group_a = self.df.loc[mask_a, col].dropna()
            group_b = self.df.loc[mask_b, col].dropna()

            if len(group_a) < 5 or len(group_b) < 5:
                return None

            stat, pval = mannwhitneyu(group_a, group_b, alternative='two-sided')
            # Perfect separation → extremely low p-value → possible leakage
            if pval < 1e-10:
                effect = 1.0 - pval if pval > 0 else 1.0
                return LeakageViolation(
                    leakage_type=LeakageType.STATISTICAL_DISTRIBUTION,
                    affected_feature=col,
                    severity=SeverityLevel.HIGH,
                    severity_score=0.78,
                    detector_name="StatisticalDistribution/MannWhitney",
                    confidence=0.85,
                    description=(
                        f"Mann-Whitney U test shows feature '{col}' perfectly separates "
                        f"target classes '{classes[0]}' vs '{classes[1]}' (p={pval:.2e}). "
                        f"This extreme separability suggests '{col}' encodes target information "
                        f"and should not be used as a training feature."
                    ),
                    remediation=(
                        f"Investigate whether '{col}' is computed from or correlated with the "
                        f"target post-hoc. Remove it from the feature set if it would not be "
                        f"available at prediction time."
                    ),
                    statistical_evidence={
                        "mann_whitney_stat": round(float(stat), 4),
                        "p_value": float(pval),
                        "class_a_mean": round(float(group_a.mean()), 4),
                        "class_b_mean": round(float(group_b.mean()), 4),
                        "class_separation_ratio": round(float(abs(group_a.mean() - group_b.mean()) / (group_a.std() + 1e-9)), 4),
                    }
                )
        except Exception:
            pass
        return None

    def _score(self, s: float) -> SeverityLevel:
        if s >= 0.9: return SeverityLevel.CRITICAL
        if s >= 0.7: return SeverityLevel.HIGH
        if s >= 0.5: return SeverityLevel.MEDIUM
        return SeverityLevel.LOW
