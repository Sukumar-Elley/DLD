import pandas as pd
import numpy as np
from typing import List, Dict
from app.models.schemas import FeatureProfile


def profile_dataset(df: pd.DataFrame, violations: list) -> List[FeatureProfile]:
    """Build a per-feature profile for the report dashboard."""
    # Map violations by feature name
    violation_map: Dict[str, list] = {}
    for v in violations:
        feat = v.affected_feature.split(" ↔ ")[0].split(": ")[-1].strip()
        # For cluster violations, try to extract first feature name
        if "Cluster:" in v.affected_feature:
            parts = v.affected_feature.replace("Cluster:", "").split(",")
            for p in parts:
                key = p.strip().rstrip("...")
                if key:
                    violation_map.setdefault(key, []).append(v)
        else:
            violation_map.setdefault(feat, []).append(v)

    profiles = []
    for col in df.columns:
        series = df[col]
        null_ratio = float(series.isnull().mean())
        unique_ratio = float(series.nunique() / max(len(series), 1))
        dtype = str(series.dtype)

        mean_val = std_val = min_val = max_val = None
        if pd.api.types.is_numeric_dtype(series):
            clean = series.dropna()
            if len(clean) > 0:
                mean_val = round(float(clean.mean()), 4)
                std_val = round(float(clean.std()), 4)
                min_val = round(float(clean.min()), 4)
                max_val = round(float(clean.max()), 4)

        col_violations = violation_map.get(col, [])
        max_sev = None
        if col_violations:
            order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
            max_sev = max(col_violations, key=lambda v: order.get(v.severity, 0)).severity

        profiles.append(FeatureProfile(
            name=col,
            dtype=dtype,
            null_ratio=round(null_ratio, 4),
            unique_ratio=round(unique_ratio, 4),
            mean=mean_val,
            std=std_val,
            min_val=min_val,
            max_val=max_val,
            violation_count=len(col_violations),
            max_severity=str(max_sev) if max_sev else None,
        ))
    return profiles
