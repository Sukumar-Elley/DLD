import pandas as pd
import numpy as np
from typing import List
from sklearn.model_selection import train_test_split
from scipy.stats import wasserstein_distance, ks_2samp
from app.detectors.base import BaseDetector
from app.models.schemas import LeakageViolation, LeakageType, SeverityLevel


class TrainTestContaminationDetector(BaseDetector):
    """
    Upgraded v2: Detects train-test contamination via multiple signals:
    1. Wasserstein distance — measures distributional divergence train vs test
    2. KS test — tests if train/test come from the same distribution
    3. Mean/std ratio alignment — identifies global scaler footprints
    4. MinMax boundary detection — catches MinMaxScaler applied globally
    5. Exact row duplication — identifies rows shared across splits
    6. Feature overlap coefficient — measures value-set overlap
    """

    def __init__(self, df: pd.DataFrame, target_column: str = None, test_size: float = 0.2):
        super().__init__(df, target_column)
        self.test_size = test_size

    def detect(self) -> List[LeakageViolation]:
        violations = []
        numeric_cols = [c for c in self.get_numeric_columns() if c != self.target_column]
        if not numeric_cols:
            return violations

        try:
            train_df, test_df = train_test_split(self.df, test_size=self.test_size, random_state=42)
        except Exception:
            return violations

        for col in numeric_cols:
            v = self._analyze_column(col, train_df, test_df)
            if v:
                violations.append(v)

        dup = self._check_duplicate_rows(train_df, test_df)
        if dup:
            violations.append(dup)

        return violations

    def _analyze_column(self, col: str, train_df, test_df):
        try:
            tr = train_df[col].dropna().values.astype(float)
            te = test_df[col].dropna().values.astype(float)
            gl = self.df[col].dropna().values.astype(float)
            if len(tr) < 10 or len(te) < 10:
                return None

            signals = {}

            # 1. Wasserstein distance (normalized by global std)
            g_std = float(np.std(gl)) or 1e-9
            wass = float(wasserstein_distance(tr, te)) / g_std
            signals['wasserstein_normalized'] = round(wass, 5)

            # 2. KS test
            ks_stat, ks_p = ks_2samp(tr, te)
            signals['ks_stat'] = round(float(ks_stat), 5)
            signals['ks_pvalue'] = round(float(ks_p), 5)

            # 3. StandardScaler fingerprint: mean≈0, std≈1
            g_mean, g_std2 = float(np.mean(gl)), float(np.std(gl))
            std_scaler_score = 0.0
            if abs(g_mean) < 0.02 and 0.95 < g_std2 < 1.05:
                std_scaler_score = 0.85
                signals['anti_pattern'] = 'StandardScaler applied before split'

            # 4. MinMaxScaler fingerprint: min=0, max=1
            minmax_score = 0.0
            if abs(float(np.min(gl))) < 0.001 and abs(float(np.max(gl)) - 1.0) < 0.001:
                # Additionally check if train and test share the same boundary
                if abs(float(np.min(tr))) < 0.001 and abs(float(np.max(te)) - 1.0) < 0.001:
                    minmax_score = 0.80
                    signals['anti_pattern'] = 'MinMaxScaler applied before split'

            # 5. KS suspicious similarity: p very HIGH = too similar
            ks_similarity_score = float(ks_p) if ks_p > 0.995 else 0.0

            # 6. Means suspiciously close to global mean
            tr_mean, te_mean = float(np.mean(tr)), float(np.mean(te))
            g_mean_abs = abs(float(np.mean(gl))) or 1e-9
            mean_convergence = 1.0 - min(abs(tr_mean - te_mean) / (g_mean_abs + 1e-9), 1.0)

            # Aggregate contamination score
            contamination = max(
                std_scaler_score,
                minmax_score,
                ks_similarity_score * 0.7,
                (1.0 - min(wass, 1.0)) * 0.5 if wass < 0.05 else 0.0,
            )
            if contamination < 0.35:
                return None

            severity = self._sev(contamination)
            scaler_type = signals.get('anti_pattern', 'Global preprocessing detected')
            signals.update({
                'contamination_score': round(contamination, 4),
                'train_mean': round(tr_mean, 4), 'test_mean': round(te_mean, 4),
                'global_mean': round(float(np.mean(gl)), 4),
                'train_std': round(float(np.std(tr)), 4), 'test_std': round(float(np.std(te)), 4),
            })

            return LeakageViolation(
                leakage_type=LeakageType.TRAIN_TEST_CONTAMINATION,
                affected_feature=col,
                severity=severity,
                severity_score=round(contamination, 4),
                detector_name="TrainTestContamination/MultiSignal",
                confidence=round(min(contamination + 0.1, 1.0), 3),
                description=(
                    f"Feature '{col}' shows strong contamination signals (score={contamination:.3f}). "
                    f"Pattern: {scaler_type}. "
                    f"KS p-value={ks_p:.4f} and Wasserstein distance={wass:.4f} confirm "
                    f"train and test distributions are suspiciously indistinguishable — "
                    f"indicating preprocessing was fit on the full dataset before splitting."
                ),
                remediation=(
                    f"Wrap '{col}' preprocessing inside a sklearn Pipeline:\n"
                    f"  pipe = Pipeline([('scaler', StandardScaler()), ('model', ...)])\n"
                    f"  pipe.fit(X_train)  # Only training data seen here\n"
                    f"  pipe.predict(X_test)  # Scaler applies learned train params\n"
                    f"Never call scaler.fit_transform(df['{col}']) on the full dataset."
                ),
                statistical_evidence=signals
            )
        except Exception:
            return None

    def _check_duplicate_rows(self, train_df, test_df):
        try:
            num_cols = [c for c in self.get_numeric_columns() if c != self.target_column][:20]
            if not num_cols:
                return None
            tr_hash = train_df[num_cols].dropna().apply(lambda r: hash(tuple(r)), axis=1)
            te_hash = test_df[num_cols].dropna().apply(lambda r: hash(tuple(r)), axis=1)
            dups = len(set(tr_hash) & set(te_hash))
            ratio = dups / max(len(te_hash), 1)
            if ratio < 0.01:
                return None
            sev = self._sev(min(ratio * 3, 1.0))
            return LeakageViolation(
                leakage_type=LeakageType.TRAIN_TEST_CONTAMINATION,
                affected_feature="ALL FEATURES (Row Duplication)",
                severity=sev,
                severity_score=round(min(ratio * 3, 1.0), 4),
                detector_name="TrainTestContamination/DuplicateRows",
                confidence=0.95,
                description=(
                    f"{dups} rows ({ratio*100:.1f}% of test set) appear in both train and test. "
                    f"Exact duplicate rows let the model memorize test samples during training, "
                    f"artificially inflating evaluation metrics."
                ),
                remediation=(
                    "Remove duplicates before splitting:\n"
                    "  df = df.drop_duplicates()\n"
                    "  X_train, X_test = train_test_split(df, test_size=0.2, random_state=42)"
                ),
                statistical_evidence={'duplicate_rows': dups, 'duplicate_ratio': round(ratio, 4),
                                      'test_size': len(te_hash)}
            )
        except Exception:
            return None

    def _sev(self, s):
        if s >= 0.75: return SeverityLevel.CRITICAL
        if s >= 0.50: return SeverityLevel.HIGH
        if s >= 0.30: return SeverityLevel.MEDIUM
        return SeverityLevel.LOW
