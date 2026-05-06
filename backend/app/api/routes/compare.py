from fastapi import APIRouter, HTTPException
from app.api.routes.detect import REPORTS
from app.models.schemas import DetectionReport

router = APIRouter()


@router.get("/{id_a}/{id_b}")
def compare_reports(id_a: str, id_b: str):
    """Side-by-side comparison of two detection reports."""
    for rid in [id_a, id_b]:
        if rid not in REPORTS:
            raise HTTPException(status_code=404, detail=f"Report '{rid}' not found.")

    ra, rb = REPORTS[id_a], REPORTS[id_b]

    def summarise(r: DetectionReport):
        return {
            "report_id": r.report_id,
            "dataset_name": r.dataset_name,
            "total_rows": r.total_rows,
            "total_features": r.total_features,
            "pipeline_health": r.summary.pipeline_health,
            "overall_risk_score": r.summary.overall_risk_score,
            "total_violations": r.summary.total_violations,
            "critical": r.summary.critical_count,
            "high": r.summary.high_count,
            "medium": r.summary.medium_count,
            "low": r.summary.low_count,
            "leakage_type_breakdown": r.summary.leakage_type_breakdown,
            "most_affected_features": r.summary.most_affected_features,
            "created_at": r.created_at,
        }

    # Which features appear in both
    feats_a = {v.affected_feature for v in ra.violations}
    feats_b = {v.affected_feature for v in rb.violations}
    common = list(feats_a & feats_b)
    only_a = list(feats_a - feats_b)
    only_b = list(feats_b - feats_a)

    # Risk delta
    delta = round(rb.summary.overall_risk_score - ra.summary.overall_risk_score, 4)
    improved = delta < 0

    return {
        "report_a": summarise(ra),
        "report_b": summarise(rb),
        "delta": {
            "risk_score_change": delta,
            "violation_change": rb.summary.total_violations - ra.summary.total_violations,
            "improved": improved,
            "verdict": "✅ Pipeline improved" if improved else ("⚠️ No change" if delta == 0 else "🔴 Pipeline degraded"),
        },
        "feature_overlap": {
            "common_violating_features": common,
            "only_in_a": only_a,
            "only_in_b": only_b,
            "overlap_ratio": round(len(common) / max(len(feats_a | feats_b), 1), 4),
        }
    }


@router.get("/{id_a}/{id_b}/violations-diff")
def violations_diff(id_a: str, id_b: str):
    """Which violations were fixed, introduced, or persisted."""
    for rid in [id_a, id_b]:
        if rid not in REPORTS:
            raise HTTPException(status_code=404, detail=f"Report '{rid}' not found.")

    ra, rb = REPORTS[id_a], REPORTS[id_b]

    def vkey(v):
        return f"{v.leakage_type}::{v.affected_feature}"

    keys_a = {vkey(v): v for v in ra.violations}
    keys_b = {vkey(v): v for v in rb.violations}

    fixed      = [v.dict() for k, v in keys_a.items() if k not in keys_b]
    introduced = [v.dict() for k, v in keys_b.items() if k not in keys_a]
    persisted  = [v.dict() for k, v in keys_b.items() if k in keys_a]

    return {
        "fixed": fixed,
        "introduced": introduced,
        "persisted": persisted,
        "summary": {
            "fixed_count": len(fixed),
            "introduced_count": len(introduced),
            "persisted_count": len(persisted),
        }
    }
