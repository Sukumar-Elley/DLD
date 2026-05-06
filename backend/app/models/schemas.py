from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from enum import Enum


class SeverityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class LeakageType(str, Enum):
    TRAIN_TEST_CONTAMINATION = "Train-Test Contamination"
    TARGET_LEAKAGE = "Target Leakage"
    TEMPORAL_LEAKAGE = "Temporal Leakage"
    STATISTICAL_DISTRIBUTION = "Statistical Distribution Shift"
    FEATURE_CORRELATION = "Feature Correlation Leakage"
    PREPROCESSING_AUDIT = "Preprocessing Anti-Pattern"


class LeakageViolation(BaseModel):
    leakage_type: LeakageType
    affected_feature: str
    severity: SeverityLevel
    severity_score: float
    description: str
    remediation: str
    statistical_evidence: Dict[str, Any] = {}
    detector_name: str = ""
    confidence: float = 1.0


class DetectionSummary(BaseModel):
    total_violations: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    overall_risk_score: float
    pipeline_health: str
    leakage_type_breakdown: Dict[str, int] = {}
    most_affected_features: List[str] = []
    detection_duration_ms: int = 0


class FeatureProfile(BaseModel):
    name: str
    dtype: str
    null_ratio: float
    unique_ratio: float
    mean: Optional[float] = None
    std: Optional[float] = None
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    violation_count: int = 0
    max_severity: Optional[str] = None


class CorrelationEntry(BaseModel):
    feature_a: str
    feature_b: str
    correlation: float
    is_suspicious: bool


class DetectionReport(BaseModel):
    report_id: str
    dataset_name: str
    total_features: int
    total_rows: int
    target_column: Optional[str]
    date_column: Optional[str] = None
    violations: List[LeakageViolation]
    summary: DetectionSummary
    recommendations: List[str]
    feature_profiles: List[FeatureProfile] = []
    top_correlations: List[CorrelationEntry] = []
    created_at: str
    config: Dict[str, Any] = {}


class DetectionRequest(BaseModel):
    dataset_id: str
    target_column: Optional[str] = None
    date_column: Optional[str] = None
    test_size: float = 0.2
    domain: Optional[str] = None
    run_statistical: bool = True
    run_correlation: bool = True
    run_preprocessing: bool = True
    correlation_threshold: float = 0.95
    mi_threshold: float = 0.8


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    total_rows: int
    total_columns: int
    columns: List[str]
    dtypes: Dict[str, str]
    sample_data: List[Dict[str, Any]]
    inferred_target: Optional[str] = None
    inferred_date_columns: List[str] = []
    numeric_columns: List[str] = []
    categorical_columns: List[str] = []
    message: str


class AnalyticsResponse(BaseModel):
    report_id: str
    feature_risk_scores: Dict[str, float]
    leakage_type_distribution: Dict[str, int]
    severity_distribution: Dict[str, int]
    top_risky_features: List[Dict[str, Any]]


# ─── ML Pipeline Schemas ──────────────────────────────────────────────────────

class PipelineStepRole(str, Enum):
    IMPUTER       = "Imputer"
    SCALER        = "Scaler"
    ENCODER       = "Encoder"
    FEATURE_SEL   = "Feature Selection"
    DECOMPOSITION = "Decomposition"
    RESAMPLER     = "Resampler"
    ESTIMATOR     = "Estimator"
    CUSTOM        = "Custom"
    UNKNOWN       = "Unknown"


class PipelineStep(BaseModel):
    step_index:   int
    step_name:    str
    class_name:   str
    role:         PipelineStepRole
    params:       Dict[str, Any] = {}
    leakage_risk: Optional[str]  = None  # description of risk if any
    severity:     Optional[str]  = None
    remediation:  Optional[str]  = None


class PipelineViolation(BaseModel):
    violation_type: str
    step_name:      str
    step_index:     int
    severity:       SeverityLevel
    severity_score: float
    description:    str
    remediation:    str
    framework:      str = "sklearn"


class PipelineAuditResult(BaseModel):
    audit_id:          str
    framework:         str
    pipeline_type:     str
    total_steps:       int
    steps:             List[PipelineStep]
    violations:        List[PipelineViolation]
    overall_risk:      str    # SAFE / AT_RISK / LEAKY
    risk_score:        float
    recommendations:   List[str]
    created_at:        str


class MLFrameworkInfo(BaseModel):
    framework:       str
    version:         Optional[str]
    pipeline_type:   str
    detected_issues: List[str]
    best_practices:  List[str]
