from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.data_loader import (
    load_dataset, get_column_info, safe_sample,
    infer_date_columns, infer_target_column
)
from app.models.schemas import UploadResponse
import pandas as pd

router = APIRouter()


@router.post("/", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    dataset_id, df = await load_dataset(file)
    dtypes = get_column_info(df)
    sample = safe_sample(df, n=5)

    inferred_target = infer_target_column(df)
    inferred_dates = infer_date_columns(df)
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    return UploadResponse(
        dataset_id=dataset_id,
        filename=file.filename,
        total_rows=len(df),
        total_columns=len(df.columns),
        columns=list(df.columns),
        dtypes=dtypes,
        sample_data=sample,
        inferred_target=inferred_target,
        inferred_date_columns=inferred_dates,
        numeric_columns=numeric_cols,
        categorical_columns=cat_cols,
        message=f"Loaded {len(df):,} rows × {len(df.columns)} cols. Suggested target: '{inferred_target}'."
    )
