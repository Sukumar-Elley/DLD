# pyre-ignore-all-errors
import pandas as pd
import numpy as np
from typing import List, Tuple, Optional
from sklearn.preprocessing import LabelEncoder
from app.detectors.base import BaseDetector
from app.models.schemas import LeakageViolation, LeakageType, SeverityLevel, CorrelationEntry


class FeatureCorrelationDetector(BaseDetector):
    """
    Detects leakage arising from feature inter-correlations:

    1. Proxy Feature Leakage — a feature is a near-linear transformation
       of the target (e.g., a bucketed version, a rounded version).
    2. Surrogate Feature Leakage — two features are so highly correlated
       that one encodes the other's leakage indirectly.
    3. Feature-Target Near-Identity — computed correlation matrix between
       all numeric features and target; flags perfect or near-perfect correlates.
    4. Redundant Feature Clusters — groups of features with pairwise
       correlation > threshold that collectively inflate leakage risk.
    """

    def __init__(self, df: pd.DataFrame, target_column: Optional[str] = None,
                 correlation_threshold: float = 0.95):
        super().__init__(df, target_column)
        self.threshold = correlation_threshold
        self._top_correlations: List[CorrelationEntry] = []

    def detect(self) -> List[LeakageViolation]:
        violations = []
        numeric_cols = [c for c in self.get_numeric_columns() if c != self.target_column]

        if len(numeric_cols) < 2:
            return violations

        # Build correlation matrix
        try:
            corr_matrix = self.df[numeric_cols].corr(method='pearson').abs()
        except Exception:
            return violations

        # Capture top correlations for report
        self._top_correlations = self._extract_top_pairs(corr_matrix, numeric_cols)

        # 1. Near-identical feature pairs (surrogate leakage)
        surrogate_violations = self._detect_surrogate_pairs(corr_matrix, numeric_cols)
        violations.extend(surrogate_violations)

        # 2. Feature-to-target near-identity
        if self.target_column and self.target_column in self.df.columns:
            target_violations = self._detect_target_proxies(numeric_cols)
            violations.extend(target_violations)

        # 3. Feature cluster redundancy
        cluster_violations = self._detect_correlated_clusters(corr_matrix, numeric_cols)
        violations.extend(cluster_violations)

        return violations

    def get_top_correlations(self) -> List[CorrelationEntry]:
        return self._top_correlations

    def _extract_top_pairs(self, corr_matrix, cols, top_n=20) -> List[CorrelationEntry]:
        pairs = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                r = corr_matrix.iloc[i, j]
                if not np.isnan(r):
                    pairs.append(CorrelationEntry(
                        feature_a=cols[i],
                        feature_b=cols[j],
                        correlation=round(float(r), 4),
                        is_suspicious=r >= 0.9
                    ))
        return sorted(pairs, key=lambda x: abs(x.correlation), reverse=True)[:top_n]

    def _detect_surrogate_pairs(self, corr_matrix, cols) -> List[LeakageViolation]:
        violations = []
        seen = set()
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                r = corr_matrix.iloc[i, j]
                if r >= self.threshold:
                    key = tuple(sorted([cols[i], cols[j]]))
                    if key in seen:
                        continue
                    seen.add(key)
                    severity = SeverityLevel.CRITICAL if r >= 0.99 else SeverityLevel.HIGH
                    violations.append(LeakageViolation(
                        leakage_type=LeakageType.FEATURE_CORRELATION,
                        affected_feature=f"{cols[i]} ↔ {cols[j]}",
                        severity=severity,
                        severity_score=round(float(r), 4),
                        detector_name="FeatureCorrelation/Surrogate",
                        confidence=round(float(r), 4),
                        description=(
                            f"Features '{cols[i]}' and '{cols[j]}' are near-perfectly "
                            f"correlated (r={r:.4f}). One may be a surrogate or transformation "
                            f"of the other. If either is derived from or correlated with the "
                            f"target, the other inherits that leakage indirectly."
                        ),
                        remediation=(
                            f"Remove one of the two features. If both are legitimately independent, "
                            f"verify neither encodes target information. Use VIF (Variance Inflation "
                            f"Factor) analysis to identify and remove redundant predictors."
                        ),
                        statistical_evidence={
                            "pearson_correlation": round(float(r), 6),
                            "feature_a": cols[i],
                            "feature_b": cols[j],
                            "threshold": self.threshold
                        }
                    ))
        return violations

    def _detect_target_proxies(self, numeric_cols) -> List[LeakageViolation]:
        """Detect features that are near-perfect proxies of the numeric target."""
        violations = []
        target = self.df[self.target_column]
        if target.dtype not in ['int64', 'float64', 'int32', 'float32']:
            try:
                target = pd.to_numeric(target, errors='coerce')
            except Exception:
                return violations

        target = target.dropna()
        for col in numeric_cols:
            try:
                feat = self.df[col].dropna()
                common_idx = target.index.intersection(feat.index)
                if len(common_idx) < 10:
                    continue
                r = abs(np.corrcoef(feat[common_idx].values, target[common_idx].values)[0, 1])
                if np.isnan(r):
                    continue
                if r >= 0.95:
                    severity = SeverityLevel.CRITICAL if r >= 0.99 else SeverityLevel.HIGH
                    violations.append(LeakageViolation(
                        leakage_type=LeakageType.FEATURE_CORRELATION,
                        affected_feature=col,
                        severity=severity,
                        severity_score=round(float(r), 4),
                        detector_name="FeatureCorrelation/TargetProxy",
                        confidence=round(float(r), 4),
                        description=(
                            f"Feature '{col}' is nearly perfectly correlated with the target "
                            f"'{self.target_column}' (r={r:.4f}). This strongly suggests '{col}' "
                            f"is a direct proxy, transformation, or post-hoc derivation of the "
                            f"target variable — constituting severe target leakage."
                        ),
                        remediation=(
                            f"Remove '{col}' from the feature set immediately. Investigate its "
                            f"data lineage to determine if it was computed from '{self.target_column}'. "
                            f"Common causes: bucketed targets, scaled targets, lagged targets."
                        ),
                        statistical_evidence={
                            "target_correlation": round(float(r), 6),
                            "target_column": self.target_column,
                        }
                    ))
            except Exception:
                continue
        return violations

    def _detect_correlated_clusters(self, corr_matrix, cols) -> List[LeakageViolation]:
        """Flag clusters of 3+ highly inter-correlated features."""
        violations = []
        threshold = 0.85
        adjacency = (corr_matrix >= threshold).values.copy()
        np.fill_diagonal(adjacency, False)
        visited = set()

        for i in range(len(cols)):
            if i in visited:
                continue
            cluster = [i] + [j for j in range(len(cols)) if adjacency[i, j]]
            if len(cluster) >= 3:
                cluster_names = [cols[k] for k in cluster]
                visited.update(cluster)
                avg_corr = float(corr_matrix.iloc[cluster, cluster].values[
                    np.triu_indices(len(cluster), k=1)].mean())
                violations.append(LeakageViolation(
                    leakage_type=LeakageType.FEATURE_CORRELATION,
                    affected_feature=f"Cluster: {', '.join(cluster_names[:4])}{'...' if len(cluster_names)>4 else ''}",
                    severity=SeverityLevel.MEDIUM,
                    severity_score=round(avg_corr, 4),
                    detector_name="FeatureCorrelation/Cluster",
                    confidence=0.7,
                    description=(
                        f"A cluster of {len(cluster)} highly inter-correlated features was detected: "
                        f"{cluster_names}. Average pairwise correlation: {avg_corr:.3f}. "
                        f"Clustered features amplify leakage — if one leaks, all effectively do."
                    ),
                    remediation=(
                        f"Apply PCA or feature selection (SelectKBest, RFE) to reduce this cluster "
                        f"to the most informative representative. Remove features with VIF > 10."
                    ),
                    statistical_evidence={
                        "cluster_size": len(cluster),
                        "cluster_features": cluster_names,
                        "avg_pairwise_correlation": round(avg_corr, 4),
                    }
                ))
        return violations
