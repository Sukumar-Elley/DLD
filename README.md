# 🛡️ LeakShield v2.1 — Advanced ML Pipeline Leakage Detection

> 6 statistical detectors + ML Pipeline Auditor + 8 Framework Knowledge Bases + animated React dashboard

---

## ✨ What's In v2.1

### Dataset-Level Detection (6 Modules)
| Module | Core Algorithms |
|---|---|
| **TrainTestContamination** | Wasserstein distance, KS test, StandardScaler/MinMaxScaler fingerprinting, row deduplication |
| **TargetLeakage** | Random Forest importance, Mutual Information, ANOVA F-test, perfect-predictor detection |
| **TemporalLeakage** | Spearman rank vs time axis, monotonic trend, look-ahead patterns, rolling window audit |
| **StatisticalDistribution** | KS two-sample, chi-square contingency, Mann-Whitney U |
| **FeatureCorrelation** | Pairwise Pearson, surrogate pairs, target proxies, cluster analysis |
| **PreprocessingAudit** | StandardScaler/MinMaxScaler/SMOTE anti-patterns, LabelEncoder before split |

### ML Pipeline Auditor (NEW)
| Check | What It Detects |
|---|---|
| ScalerFittedOnFullData | Scaler fit_transform on full dataset before split |
| ResamplerWithoutEstimator | SMOTE/oversampling outside Pipeline (leaks into test) |
| TargetEncoderLeakage | TargetEncoder/LabelEncoder fitted globally |
| EstimatorNotLast | Model not at final step position |
| FeatureSelectionAfterEstimator | Data snooping via post-fit feature selection |
| ScalerBeforeImputer | Wrong step ordering causing NaN contamination |
| NoEstimatorInPipeline | Preprocessing-only pipeline run on full data |

### Framework Knowledge Base (NEW — 8 frameworks)
`sklearn` · `xgboost` · `lightgbm` · `catboost` · `keras` · `pytorch` · `mlflow` · `huggingface`

Each framework includes:
- All known leakage patterns
- Safe patterns and best practices
- Dangerous API calls to avoid
- Production-safe code template

---

## 🚀 Quick Start

```bash
git clone https://github.com/yourusername/leakshield.git
cd leakshield
docker-compose up --build

# Frontend:  http://localhost:5173
# API:       http://localhost:8000
# API Docs:  http://localhost:8000/docs
```

---

## 📡 REST API — 20 Endpoints

### Dataset Detection
| Method | Endpoint |
|---|---|
| POST | `/api/upload/` |
| POST | `/api/detect/` |
| GET | `/api/detect/reports` |
| GET/DELETE | `/api/detect/reports/{id}` |

### Analytics, Report, Compare, Explain
| GET | `/api/analytics/{id}` · `/api/analytics/{id}/correlations` · `/api/analytics/{id}/feature-profiles` |
| GET | `/api/report/{id}/violations` · `/api/report/{id}/recommendations` |
| GET | `/api/compare/{a}/{b}` · `/api/compare/{a}/{b}/violations-diff` |
| GET | `/api/explain/{id}` · `/api/explain/{id}/{feature}` |

### ML Pipeline (NEW)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/pipeline/audit` | Audit a pipeline config JSON |
| GET | `/api/pipeline/audits` | List all pipeline audits |
| GET | `/api/pipeline/audits/{id}` | Get specific audit result |
| GET | `/api/pipeline/frameworks` | All 8 framework knowledge bases |
| GET | `/api/pipeline/frameworks/{name}` | Single framework info |
| GET | `/api/pipeline/frameworks/{name}/best-practice` | Code template + dangerous calls |
| POST | `/api/pipeline/validate-steps` | Quick step-list validation |

---

## 🖥️ Frontend — 6 Tabs in Analysis + Report

| Tab | Contents |
|---|---|
| **Violations** | Filterable cards + Feature Risk Bars view |
| **Report** | Animated gauge, charts, staggered recommendations |
| **Heatmap** | Feature correlation heatmap with cell animations |
| **Features** | Sortable column profile table |
| **Pipeline** | Visual pipeline builder + JSON paste + PipelineVisualizer |
| **ML Insights** | Framework knowledge browser with code templates |

---

## ⚙️ Tech Stack

**Backend:** Python 3.11 · FastAPI · pandas · scikit-learn · scipy · imbalanced-learn · xgboost · lightgbm  
**Frontend:** React 18 · Vite · Syne + IBM Plex Mono · Tailwind · Recharts  
**New components:** PipelineVisualizer · PipelineAuditPanel · MLInsights · FrameworkBadge  
**Deploy:** Docker · Docker Compose · Nginx  

---

*"A machine learning model is only as reliable as the integrity of the pipeline that created it."*
