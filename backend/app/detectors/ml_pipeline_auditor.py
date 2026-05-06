"""
ML Pipeline Auditor
===================
Audits a machine learning pipeline definition (JSON representation of
an sklearn Pipeline, imblearn Pipeline, or similar) for ordering violations
and structural leakage anti-patterns.

Supported framework patterns:
  - scikit-learn Pipeline / FeatureUnion / ColumnTransformer
  - imblearn Pipeline (with SMOTE/oversampling steps)
  - XGBoost / LightGBM / CatBoost (as estimator steps)
  - Keras / TensorFlow preprocessing layers (via config dict)
  - MLflow experiment config (pipeline_stages field)

Input: a JSON dict describing pipeline steps in one of the supported formats.
"""

import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.models.schemas import (
    PipelineStep, PipelineViolation, PipelineAuditResult,
    PipelineStepRole, SeverityLevel
)

# ─── Step classifier ──────────────────────────────────────────────────────────
SCALERS       = ['standardscaler','minmaxscaler','robustscaler','normalizer',
                 'maxabsscaler','quantiletransformer','powertransformer']
IMPUTERS      = ['simpleimputer','knnimputer','iterativeimputer','missingindicator']
ENCODERS      = ['labelencoder','ordinalencoder','onehotencoder','targetencoder',
                 'binaryencoder','hashingtransformer','countvectorizer','tfidfvectorizer']
SELECTORS     = ['selectkbest','rfe','rfecv','selectfrommodel','variancethreshold',
                 'selectpercentile','pca','truncatedsvd','nmf','lda']
RESAMPLERS    = ['smote','adasyn','randomoversampler','smoteenn','smotetomek',
                 'randomundersampler','tomeklinks','editednearestneighbours']
ESTIMATORS    = ['logisticregression','randomforestclassifier','randomforestregressor',
                 'gradientboostingclassifier','gradientboostingregressor',
                 'svc','svr','xgbclassifier','xgbregressor',
                 'lgbmclassifier','lgbmregressor','catboostclassifier','catboostregressor',
                 'decisiontreeclassifier','decisiontreeregressor','linearregression',
                 'ridge','lasso','elasticnet','kneighborsclassifier',
                 'mlpclassifier','mlpregressor','sequential','functional']
DECOMPOSERS   = ['pca','kernelpca','truncatedsvd','nmf','fastica','factoranalysis']


def _classify_role(class_name: str) -> PipelineStepRole:
    cn = class_name.lower().replace('_','').replace('-','')
    if any(s in cn for s in SCALERS):       return PipelineStepRole.SCALER
    if any(s in cn for s in IMPUTERS):      return PipelineStepRole.IMPUTER
    if any(s in cn for s in ENCODERS):      return PipelineStepRole.ENCODER
    if any(s in cn for s in SELECTORS):     return PipelineStepRole.FEATURE_SEL
    if any(s in cn for s in RESAMPLERS):    return PipelineStepRole.RESAMPLER
    if any(s in cn for s in DECOMPOSERS):   return PipelineStepRole.DECOMPOSITION
    if any(s in cn for s in ESTIMATORS):    return PipelineStepRole.ESTIMATOR
    return PipelineStepRole.UNKNOWN


