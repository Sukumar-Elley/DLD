import time
from fastapi import APIRouter, HTTPException
from app.models.schemas import DetectionRequest, DetectionReport
from app.utils.data_loader import get_dataset, infer_target_column
from app.detectors.train_test_contamination import TrainTestContaminationDetector
from app.detectors.target_leakage import TargetLeakageDetector
from app.detectors.temporal_leakage import TemporalLeakageDetector
from app.detectors.statistical_distribution import StatisticalDistributionDetector
from app.detectors.feature_correlation import FeatureCorrelationDetector
from app.detectors.preprocessing_audit import PreprocessingAuditDetector
from app.detectors.severity_scorer import SeverityScorer

router = APIRouter()
REPORTS: dict = {}


@router.post("/", response_model=DetectionReport)
def run_detection(request: DetectionRequest):
    start = time.time()
    df = get_dataset(request.dataset_id)

    target_col = request.target_column or infer_target_column(df)
    if target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found.")

    all_violations = []
    top_correlations = []

    # 1. Train-Test Contamination
    ttc = TrainTestContaminationDetector(df=df, target_column=target_col, test_size=request.test_size)
    viol = ttc.detect()
    for v in viol: v.detector_name = v.detector_name or "TrainTestContamination"
    all_violations.extend(viol)

    # 2. Target Leakage
    tl = TargetLeakageDetector(df=df, target_column=target_col)
    viol = tl.detect()
    for v in viol: v.detector_name = v.detector_name or "TargetLeakage"
    all_violations.extend(viol)

    # 3. Temporal Leakage
    temp = TemporalLeakageDetector(df=df, target_column=target_col, date_column=request.date_column)
    viol = temp.detect()
    for v in viol: v.detector_name = v.detector_name or "TemporalLeakage"
    all_violations.extend(viol)

    # 4. Statistical Distribution (optional)
    if request.run_statistical:
        sd = StatisticalDistributionDetector(df=df, target_column=target_col, test_size=request.test_size)
        all_violations.extend(sd.detect())

    # 5. Feature Correlation Leakage (optional)
    if request.run_correlation:
        fc = FeatureCorrelationDetector(
            df=df, target_column=target_col,
            correlation_threshold=request.correlation_threshold
        )
        all_violations.extend(fc.detect())
        top_correlations = fc.get_top_correlations()

    # 6. Preprocessing Audit (optional)
    if request.run_preprocessing:
        pa = PreprocessingAuditDetector(df=df, target_column=target_col)
        all_violations.extend(pa.detect())

    duration_ms = int((time.time() - start) * 1000)

    scorer = SeverityScorer()
    report = scorer.generate_report(
        violations=all_violations,
        df=df,
        dataset_name=request.dataset_id,
        target_column=target_col,
        date_column=request.date_column,
        top_correlations=top_correlations,
        duration_ms=duration_ms,
        config={
            "test_size": request.test_size,
            "correlation_threshold": request.correlation_threshold,
            "run_statistical": request.run_statistical,
            "run_correlation": request.run_correlation,
            "run_preprocessing": request.run_preprocessing,
        }
    )

    REPORTS[report.report_id] = report
    return report


@router.get("/reports/{report_id}", response_model=DetectionReport)
def get_report(report_id: str):
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    return REPORTS[report_id]


@router.get("/reports")
def list_reports():
    return {
        "reports": [
            {
                "report_id": r.report_id,
                "dataset_name": r.dataset_name,
                "total_violations": r.summary.total_violations,
                "pipeline_health": r.summary.pipeline_health,
                "overall_risk_score": r.summary.overall_risk_score,
                "created_at": r.created_at,
            }
            for r in sorted(REPORTS.values(), key=lambda x: x.created_at, reverse=True)
        ]
    }


@router.delete("/reports/{report_id}")
def delete_report(report_id: str):
    if report_id not in REPORTS:
        raise HTTPException(status_code=404, detail="Report not found.")
    del REPORTS[report_id]
    return {"deleted": report_id}
