# pyre-ignore-all-errors
"""
Framework Analyzer
==================
Provides framework-specific leakage knowledge for:
  - scikit-learn (Pipeline, ColumnTransformer, cross_validate)
  - XGBoost (DMatrix, early stopping leakage)
  - LightGBM (Dataset, categorical features)
  - CatBoost (Pool, ordered boosting)
  - Keras / TensorFlow (preprocessing layers, data generators)
  - PyTorch (DataLoader, transforms)
  - MLflow (experiment tracking, artifact paths)
  - Hugging Face Transformers (tokenizer fitting)
"""

from typing import Dict, Any, List
from app.models.schemas import MLFrameworkInfo


FRAMEWORK_KNOWLEDGE: Dict[str, Dict[str, Any]] = {

    "sklearn": {
        "full_name": "scikit-learn",
        "version_field": "sklearn.__version__",
        "pipeline_class": "sklearn.pipeline.Pipeline",
        "leakage_patterns": [
            "Calling .fit_transform() on full dataset before train_test_split",
            "Fitting StandardScaler/MinMaxScaler on X (not X_train)",
            "LabelEncoder applied to full dataset before split",
            "SelectKBest / RFE fitted on full dataset",
            "train_test_split with shuffle=True on time-series data",
            "SimpleImputer fitted on concatenated train+test data",
        ],
        "safe_patterns": [
            "Pipeline([('scaler', StandardScaler()), ('model', ...)])",
            "ColumnTransformer inside Pipeline",
            "cross_validate() with Pipeline (no leakage across folds)",
            "TimeSeriesSplit for temporal data",
            "Pipeline.fit(X_train) → Pipeline.predict(X_test)",
        ],
        "dangerous_calls": [
            "scaler.fit_transform(X)  # ← leaks if X includes test data",
            "encoder.fit_transform(df['col'])  # ← leaks if df is full dataset",
            "selector.fit_transform(X, y)  # ← data snooping if on full dataset",
            "smote.fit_resample(X, y)  # ← leaks if applied before split",
        ],
        "best_practice_code": (
            "from sklearn.pipeline import Pipeline\n"
            "from sklearn.preprocessing import StandardScaler\n"
            "from sklearn.model_selection import train_test_split, cross_validate\n\n"
            "# Split FIRST\n"
            "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)\n\n"
            "# Build Pipeline — transformers fit ONLY on X_train\n"
            "pipe = Pipeline([\n"
            "    ('imputer',  SimpleImputer(strategy='median')),\n"
            "    ('scaler',   StandardScaler()),\n"
            "    ('selector', SelectKBest(f_classif, k=10)),\n"
            "    ('model',    RandomForestClassifier()),\n"
            "])\n\n"
            "pipe.fit(X_train, y_train)   # transformers see ONLY training data\n"
            "pipe.score(X_test, y_test)   # transformers apply learned params to test"
        ),
    },

    "xgboost": {
        "full_name": "XGBoost",
        "version_field": "xgboost.__version__",
        "pipeline_class": "xgboost.XGBClassifier / XGBRegressor",
        "leakage_patterns": [
            "Using eval_set=[(X_test, y_test)] with early_stopping_rounds → leaks test labels into training",
            "DMatrix created from full dataset then split manually — scaler stats from test set contaminate",
            "Feature names fitted from full dataset's column order",
            "Hyperparameter tuning on test set (using test accuracy to select params)",
            "scale_pos_weight computed from full dataset class distribution",
        ],
        "safe_patterns": [
            "Split data BEFORE creating DMatrix",
            "Use eval_set on VALIDATION set (not test set) for early stopping",
            "Wrap XGBClassifier in sklearn Pipeline for preprocessing",
            "Use cross_validate with XGBClassifier for unbiased evaluation",
        ],
        "dangerous_calls": [
            "dtrain = xgb.DMatrix(X, label=y)  # ← if X still contains test rows",
            "xgb.train(params, dtrain, evals=[(dtest, 'test')])  # ← early stopping on test",
            "model.fit(X_train, y_train, eval_set=[(X_test, y_test)], early_stopping_rounds=10)  # ← leaks test",
        ],
        "best_practice_code": (
            "import xgboost as xgb\n"
            "from sklearn.model_selection import train_test_split\n\n"
            "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)\n"
            "X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2)\n\n"
            "# Early stopping on VALIDATION set (never test set)\n"
            "model = xgb.XGBClassifier(n_estimators=1000, early_stopping_rounds=50)\n"
            "model.fit(\n"
            "    X_train, y_train,\n"
            "    eval_set=[(X_val, y_val)],  # ← validation only, test never seen\n"
            "    verbose=False\n"
            ")\n"
            "score = model.score(X_test, y_test)  # final unbiased evaluation"
        ),
    },

    "lightgbm": {
        "full_name": "LightGBM",
        "version_field": "lightgbm.__version__",
        "pipeline_class": "lightgbm.LGBMClassifier / LGBMRegressor",
        "leakage_patterns": [
            "Using valid_sets=[lgb_test] with early stopping — leaks test performance into training",
            "Categorical encoding fitted on full dataset before split",
            "Feature binning boundaries computed from full dataset",
            "callbacks=[early_stopping] with validation on test set",
        ],
        "safe_patterns": [
            "Split data before creating lgb.Dataset objects",
            "Use separate validation set for early stopping",
            "categorical_feature parameter inferred from training data only",
            "Wrap LGBMClassifier in sklearn Pipeline",
        ],
        "dangerous_calls": [
            "lgb_test  = lgb.Dataset(X_test, label=y_test)  # ← then used in valid_sets",
            "lgb.train(params, lgb_train, valid_sets=[lgb_test])  # ← leaks test into training",
        ],
        "best_practice_code": (
            "import lightgbm as lgb\n\n"
            "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)\n"
            "X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.15)\n\n"
            "lgb_train = lgb.Dataset(X_train, label=y_train)\n"
            "lgb_val   = lgb.Dataset(X_val,   label=y_val,   reference=lgb_train)\n\n"
            "model = lgb.train(\n"
            "    params, lgb_train,\n"
            "    valid_sets=[lgb_val],     # ← validation only\n"
            "    callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)]\n"
            ")\n"
            "preds = model.predict(X_test)"
        ),
    },

    "catboost": {
        "full_name": "CatBoost",
        "version_field": "catboost.__version__",
        "pipeline_class": "catboost.CatBoostClassifier / CatBoostRegressor",
        "leakage_patterns": [
            "Pool created from full dataset — categorical statistics learned from test set",
            "eval_set using test Pool — early stopping leaks test information",
            "Text features tokenized on full corpus before split",
        ],
        "safe_patterns": [
            "Create Pool objects from train/validation only",
            "Use ordered boosting mode (default) — reduces internal leakage",
            "Use eval_set from validation Pool, not test Pool",
        ],
        "best_practice_code": (
            "from catboost import CatBoostClassifier, Pool\n\n"
            "train_pool = Pool(X_train, y_train, cat_features=cat_cols)\n"
            "val_pool   = Pool(X_val,   y_val,   cat_features=cat_cols)\n\n"
            "model = CatBoostClassifier(iterations=1000, early_stopping_rounds=50)\n"
            "model.fit(train_pool, eval_set=val_pool, verbose=100)\n"
            "model.score(X_test, y_test)"
        ),
    },

    "keras": {
        "full_name": "Keras / TensorFlow",
        "version_field": "tensorflow.__version__",
        "pipeline_class": "tf.keras.Sequential / Functional API",
        "leakage_patterns": [
            "TextVectorization layer adapted on full dataset including test sequences",
            "Normalization layer adapted on full dataset — mean/variance from test data",
            "tf.keras.utils.image_dataset_from_directory without proper split",
            "Data augmentation applied to validation/test data",
            "Batch normalization statistics computed over validation batches (model.fit with validation_data)",
        ],
        "safe_patterns": [
            "Adapt TextVectorization/Normalization only on training data",
            "Use validation_data (not test data) in model.fit()",
            "Apply augmentation ONLY to training dataset",
            "Use tf.data.Dataset.skip(n_val).take(n_train) for split",
        ],
        "dangerous_calls": [
            "vectorizer.adapt(full_text_dataset)  # ← should be adapt(train_dataset) only",
            "normalizer.adapt(X)  # ← should be adapt(X_train) only",
            "model.fit(X_train, y_train, validation_data=(X_test, y_test))  # ← use val set not test",
        ],
        "best_practice_code": (
            "import tensorflow as tf\n\n"
            "# Always adapt preprocessing layers on TRAINING data only\n"
            "vectorizer = tf.keras.layers.TextVectorization(max_tokens=10000)\n"
            "vectorizer.adapt(train_dataset.map(lambda x, y: x))  # ← training only\n\n"
            "normalizer = tf.keras.layers.Normalization()\n"
            "normalizer.adapt(X_train)  # ← training only\n\n"
            "model = tf.keras.Sequential([normalizer, tf.keras.layers.Dense(1)])\n"
            "model.fit(\n"
            "    X_train, y_train,\n"
            "    validation_data=(X_val, y_val),  # ← validation, not test\n"
            "    epochs=50\n"
            ")"
        ),
    },

    "pytorch": {
        "full_name": "PyTorch",
        "version_field": "torch.__version__",
        "pipeline_class": "torch.utils.data.DataLoader",
        "leakage_patterns": [
            "transforms.Normalize computed from full dataset statistics",
            "Dataset splitting after applying global normalization transform",
            "train=False DataLoader using same normalization as train (acceptable if stats from train)",
            "Data augmentation (RandomCrop, RandomFlip) applied to validation loader",
        ],
        "safe_patterns": [
            "Compute mean/std from training subset only",
            "Use transforms.Normalize(train_mean, train_std) for BOTH train and test",
            "Apply random augmentation only to train DataLoader",
            "Use Subset + random_split to split before applying transforms",
        ],
        "best_practice_code": (
            "import torch\n"
            "from torchvision import datasets, transforms\n\n"
            "# Compute statistics from TRAINING data only\n"
            "raw_train = datasets.CIFAR10(root='data', train=True, download=True,\n"
            "                             transform=transforms.ToTensor())\n"
            "train_data = torch.stack([img for img, _ in raw_train])\n"
            "mean = train_data.mean(dim=[0,2,3])\n"
            "std  = train_data.std(dim=[0,2,3])\n\n"
            "# Apply SAME statistics (from train) to test\n"
            "train_transform = transforms.Compose([\n"
            "    transforms.RandomCrop(32, padding=4),  # augmentation: train only\n"
            "    transforms.ToTensor(),\n"
            "    transforms.Normalize(mean, std),\n"
            "])\n"
            "test_transform = transforms.Compose([\n"
            "    transforms.ToTensor(),\n"
            "    transforms.Normalize(mean, std),  # same stats, no augmentation\n"
            "])"
        ),
    },

    "mlflow": {
        "full_name": "MLflow",
        "version_field": "mlflow.__version__",
        "pipeline_class": "mlflow.sklearn.log_model / mlflow.pyfunc",
        "leakage_patterns": [
            "Logging test metrics during training run — test performance influences model selection",
            "Autolog capturing test_score — visible during hyperparameter tuning",
            "Model registered based on test set performance rather than validation set",
            "Feature importances logged from full-dataset trained model",
        ],
        "safe_patterns": [
            "Log only train and VALIDATION metrics during runs",
            "Use mlflow.evaluate() on held-out test set AFTER model selection",
            "Register models based on validation performance only",
            "Tag runs with 'data_split' metadata for reproducibility",
        ],
        "best_practice_code": (
            "import mlflow\n"
            "import mlflow.sklearn\n\n"
            "with mlflow.start_run():\n"
            "    pipe.fit(X_train, y_train)\n\n"
            "    # Log training and validation metrics ONLY\n"
            "    train_score = pipe.score(X_train, y_train)\n"
            "    val_score   = pipe.score(X_val,   y_val)\n"
            "    mlflow.log_metric('train_accuracy', train_score)\n"
            "    mlflow.log_metric('val_accuracy',   val_score)\n\n"
            "    # Log model\n"
            "    mlflow.sklearn.log_model(pipe, 'model')\n\n"
            "# Only after model SELECTION, evaluate on test\n"
            "# (outside the training loop, as a separate evaluation run)\n"
            "test_score = pipe.score(X_test, y_test)\n"
            "mlflow.log_metric('final_test_accuracy', test_score)"
        ),
    },

    "huggingface": {
        "full_name": "Hugging Face Transformers",
        "version_field": "transformers.__version__",
        "pipeline_class": "transformers.Trainer / pipeline()",
        "leakage_patterns": [
            "Tokenizer trained (not just loaded) on full dataset — vocabulary includes test tokens",
            "Label encoding fitted on full dataset labels before split",
            "Dataset.map() applying normalization statistics from full corpus",
            "Trainer using test split as eval_dataset during training",
        ],
        "safe_patterns": [
            "Use pre-trained tokenizer — vocabulary is fixed, no fitting needed",
            "If training tokenizer, fit ONLY on training split",
            "Use eval_dataset from validation split in Trainer, not test",
            "Compute dataset statistics (mean, std) from training split only",
        ],
        "best_practice_code": (
            "from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer\n\n"
            "# Pre-trained tokenizer: no fitting, no leakage\n"
            "tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')\n\n"
            "# Tokenize splits separately\n"
            "train_enc = tokenizer(train_texts, truncation=True, padding=True)\n"
            "val_enc   = tokenizer(val_texts,   truncation=True, padding=True)\n"
            "test_enc  = tokenizer(test_texts,  truncation=True, padding=True)\n\n"
            "trainer = Trainer(\n"
            "    model          = model,\n"
            "    train_dataset  = train_dataset,\n"
            "    eval_dataset   = val_dataset,   # ← validation only\n"
            "    # test_dataset is NEVER passed to Trainer\n"
            ")"
        ),
    },
}


