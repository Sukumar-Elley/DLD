from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from app.detectors.ml_pipeline_auditor import MLPipelineAuditor
from app.detectors.framework_analyzer import (
    get_framework_info, get_all_frameworks,
    get_framework_best_practice, get_framework_dangerous_calls
)
from app.models.schemas import PipelineAuditResult, MLFrameworkInfo

router = APIRouter()

# In-memory store for pipeline audit results
PIPELINE_AUDITS: Dict[str, PipelineAuditResult] = {}


class PipelineAuditRequest(BaseModel):
    pipeline_config: Dict[str, Any]
    framework: Optional[str] = "sklearn"
    description: Optional[str] = None


@router.post("/audit", response_model=PipelineAuditResult)
def audit_pipeline(request: PipelineAuditRequest):
    """
    Audit an ML pipeline configuration for ordering violations and leakage anti-patterns.
    Accepts a JSON representation of a sklearn Pipeline, imblearn Pipeline,
    XGBoost workflow, Keras config, or similar.
    """
    try:
        auditor = MLPipelineAuditor(
            pipeline_dict=request.pipeline_config,
            framework=request.framework or "sklearn"
        )
        result = auditor.audit()
        PIPELINE_AUDITS[result.audit_id] = result
        return result
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Pipeline audit failed: {str(e)}")


@router.get("/audits")
def list_pipeline_audits():
    """List all pipeline audit results for this session."""
    return {
        "audits": [
            {
                "audit_id":     a.audit_id,
                "framework":    a.framework,
                "pipeline_type": a.pipeline_type,
                "total_steps":  a.total_steps,
                "violations":   len(a.violations),
                "overall_risk": a.overall_risk,
                "risk_score":   a.risk_score,
                "created_at":   a.created_at,
            }
            for a in sorted(PIPELINE_AUDITS.values(), key=lambda x: x.created_at, reverse=True)
        ]
    }


@router.get("/audits/{audit_id}", response_model=PipelineAuditResult)
def get_pipeline_audit(audit_id: str):
    if audit_id not in PIPELINE_AUDITS:
        raise HTTPException(status_code=404, detail="Audit not found.")
    return PIPELINE_AUDITS[audit_id]


@router.get("/frameworks")
def list_frameworks():
    """List all supported ML frameworks with their leakage knowledge."""
    frameworks = get_all_frameworks()
    return {
        "frameworks": frameworks,
        "count": len(frameworks),
        "details": {
            fw: get_framework_info(fw).dict() for fw in frameworks
        }
    }


@router.get("/frameworks/{framework_name}", response_model=MLFrameworkInfo)
def get_framework(framework_name: str):
    """Get leakage patterns, safe patterns, and best practices for a specific ML framework."""
    return get_framework_info(framework_name)


@router.get("/frameworks/{framework_name}/best-practice")
def framework_best_practice(framework_name: str):
    """Get production-safe code template for a specific ML framework."""
    code = get_framework_best_practice(framework_name)
    dangerous = get_framework_dangerous_calls(framework_name)
    return {
        "framework": framework_name,
        "best_practice_code": code,
        "dangerous_calls": dangerous,
    }


@router.post("/validate-steps")
def validate_step_order(steps: List[Dict[str, Any]]):
    """
    Quick validation of a steps list without requiring a full pipeline config.
    Each step: {"name": "...", "class": "...", "params": {...}}
    """
    try:
        auditor = MLPipelineAuditor({"steps": [[s.get("name","step"), s] for s in steps]})
        result  = auditor.audit()
        return {
            "valid":       len(result.violations) == 0,
            "violations":  [v.dict() for v in result.violations],
            "steps":       [s.dict() for s in result.steps],
            "overall_risk": result.overall_risk,
            "risk_score":   result.risk_score,
            "recommendations": result.recommendations,
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
