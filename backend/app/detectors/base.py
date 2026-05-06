from abc import ABC, abstractmethod
from typing import List
import pandas as pd
from app.models.schemas import LeakageViolation

class BaseDetector(ABC):
    """Abstract base class for all leakage detectors."""

    def __init__(self, df: pd.DataFrame, target_column: str = None):
        self.df = df
        self.target_column = target_column
        self.violations: List[LeakageViolation] = []

    @abstractmethod
    def detect(self) -> List[LeakageViolation]:
        """Run detection and return list of violations."""
        pass

    def get_numeric_columns(self):
        return self.df.select_dtypes(include=["number"]).columns.tolist()

    def get_categorical_columns(self):
        return self.df.select_dtypes(include=["object", "category"]).columns.tolist()

    def get_non_target_columns(self):
        cols = list(self.df.columns)
        if self.target_column and self.target_column in cols:
            cols.remove(self.target_column)
        return cols