def get_framework_info(framework: str) -> MLFrameworkInfo:
    """Return framework-specific leakage info and best practices."""
    fw = framework.lower().strip()
    # fuzzy match
    for key in FRAMEWORK_KNOWLEDGE:
        if key in fw or fw in key:
            fw = key
            break

    data = FRAMEWORK_KNOWLEDGE.get(fw, {
        "full_name": framework,
        "leakage_patterns": ["Framework-specific patterns not yet catalogued."],
        "safe_patterns": ["Use sklearn Pipeline as a baseline safe pattern."],
        "best_practice_code": "# Framework not yet in LeakShield knowledge base",
    })

    return MLFrameworkInfo(
        framework     = data.get("full_name", framework),
        version       = data.get("version_field"),
        pipeline_type = data.get("pipeline_class", "Unknown"),
        detected_issues = data.get("leakage_patterns", []),
        best_practices  = data.get("safe_patterns", []),
    )


def get_all_frameworks() -> List[str]:
    return list(FRAMEWORK_KNOWLEDGE.keys())


def get_framework_best_practice(framework: str) -> str:
    fw = framework.lower().strip()
    for key in FRAMEWORK_KNOWLEDGE:
        if key in fw or fw in key:
            fw = key
            break
    return FRAMEWORK_KNOWLEDGE.get(fw, {}).get("best_practice_code",
        "# Framework not in LeakShield knowledge base")


def get_framework_dangerous_calls(framework: str) -> List[str]:
    fw = framework.lower().strip()
    for key in FRAMEWORK_KNOWLEDGE:
        if key in fw or fw in key:
            fw = key
            break
    return FRAMEWORK_KNOWLEDGE.get(fw, {}).get("dangerous_calls", [])
