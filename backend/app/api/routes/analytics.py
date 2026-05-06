from fastapi import APIRouter, HTTPException
from app.api.routes.detect import REPORTS
from app.models.schemas import AnalyticsResponse

router = APIRouter()


@router.get("/{report_id}", response_model=AnalyticsResponse)
def get_analytics(report_id: str):
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    report = REPORTS[report_id]

    # Feature-level risk scores
    feature_risks = {}
    for v in report.violations:
        feat = v.affected_feature
        current = feature_risks.get(feat, 0.0)
        feature_risks[feat] = round(max(current, v.severity_score), 4)

    # Leakage type distribution
    type_dist = {}
    for v in report.violations:
        t = str(v.leakage_type)
        type_dist[t] = type_dist.get(t, 0) + 1

    # Severity distribution
    sev_dist = {
        "CRITICAL": report.summary.critical_count,
        "HIGH": report.summary.high_count,
        "MEDIUM": report.summary.medium_count,
        "LOW": report.summary.low_count,
    }

    # Top risky features
    top_features = sorted(
        [{"feature": f, "risk_score": s} for f, s in feature_risks.items()],
        key=lambda x: x["risk_score"],
        reverse=True
    )[:10]

    return AnalyticsResponse(
        report_id=report_id,
        feature_risk_scores=feature_risks,
        leakage_type_distribution=type_dist,
        severity_distribution=sev_dist,
        top_risky_features=top_features,
    )


@router.get("/{report_id}/feature-profiles")
def get_feature_profiles(report_id: str):
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"profiles": [p.dict() for p in REPORTS[report_id].feature_profiles]}


@router.get("/{report_id}/correlations")
def get_correlations(report_id: str, min_corr: float = 0.5):
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    corrs = [
        c.dict() for c in REPORTS[report_id].top_correlations
        if abs(c.correlation) >= min_corr
    ]
    return {"correlations": corrs, "count": len(corrs)}
