# pyre-ignore-all-errors
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import upload, detect, report, analytics, compare, explain, pipeline
from app.core.config import settings

app = FastAPI(
    title="LeakShield API v2.1",
    description=(
        "Advanced AI-Powered Data Leakage Detection — 6 Detector Modules  |  "
        "ML Pipeline Auditor  |  8 Framework Knowledge Bases"
    ),
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,    prefix="/api/upload",    tags=["Upload"])
app.include_router(detect.router,    prefix="/api/detect",    tags=["Detection"])
app.include_router(report.router,    prefix="/api/report",    tags=["Report"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(compare.router,   prefix="/api/compare",   tags=["Compare"])
app.include_router(explain.router,   prefix="/api/explain",   tags=["Explain"])
app.include_router(pipeline.router,  prefix="/api/pipeline",  tags=["ML Pipeline"])


@app.get("/")
def root():
    return {
        "message":   "LeakShield API v2.1 running",
        "version":   "2.1.0",
        "detectors": [
            "TrainTestContamination", "TargetLeakage", "TemporalLeakage",
            "StatisticalDistribution", "FeatureCorrelation", "PreprocessingAudit"
        ],
        "pipeline_auditor": {
            "supported_frameworks": [
                "sklearn", "xgboost", "lightgbm", "catboost",
                "keras", "pytorch", "mlflow", "huggingface"
            ],
            "endpoints": [
                "POST /api/pipeline/audit",
                "GET  /api/pipeline/audits",
                "GET  /api/pipeline/frameworks",
                "GET  /api/pipeline/frameworks/{name}",
                "GET  /api/pipeline/frameworks/{name}/best-practice",
                "POST /api/pipeline/validate-steps",
            ]
        }
    }


@app.get("/health")
def health():
    return {"status": "healthy", "version": "2.1.0"}
