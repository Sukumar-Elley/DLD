from fastapi import APIRouter, HTTPException
from app.api.routes.detect import REPORTS

router = APIRouter()

SEVERITY_EXPLAINERS = {
    "CRITICAL": {
        "impact": "Your model will NOT generalise to real-world data. Accuracy metrics during evaluation are fabricated.",
        "urgency": "Stop all training immediately. Fix this before any further ML work.",
        "analogy": "Using a leaked exam answer sheet — the score looks perfect but proves nothing."
    },
    "HIGH": {
        "impact": "Significant inflation of model performance metrics. Production accuracy may drop by 20-40%.",
        "urgency": "Fix before training. Do not share evaluation results externally.",
        "analogy": "Training on a slightly smudged answer sheet — most answers are real but some aren't."
    },
    "MEDIUM": {
        "impact": "Moderate risk of overfitting to leakage signal. Model may be less robust than metrics suggest.",
        "urgency": "Investigate with domain experts before proceeding.",
        "analogy": "A student who saw hints about the exam — uncertain how much it helped."
    },
    "LOW": {
        "impact": "Minor risk. Likely a false positive. Monitor across multiple runs.",
        "urgency": "Document and re-evaluate after preprocessing changes.",
        "analogy": "A rumour about exam topics — might be coincidence."
    }
}

TYPE_EXPLAINERS = {
    "Train-Test Contamination": {
        "plain_english": "Your preprocessing (scaling, encoding, imputation) was applied to the full dataset BEFORE splitting into train and test sets. This means the model saw test data statistics during training — making the evaluation artificially optimistic.",
        "root_cause": "Calling .fit_transform() on the full dataset instead of fitting only on X_train.",
        "fix_summary": "Always use sklearn Pipeline objects. Never touch test data during preprocessing fit."
    },
    "Target Leakage": {
        "plain_english": "One or more input features directly encode the answer you're trying to predict. The model is essentially being handed the answer during training.",
        "root_cause": "Features derived from the target variable, or computed after the prediction event, included in training data.",
        "fix_summary": "Remove any feature correlated with the target at inference time. Audit data lineage."
    },
    "Temporal Leakage": {
        "plain_english": "Your model is seeing the future. Features contain information from after the prediction timestamp, making the model appear accurate on historical data but useless in real time.",
        "root_cause": "Random train/test splitting ignoring time order; cumulative/rolling features including current timestep.",
        "fix_summary": "Use TimeSeriesSplit. Shift all rolling features by one period. Remove future-dated columns."
    },
    "Statistical Distribution Shift": {
        "plain_english": "Train and test distributions are suspiciously identical — statistically indistinguishable. This only happens when the same preprocessing was applied globally before splitting.",
        "root_cause": "Global StandardScaler, MinMaxScaler, or imputer fit on combined train+test data.",
        "fix_summary": "Rebuild preprocessing pipeline to fit only on training data."
    },
    "Feature Correlation Leakage": {
        "plain_english": "Two or more features are so strongly correlated that one is effectively a copy of the other. If one leaks, all correlated features inherit that leakage.",
        "root_cause": "Derived features not removed; redundant engineered features; feature clusters not pruned.",
        "fix_summary": "Apply VIF analysis, remove features with correlation > threshold, use RFE or SelectKBest."
    },
    "Preprocessing Anti-Pattern": {
        "plain_english": "A structural mistake in how the data was prepared — like applying oversampling before splitting, or encoding categories globally — has introduced artificial patterns the model will learn to exploit.",
        "root_cause": "SMOTE/oversampling before split; global label encoding; near-zero variance from bad imputation.",
        "fix_summary": "Restructure all preprocessing to run inside Pipeline.fit() on training data only."
    }
}


@router.get("/{report_id}/{feature_name}")
def explain_violation(report_id: str, feature_name: str):
    """Get a detailed plain-language explanation for a specific feature's violation."""
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")

    report = REPORTS[report_id]
    matches = [v for v in report.violations if feature_name.lower() in v.affected_feature.lower()]

    if not matches:
        raise HTTPException(status_code=404, detail=f"No violations found for feature '{feature_name}'.")

    v = matches[0]  # take the highest-severity match (violations are sorted)
    sev_info  = SEVERITY_EXPLAINERS.get(str(v.severity), {})
    type_info = TYPE_EXPLAINERS.get(str(v.leakage_type), {})

    return {
        "feature": v.affected_feature,
        "leakage_type": str(v.leakage_type),
        "severity": str(v.severity),
        "severity_score": v.severity_score,
        "plain_english": type_info.get("plain_english", v.description),
        "root_cause": type_info.get("root_cause", "Unknown"),
        "fix_summary": type_info.get("fix_summary", v.remediation),
        "impact": sev_info.get("impact", ""),
        "urgency": sev_info.get("urgency", ""),
        "analogy": sev_info.get("analogy", ""),
        "statistical_evidence": v.statistical_evidence,
        "all_violations_on_feature": [m.dict() for m in matches],
    }


@router.get("/{report_id}")
def explain_report(report_id: str):
    """Get plain-language explanation for the entire report."""
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")

    report = REPORTS[report_id]
    s = report.summary
    health_msg = {
        "HEALTHY":     "Your pipeline looks clean. No significant leakage detected.",
        "AT_RISK":     "Low-level leakage signals detected. Review before training.",
        "COMPROMISED": "Significant leakage found. Model results are untrustworthy.",
        "CRITICAL":    "Severe leakage confirmed. Training on this pipeline will produce fundamentally unreliable models.",
    }.get(s.pipeline_health, "")

    return {
        "pipeline_health": s.pipeline_health,
        "health_explanation": health_msg,
        "risk_score_meaning": f"Overall {round(s.overall_risk_score*100)}% of evaluated signals show leakage patterns.",
        "top_issues": [
            {
                "feature": v.affected_feature,
                "type": str(v.leakage_type),
                "severity": str(v.severity),
                "one_liner": TYPE_EXPLAINERS.get(str(v.leakage_type), {}).get("plain_english", v.description)[:120] + "...",
            }
            for v in report.violations[:5]
        ],
        "priority_action": report.recommendations[0] if report.recommendations else "No action required.",
    }
