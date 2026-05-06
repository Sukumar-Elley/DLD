import uuid
from datetime import datetime
from typing import List
from collections import Counter
import pandas as pd
from app.models.schemas import (
    LeakageViolation, DetectionSummary, DetectionReport,
    SeverityLevel, CorrelationEntry, FeatureProfile
)
from app.utils.profiler import profile_dataset

SEVERITY_WEIGHTS = {
    SeverityLevel.CRITICAL: 1.0,
    SeverityLevel.HIGH: 0.75,
    SeverityLevel.MEDIUM: 0.50,
    SeverityLevel.LOW: 0.25,
}


class SeverityScorer:
    def compute_summary(
        self,
        violations: List[LeakageViolation],
        duration_ms: int = 0
    ) -> DetectionSummary:
        if not violations:
            return DetectionSummary(
                total_violations=0, critical_count=0, high_count=0,
                medium_count=0, low_count=0, overall_risk_score=0.0,
                pipeline_health="HEALTHY", detection_duration_ms=duration_ms
            )

        counts = Counter(v.severity for v in violations)
        critical = counts[SeverityLevel.CRITICAL]
        high = counts[SeverityLevel.HIGH]
        medium = counts[SeverityLevel.MEDIUM]
        low = counts[SeverityLevel.LOW]

        # Weighted risk score
        total_weight = sum(SEVERITY_WEIGHTS[v.severity] * v.confidence for v in violations)
        max_possible = len(violations) * 1.0
        risk = min(total_weight / max_possible, 1.0)
        if critical > 0:
            risk = min(risk + 0.15 * min(critical, 3), 1.0)

        # Leakage type breakdown
        type_breakdown = dict(Counter(str(v.leakage_type) for v in violations))

        # Most affected features (by violation count)
        feat_count = Counter()
        for v in violations:
            feat = v.affected_feature.split(" ↔ ")[0]
            feat_count[feat] += 1
        most_affected = [f for f, _ in feat_count.most_common(5)]

        return DetectionSummary(
            total_violations=len(violations),
            critical_count=critical,
            high_count=high,
            medium_count=medium,
            low_count=low,
            overall_risk_score=round(risk, 3),
            pipeline_health=self._health(risk, critical, high),
            leakage_type_breakdown=type_breakdown,
            most_affected_features=most_affected,
            detection_duration_ms=duration_ms,
        )

    def _health(self, risk: float, critical: int, high: int) -> str:
        if critical > 0 or risk >= 0.75: return "CRITICAL"
        if high > 0 or risk >= 0.50:     return "COMPROMISED"
        if risk >= 0.25:                 return "AT_RISK"
        return "HEALTHY"

    def generate_recommendations(
        self, violations: List[LeakageViolation], summary: DetectionSummary
    ) -> List[str]:
        recs = []
        if summary.pipeline_health == "HEALTHY":
            recs.append("✅ No significant leakage detected. Your pipeline appears clean.")
            recs.append("🔍 Re-run LeakShield after any preprocessing changes or data updates.")
            return recs

        if summary.critical_count > 0:
            recs.append(
                f"🚨 STOP: {summary.critical_count} CRITICAL violation(s) detected. "
                f"Training on this pipeline will produce fundamentally unreliable models."
            )

        types = set(str(v.leakage_type) for v in violations)
        detectors = set(v.detector_name.split("/")[0] for v in violations)

        if "Train-Test Contamination" in types:
            recs.append(
                "🔄 Fix preprocessing order: Use sklearn Pipeline objects to guarantee that "
                "fit() is called only on training data. Never call fit_transform() on full datasets."
            )
        if "Target Leakage" in types:
            recs.append(
                "🎯 Audit all features against the target with domain experts. Remove any "
                "feature derived from or computed after observing the target outcome."
            )
        if "Temporal Leakage" in types:
            recs.append(
                "📅 Replace random train/test splits with TimeSeriesSplit. Ensure all features "
                "respect the prediction horizon and use only past-relative timestamps."
            )
        if "StatisticalDistribution" in detectors:
            recs.append(
                "📊 KS/Chi-square tests reveal distributional contamination. Rebuild your "
                "preprocessing Pipeline ensuring all transformers are fitted on training data only."
            )
        if "FeatureCorrelation" in detectors:
            recs.append(
                "🔗 Highly correlated feature clusters detected. Apply VIF analysis and use "
                "feature selection (RFE, SelectKBest) to eliminate redundant predictors."
            )
        if "PreprocessingAudit" in detectors:
            recs.append(
                "⚙️ Preprocessing anti-patterns detected (global scaling, over-sampling before split). "
                "Refactor your pipeline to strictly separate fit and transform stages."
            )

        recs.append(
            "📉 After fixing violations, retrain and compare metrics. A significant accuracy "
            "drop often confirms that leakage was artificially inflating performance."
        )
        recs.append(
            "🛡️ Integrate LeakShield into your CI/CD pipeline as a mandatory pre-training "
            "validation gate to catch leakage automatically on every model iteration."
        )
        return recs

    def generate_report(
        self,
        violations: List[LeakageViolation],
        df: pd.DataFrame,
        dataset_name: str,
        target_column: str = None,
        date_column: str = None,
        top_correlations: List[CorrelationEntry] = None,
        duration_ms: int = 0,
        config: dict = None,
    ) -> DetectionReport:
        summary = self.compute_summary(violations, duration_ms)
        recommendations = self.generate_recommendations(violations, summary)
        sorted_violations = sorted(violations, key=lambda v: v.severity_score, reverse=True)
        feature_profiles = profile_dataset(df, violations)

        return DetectionReport(
            report_id=str(uuid.uuid4()),
            dataset_name=dataset_name,
            total_features=len(df.columns),
            total_rows=len(df),
            target_column=target_column,
            date_column=date_column,
            violations=sorted_violations,
            summary=summary,
            recommendations=recommendations,
            feature_profiles=feature_profiles,
            top_correlations=top_correlations or [],
            created_at=datetime.utcnow().isoformat(),
            config=config or {},
        )
