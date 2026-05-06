from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.api.routes.detect import REPORTS

router = APIRouter()

@router.get("/{report_id}/summary")
def get_report_summary(report_id: str):
    """Get a brief summary of a detection report."""
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    report = REPORTS[report_id]
    return {
        "report_id": report_id,
        "dataset_name": report.dataset_name,
        "total_features": report.total_features,
        "total_rows": report.total_rows,
        "total_violations": report.summary.total_violations,
        "pipeline_health": report.summary.pipeline_health,
        "overall_risk_score": report.summary.overall_risk_score,
        "created_at": report.created_at
    }

@router.get("/{report_id}/violations")
def get_violations(report_id: str, severity: str = None):
    """Get violations from a report, optionally filtered by severity."""
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    report = REPORTS[report_id]
    violations = report.violations
    if severity:
        violations = [v for v in violations if v.severity.value == severity.upper()]
    return {"violations": violations, "count": len(violations)}

@router.get("/{report_id}/recommendations")
def get_recommendations(report_id: str):
    """Get remediation recommendations for a report."""
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"recommendations": REPORTS[report_id].recommendations}
