# pyre-ignore-all-errors
import pandas as pd
import numpy as np
import json
import os
import uuid
from typing import Dict, Any, Tuple
from fastapi import UploadFile, HTTPException
from app.core.config import settings

DATASETS: Dict[str, pd.DataFrame] = {}

def generate_id() -> str:
    return str(uuid.uuid4())

async def load_dataset(file: UploadFile) -> Tuple[str, pd.DataFrame]:
    """Load uploaded file into a pandas DataFrame."""
    content = await file.read()
    filename = file.filename.lower()

    # Check file size
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). Max allowed: {settings.MAX_FILE_SIZE_MB} MB."
        )

    try:
        if filename.endswith(".csv"):
            import io
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            import io
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith(".json"):
            import io
            df = pd.read_json(io.BytesIO(content))
        elif filename.endswith(".parquet"):
            import io
            df = pd.read_parquet(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV, Excel, JSON, or Parquet.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    dataset_id = generate_id()
    DATASETS[dataset_id] = df
    return dataset_id, df

def get_dataset(dataset_id: str) -> pd.DataFrame:
    """Retrieve stored dataset by ID."""
    if dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found. Please re-upload.")
    return DATASETS[dataset_id]

def get_column_info(df: pd.DataFrame) -> Dict[str, str]:
    """Return column name -> dtype mapping."""
    return {col: str(df[col].dtype) for col in df.columns}

def infer_target_column(df: pd.DataFrame) -> str:
    """Heuristically infer the most likely target column."""
    target_keywords = ["target", "label", "class", "output", "y", "result",
                       "churn", "fraud", "default", "outcome", "prediction"]
    for col in df.columns:
        if col.lower() in target_keywords:
            return col
    # Fall back to last column
    return df.columns[-1]

def infer_date_columns(df: pd.DataFrame):
    """Identify likely date/timestamp columns."""
    date_cols = []
    date_keywords = ["date", "time", "timestamp", "datetime", "created", "updated", "year", "month"]
    for col in df.columns:
        if any(kw in col.lower() for kw in date_keywords):
            date_cols.append(col)
        elif df[col].dtype == "object":
            try:
                pd.to_datetime(df[col].head(50), infer_datetime_format=True)
                date_cols.append(col)
            except:
                pass
    return date_cols

def safe_sample(df: pd.DataFrame, n: int = 5) -> list:
    """Return safe JSON-serializable sample rows."""
    sample = df.head(n).copy()
    for col in sample.columns:
        if sample[col].dtype == "object":
            sample[col] = sample[col].astype(str)
        elif sample[col].dtype in ["float64", "float32"]:
            sample[col] = sample[col].fillna(0)
    return json.loads(sample.to_json(orient="records"))