def _extract_steps(pipeline_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Normalise multiple pipeline formats into a flat list of {name, class, params}."""
    raw = []

    # Format 1: sklearn Pipeline — {"steps": [["name", {"class": "..."}], ...]}
    if 'steps' in pipeline_dict:
        for item in pipeline_dict['steps']:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                name, cfg = item
                if isinstance(cfg, dict):
                    raw.append({'name': str(name), 'class': cfg.get('class', cfg.get('__class__', str(name))), 'params': cfg})
                elif isinstance(cfg, str):
                    raw.append({'name': str(name), 'class': cfg, 'params': {}})

    # Format 2: flat list — [{"name": "...", "class": "..."}, ...]
    elif isinstance(pipeline_dict, list):
        for i, item in enumerate(pipeline_dict):
            if isinstance(item, dict):
                raw.append({
                    'name':   item.get('name', item.get('step_name', f'step_{i}')),
                    'class':  item.get('class', item.get('class_name', item.get('type', f'Step{i}'))),
                    'params': item.get('params', item.get('parameters', {}))
                })

    # Format 3: MLflow pipeline_stages
    elif 'pipeline_stages' in pipeline_dict:
        for i, stage in enumerate(pipeline_dict['pipeline_stages']):
            raw.append({
                'name':   stage.get('name', f'stage_{i}'),
                'class':  stage.get('estimator', stage.get('transformer', f'Stage{i}')),
                'params': stage.get('params', {})
            })

    # Format 4: Keras/TF config — {"config": {"layers": [...]}}
    elif 'config' in pipeline_dict and 'layers' in pipeline_dict.get('config', {}):
        for i, layer in enumerate(pipeline_dict['config']['layers']):
            raw.append({
                'name':   layer.get('name', f'layer_{i}'),
                'class':  layer.get('class_name', 'Layer'),
                'params': layer.get('config', {})
            })

    # Format 5: simple dict of name→class
    elif all(isinstance(v, (str, dict)) for v in pipeline_dict.values()) and 'steps' not in pipeline_dict:
        for i, (name, cls) in enumerate(pipeline_dict.items()):
            if name in ('framework', 'version', 'pipeline_type', 'description'):
                continue
            cls_name = cls if isinstance(cls, str) else cls.get('class', str(cls))
            params   = cls if isinstance(cls, dict) else {}
            raw.append({'name': name, 'class': cls_name, 'params': params})

    return raw


class MLPipelineAuditor:
    """Audit a pipeline definition dict for ordering and structural leakage violations."""

    def __init__(self, pipeline_dict: Dict[str, Any], framework: str = "sklearn"):
        self.pipeline  = pipeline_dict
        self.framework = framework
        self.raw_steps = _extract_steps(pipeline_dict)

    def audit(self) -> PipelineAuditResult:
        steps      = self._build_steps()
        violations = self._check_violations(steps)
        risk_score = self._compute_risk(violations)
        overall    = "LEAKY" if risk_score >= 0.7 else ("AT_RISK" if risk_score >= 0.3 else "SAFE")
        recs       = self._recommendations(violations, steps)

        return PipelineAuditResult(
            audit_id       = str(uuid.uuid4()),
            framework      = self.framework,
            pipeline_type  = self._detect_pipeline_type(steps),
            total_steps    = len(steps),
            steps          = steps,
            violations     = violations,
            overall_risk   = overall,
            risk_score     = round(risk_score, 3),
            recommendations = recs,
            created_at     = datetime.utcnow().isoformat(),
        )

    # ── Step building ─────────────────────────────────────────────────────────
    def _build_steps(self) -> List[PipelineStep]:
        steps = []
        for i, raw in enumerate(self.raw_steps):
            cls  = raw.get('class', 'Unknown')
            role = _classify_role(cls)
            steps.append(PipelineStep(
                step_index = i,
                step_name  = raw.get('name', f'step_{i}'),
                class_name = cls,
                role       = role,
                params     = raw.get('params', {}),
            ))
        return steps

    # ── Violation checks ──────────────────────────────────────────────────────
    def _check_violations(self, steps: List[PipelineStep]) -> List[PipelineViolation]:
        violations: List[PipelineViolation] = []

        roles = [s.role for s in steps]
        has_estimator = PipelineStepRole.ESTIMATOR in roles

        for i, step in enumerate(steps):

            # 1. Scaler BEFORE train/test split marker
            #    (In a proper Pipeline, scalers ARE safe — they only fit on train.
            #     BUT if the pipeline is being called on the full dataset, they leak.)
            if step.role == PipelineStepRole.SCALER:
                # Check if params suggest global fit (fit_transform on full data hint)
                params_str = str(step.params).lower()
                if 'fit_transform' in params_str or 'full_data' in params_str:
                    violations.append(PipelineViolation(
                        violation_type = "ScalerFittedOnFullData",
                        step_name      = step.step_name,
                        step_index     = i,
                        severity       = SeverityLevel.CRITICAL,
                        severity_score = 0.92,
                        framework      = self.framework,
                        description    = (
                            f"Step '{step.step_name}' ({step.class_name}) appears to be "
                            f"fitted on the full dataset (fit_transform on combined data). "
                            f"This leaks test set statistics into the training process."
                        ),
                        remediation    = (
                            f"Use sklearn Pipeline — it automatically fits '{step.step_name}' "
                            f"only on X_train and applies transform to X_test:\n"
                            f"  pipe = Pipeline([('{step.step_name}', {step.class_name}()), ('model', ...)])\n"
                            f"  pipe.fit(X_train, y_train)"
                        )
                    ))

            # 2. Resampler (SMOTE etc.) INSIDE pipeline — this is safe; outside is dangerous
            if step.role == PipelineStepRole.RESAMPLER:
                if not has_estimator:
                    violations.append(PipelineViolation(
                        violation_type = "ResamplerWithoutEstimator",
                        step_name      = step.step_name,
                        step_index     = i,
                        severity       = SeverityLevel.MEDIUM,
                        severity_score = 0.55,
                        framework      = self.framework,
                        description    = (
                            f"Resampling step '{step.step_name}' ({step.class_name}) is defined "
                            f"without a downstream estimator in the pipeline. This often means "
                            f"resampling is applied outside the pipeline, before train/test split."
                        ),
                        remediation    = (
                            f"Use imblearn Pipeline with the estimator:\n"
                            f"  from imblearn.pipeline import Pipeline\n"
                            f"  pipe = Pipeline([('{step.step_name}', {step.class_name}()), ('model', classifier)])\n"
                            f"  pipe.fit(X_train, y_train)  # SMOTE only applied during fit"
                        )
                    ))

            # 3. LabelEncoder / TargetEncoder in pipeline — can cause target leakage
            if step.role == PipelineStepRole.ENCODER:
                cn_lower = step.class_name.lower()
                if 'target' in cn_lower or 'label' in cn_lower:
                    violations.append(PipelineViolation(
                        violation_type = "TargetEncoderLeakage",
                        step_name      = step.step_name,
                        step_index     = i,
                        severity       = SeverityLevel.HIGH,
                        severity_score = 0.78,
                        framework      = self.framework,
                        description    = (
                            f"Step '{step.step_name}' ({step.class_name}) is a target-based "
                            f"encoder. If fitted on the full dataset or without cross-validation, "
                            f"it encodes target statistics into features — causing target leakage."
                        ),
                        remediation    = (
                            f"Use cross-validated target encoding:\n"
                            f"  from category_encoders import TargetEncoder\n"
                            f"  encoder = TargetEncoder(smoothing=1.0)\n"
                            f"  # Always fit inside Pipeline.fit(), never on full dataset\n"
                            f"  # Use cv parameter to prevent within-fold leakage"
                        )
                    ))

            # 4. Estimator NOT last in pipeline
            if step.role == PipelineStepRole.ESTIMATOR and i != len(steps) - 1:
                violations.append(PipelineViolation(
                    violation_type = "EstimatorNotLast",
                    step_name      = step.step_name,
                    step_index     = i,
                    severity       = SeverityLevel.HIGH,
                    severity_score = 0.80,
                    framework      = self.framework,
                    description    = (
                        f"Estimator '{step.step_name}' ({step.class_name}) is at step {i} "
                        f"but is NOT the last step (total {len(steps)} steps). sklearn "
                        f"requires the estimator to be the final step. Steps after the "
                        f"estimator will likely fail or produce incorrect predictions."
                    ),
                    remediation    = (
                        f"Move '{step.step_name}' to be the final step of the Pipeline. "
                        f"All preprocessing (scalers, encoders, selectors) must come before "
                        f"the estimator."
                    )
                ))

            # 5. Feature selection after estimator — data snooping
            if step.role == PipelineStepRole.FEATURE_SEL:
                estimator_indices = [j for j, s in enumerate(steps) if s.role == PipelineStepRole.ESTIMATOR]
                if estimator_indices and i > estimator_indices[0]:
                    violations.append(PipelineViolation(
                        violation_type = "FeatureSelectionAfterEstimator",
                        step_name      = step.step_name,
                        step_index     = i,
                        severity       = SeverityLevel.HIGH,
                        severity_score = 0.75,
                        framework      = self.framework,
                        description    = (
                            f"Feature selection step '{step.step_name}' appears after an estimator. "
                            f"If selection was performed on the full dataset using model scores, "
                            f"it constitutes data snooping — the selection criterion was influenced "
                            f"by the test set."
                        ),
                        remediation    = (
                            f"Move '{step.step_name}' before the estimator. Use SelectFromModel "
                            f"or RFE inside a Pipeline so feature selection is fitted only on "
                            f"training data during cross-validation."
                        )
                    ))

            # 6. No estimator at all
        if not has_estimator and len(steps) > 0:
            violations.append(PipelineViolation(
                violation_type = "NoEstimatorInPipeline",
                step_name      = "Pipeline",
                step_index     = -1,
                severity       = SeverityLevel.MEDIUM,
                severity_score = 0.50,
                framework      = self.framework,
                description    = (
                    "No estimator (classifier or regressor) found in the pipeline definition. "
                    "A preprocessing-only pipeline run on the full dataset before fitting a "
                    "separate model is the most common source of train-test contamination."
                ),
                remediation    = (
                    "Add your model as the final pipeline step:\n"
                    "  pipe = Pipeline([('scaler', StandardScaler()), ('model', RandomForestClassifier())])\n"
                    "  pipe.fit(X_train, y_train)"
                )
            ))

        # 7. Scaler after encoder (non-standard ordering)
        scaler_indices   = [i for i, s in enumerate(steps) if s.role == PipelineStepRole.SCALER]
        encoder_indices  = [i for i, s in enumerate(steps) if s.role == PipelineStepRole.ENCODER]
        imputer_indices  = [i for i, s in enumerate(steps) if s.role == PipelineStepRole.IMPUTER]

        if scaler_indices and imputer_indices:
            if min(scaler_indices) < min(imputer_indices):
                violations.append(PipelineViolation(
                    violation_type = "ScalerBeforeImputer",
                    step_name      = steps[min(scaler_indices)].step_name,
                    step_index     = min(scaler_indices),
                    severity       = SeverityLevel.HIGH,
                    severity_score = 0.72,
                    framework      = self.framework,
                    description    = (
                        f"Scaler '{steps[min(scaler_indices)].step_name}' appears BEFORE imputer "
                        f"'{steps[min(imputer_indices)].step_name}'. Scaling before imputation "
                        f"causes NaN propagation and means the scaler's mean/std statistics "
                        f"are computed over NaN-contaminated data."
                    ),
                    remediation    = "Reorder pipeline: Imputer → Scaler → Encoder → Selector → Estimator"
                ))

        return violations

    # ── Risk + helpers ────────────────────────────────────────────────────────
    def _compute_risk(self, violations: List[PipelineViolation]) -> float:
        if not violations:
            return 0.0
        weights = {SeverityLevel.CRITICAL:1.0, SeverityLevel.HIGH:0.75,
                   SeverityLevel.MEDIUM:0.5,  SeverityLevel.LOW:0.25}
        total = sum(weights[v.severity] * v.severity_score for v in violations)
        return min(total / max(len(violations), 1), 1.0)

    def _detect_pipeline_type(self, steps: List[PipelineStep]) -> str:
        has_resampler = any(s.role == PipelineStepRole.RESAMPLER for s in steps)
        has_nn        = any('keras' in s.class_name.lower() or 'tf' in s.class_name.lower()
                            or 'torch' in s.class_name.lower() or 'sequential' in s.class_name.lower()
                            for s in steps)
        has_boost     = any(any(x in s.class_name.lower() for x in ['xgb','lgbm','catboost','boost'])
                            for s in steps)
        if has_nn:        return "Deep Learning Pipeline"
        if has_resampler: return "Imbalanced Learning Pipeline (imblearn)"
        if has_boost:     return "Gradient Boosting Pipeline"
        return "Standard sklearn Pipeline"

    def _recommendations(self, violations: List[PipelineViolation], steps: List[PipelineStep]) -> List[str]:
        recs = []
        types = {v.violation_type for v in violations}
        if not violations:
            recs.append("✅ Pipeline structure looks correct. Leakage is unlikely from pipeline ordering.")
            recs.append("🔍 Still run dataset-level detection to catch feature-level leakage.")
            return recs
        if 'ScalerFittedOnFullData' in types or 'ScalerBeforeImputer' in types:
            recs.append("🔑 Core fix: Always use sklearn Pipeline so transformers are fitted only on X_train.")
        if 'ResamplerWithoutEstimator' in types:
            recs.append("⚖️ Use imblearn.pipeline.Pipeline (not sklearn) to safely include SMOTE inside cross-validation.")
        if 'TargetEncoderLeakage' in types:
            recs.append("🎯 Replace target encoding with cross-validated target encoding or one-hot encoding.")
        if 'EstimatorNotLast' in types:
            recs.append("📐 Move the estimator to be the final step — sklearn Pipeline requires this.")
        if 'FeatureSelectionAfterEstimator' in types:
            recs.append("🔍 Feature selection must precede the estimator to avoid data snooping.")
        recs.append("📋 Validate your pipeline with LeakShield dataset scan after fixing structural issues.")
        recs.append("🚀 Use cross_validate() instead of train_test_split() to verify per-fold leakage absence.")
        return recs
