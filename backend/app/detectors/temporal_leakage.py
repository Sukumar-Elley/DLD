import pandas as pd
import numpy as np
from typing import List, Optional
from scipy.stats import spearmanr
from app.detectors.base import BaseDetector
from app.models.schemas import LeakageViolation, LeakageType, SeverityLevel


class TemporalLeakageDetector(BaseDetector):
    """
    Upgraded v2: Temporal leakage detection with 6 sub-detectors:
    1. Future keyword pattern matching
    2. Temporal ordering violations (multi-date column ordering)
    3. Time-series look-ahead patterns (lag0, lead_, t+)
    4. Rolling window leakage (closed='right' footprints)
    5. Monotonic trend correlation with row index (proxy for time)
    6. Spearman rank correlation with inferred time axis
    """

    FUTURE_KEYWORDS = [
        "future", "next_", "forward", "after_", "post_", "subsequent",
        "end_date", "close_date", "final_date", "resolution", "completion",
        "discharge", "exit_", "termination", "last_value", "final_"
    ]
    DATE_KEYWORDS = [
        "date", "time", "timestamp", "datetime", "created_at", "updated_at",
        "year", "month", "day", "week", "quarter", "period"
    ]
    LOOKAHEAD_PATTERNS = ["_lag0", "lag_0", "lead_", "_t+", "next_", "forecast_", "predicted_", "future_val"]
    ROLLING_PATTERNS   = ["rolling_mean", "rolling_std", "moving_avg", "moving_average",
                          "cumulative_", "running_sum", "cumsum", "ewm_", "exp_smooth"]

    def __init__(self, df, target_column=None, date_column=None):
        super().__init__(df, target_column)
        self.date_column = date_column

    def detect(self) -> List[LeakageViolation]:
        violations = []
        feature_cols = self.get_non_target_columns()

        violations.extend(self._check_future_keywords(feature_cols))
        violations.extend(self._check_lookahead_patterns(feature_cols))
        violations.extend(self._check_rolling_patterns(feature_cols))

        # Resolve date column
        if not self.date_column or self.date_column not in self.df.columns:
            self.date_column = self._infer_date_column()

        if self.date_column:
            violations.extend(self._check_temporal_ordering(feature_cols))
            violations.extend(self._check_spearman_time_correlation(feature_cols))

        violations.extend(self._check_monotonic_trend(feature_cols))
        return violations

    # ── 1. Future keywords ────────────────────────────────────────────────────
    def _check_future_keywords(self, cols) -> List[LeakageViolation]:
        out = []
        for col in cols:
            matched = [kw for kw in self.FUTURE_KEYWORDS if kw in col.lower()]
            if matched:
                out.append(LeakageViolation(
                    leakage_type=LeakageType.TEMPORAL_LEAKAGE,
                    affected_feature=col,
                    severity=SeverityLevel.HIGH,
                    severity_score=0.78,
                    detector_name="TemporalLeakage/FutureKeyword",
                    confidence=0.70,
                    description=(
                        f"Feature '{col}' contains future-indicative keyword(s): {matched}. "
                        f"These naming patterns suggest the feature encodes post-event information "
                        f"unavailable at the time of prediction."
                    ),
                    remediation=(
                        f"Verify the timestamp at which '{col}' becomes available relative to the "
                        f"prediction point. Remove if recorded after the event being predicted."
                    ),
                    statistical_evidence={'matched_keywords': matched}
                ))
        return out

    # ── 2. Look-ahead bias patterns ───────────────────────────────────────────
    def _check_lookahead_patterns(self, cols) -> List[LeakageViolation]:
        out = []
        for col in cols:
            matched = [p for p in self.LOOKAHEAD_PATTERNS if p in col.lower()]
            if matched:
                out.append(LeakageViolation(
                    leakage_type=LeakageType.TEMPORAL_LEAKAGE,
                    affected_feature=col,
                    severity=SeverityLevel.CRITICAL,
                    severity_score=0.92,
                    detector_name="TemporalLeakage/LookAhead",
                    confidence=0.85,
                    description=(
                        f"Feature '{col}' matches look-ahead bias pattern(s): {matched}. "
                        f"Lag-0, lead, t+ features directly reference the current or future "
                        f"observation — a textbook source of temporal leakage in time-series pipelines."
                    ),
                    remediation=(
                        f"Replace '{col}' with properly lagged variants (lag-1, lag-2). "
                        f"Ensure all time-series features use only past observations relative "
                        f"to the prediction timestamp. Use pandas .shift(1) to create safe lags."
                    ),
                    statistical_evidence={'lookahead_patterns': matched}
                ))
        return out

    # ── 3. Rolling/window patterns ────────────────────────────────────────────
    def _check_rolling_patterns(self, cols) -> List[LeakageViolation]:
        out = []
        for col in cols:
            matched = [p for p in self.ROLLING_PATTERNS if p in col.lower()]
            if matched:
                out.append(LeakageViolation(
                    leakage_type=LeakageType.TEMPORAL_LEAKAGE,
                    affected_feature=col,
                    severity=SeverityLevel.MEDIUM,
                    severity_score=0.62,
                    detector_name="TemporalLeakage/RollingWindow",
                    confidence=0.65,
                    description=(
                        f"Feature '{col}' appears to be a rolling/cumulative aggregate. "
                        f"If computed with closed='right' (the default), it includes the current "
                        f"timestep's value in its own window — introducing look-ahead bias."
                    ),
                    remediation=(
                        f"Shift rolling features by one period before using them as inputs:\n"
                        f"  df['{col}'] = df[source_col].rolling(window).mean().shift(1)\n"
                        f"Or use closed='left': .rolling(window, closed='left').mean()"
                    ),
                    statistical_evidence={'rolling_patterns': matched}
                ))
        return out

    # ── 4. Temporal ordering violations ──────────────────────────────────────
    def _check_temporal_ordering(self, cols) -> List[LeakageViolation]:
        out = []
        try:
            ref = pd.to_datetime(self.df[self.date_column], infer_datetime_format=True, errors='coerce')
            if ref.isna().mean() > 0.5:
                return out
            for col in cols:
                if col == self.date_column:
                    continue
                if not any(kw in col.lower() for kw in self.DATE_KEYWORDS):
                    continue
                try:
                    other = pd.to_datetime(self.df[col], infer_datetime_format=True, errors='coerce')
                    if other.isna().mean() > 0.5:
                        continue
                    fwd_ratio = float((other > ref).mean())
                    if fwd_ratio > 0.55:
                        sev = SeverityLevel.CRITICAL if fwd_ratio > 0.80 else SeverityLevel.HIGH
                        out.append(LeakageViolation(
                            leakage_type=LeakageType.TEMPORAL_LEAKAGE,
                            affected_feature=col,
                            severity=sev,
                            severity_score=round(fwd_ratio, 4),
                            detector_name="TemporalLeakage/DateOrdering",
                            confidence=round(fwd_ratio, 3),
                            description=(
                                f"Date column '{col}' is chronologically AFTER the reference "
                                f"date '{self.date_column}' in {fwd_ratio*100:.1f}% of records. "
                                f"This strongly suggests '{col}' records a post-event timestamp "
                                f"that would not be known at prediction time."
                            ),
                            remediation=(
                                f"Remove '{col}' or replace it with a time-delta feature:\n"
                                f"  df['days_delta'] = (df['{col}'] - df['{self.date_column}']).dt.days\n"
                                f"Ensure temporal train/test splits use time-based (not random) splitting."
                            ),
                            statistical_evidence={
                                'forward_date_ratio': round(fwd_ratio, 4),
                                'reference_col': self.date_column,
                            }
                        ))
                except Exception:
                    pass
        except Exception:
            pass
        return out

    # ── 5. Spearman correlation with time axis ────────────────────────────────
    def _check_spearman_time_correlation(self, cols) -> List[LeakageViolation]:
        """
        If a feature has very high Spearman correlation with the time axis,
        it may be a cumulative feature incorporating future values.
        """
        out = []
        try:
            time_series = pd.to_datetime(self.df[self.date_column], infer_datetime_format=True, errors='coerce')
            if time_series.isna().mean() > 0.5:
                return out
            time_rank = time_series.rank()
            numeric_cols = [c for c in cols if c != self.date_column and
                            pd.api.types.is_numeric_dtype(self.df[c])]
            for col in numeric_cols[:30]:
                try:
                    feat = self.df[col].dropna()
                    common = time_rank.index.intersection(feat.index)
                    if len(common) < 20:
                        continue
                    rho, p = spearmanr(time_rank[common].values, feat[common].values)
                    rho = abs(float(rho))
                    if rho > 0.90 and p < 0.01:
                        out.append(LeakageViolation(
                            leakage_type=LeakageType.TEMPORAL_LEAKAGE,
                            affected_feature=col,
                            severity=SeverityLevel.HIGH,
                            severity_score=round(rho, 4),
                            detector_name="TemporalLeakage/SpearmanTime",
                            confidence=round(rho, 3),
                            description=(
                                f"Feature '{col}' has a very high Spearman rank correlation "
                                f"with the time axis (ρ={rho:.4f}, p={p:.4e}). "
                                f"This pattern is typical of cumulative sums or running totals "
                                f"that incorporate future data points."
                            ),
                            remediation=(
                                f"Replace cumulative '{col}' with period-level (non-cumulative) "
                                f"values. If it's a running total, use the period delta instead."
                            ),
                            statistical_evidence={'spearman_rho': round(rho, 4), 'p_value': float(p)}
                        ))
                except Exception:
                    pass
        except Exception:
            pass
        return out

    # ── 6. Monotonic trend (no explicit time col) ─────────────────────────────
    def _check_monotonic_trend(self, cols) -> List[LeakageViolation]:
        out = []
        numeric_cols = [c for c in cols if pd.api.types.is_numeric_dtype(self.df[c])]
        for col in numeric_cols[:25]:
            try:
                s = self.df[col].dropna().reset_index(drop=True)
                if len(s) < 30:
                    continue
                mono_score = s.is_monotonic_increasing or s.is_monotonic_decreasing
                if mono_score:
                    # Perfect monotone — strong signal
                    rho, _ = spearmanr(np.arange(len(s)), s.values)
                    rho = abs(float(rho))
                    if rho > 0.98:
                        out.append(LeakageViolation(
                            leakage_type=LeakageType.TEMPORAL_LEAKAGE,
                            affected_feature=col,
                            severity=SeverityLevel.MEDIUM,
                            severity_score=round(rho, 4),
                            detector_name="TemporalLeakage/MonotonicTrend",
                            confidence=0.60,
                            description=(
                                f"Feature '{col}' is perfectly monotonic (Spearman ρ={rho:.4f}), "
                                f"suggesting it may be a row index, cumulative count, or sequential ID "
                                f"that encodes temporal order — potentially a proxy for time leakage."
                            ),
                            remediation=(
                                f"Verify whether '{col}' is a surrogate for row order or time. "
                                f"If so, remove it — models should not learn temporal position as a feature."
                            ),
                            statistical_evidence={'spearman_rho': round(rho, 4), 'is_monotonic': True}
                        ))
            except Exception:
                pass
        return out

    def _infer_date_column(self) -> Optional[str]:
        for col in self.df.columns:
            if any(kw in col.lower() for kw in self.DATE_KEYWORDS):
                try:
                    parsed = pd.to_datetime(self.df[col].head(50), infer_datetime_format=True, errors='coerce')
                    if parsed.notna().mean() > 0.7:
                        return col
                except Exception:
                    pass
        for col in self.df.select_dtypes(include='object').columns:
            try:
                parsed = pd.to_datetime(self.df[col].head(50), infer_datetime_format=True, errors='coerce')
                if parsed.notna().mean() > 0.8:
                    return col
            except Exception:
                pass
        return None
