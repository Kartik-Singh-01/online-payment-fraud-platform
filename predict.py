"""
Prediction pipeline. Loads the persisted artifacts once at module import
time, then exposes `predict_transaction` for use from the FastAPI route.

The function takes the same logical fields the API receives and returns:
    {
        "is_fraud": bool,
        "risk_score": float,         # 0..1, from RandomForest.predict_proba
        "model_used": "random_forest",
        "flagged_features": [        # top-3 RF importances, with the row's
            {"feature": str,         # actual value attached for the UI
             "importance": float,
             "value": float | str}
        ]
    }

Why RandomForest is the default scorer:
  RF gave the best F1/ROC-AUC during training while still exposing
  feature importances. Logistic Regression and Isolation Forest are
  available for comparison on the model-performance page.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Final

import joblib
import numpy as np
import pandas as pd

ROOT: Final[Path] = Path(__file__).resolve().parent.parent
MODEL_DIR: Final[Path] = ROOT / "ml" / "saved_models"

# Same column lists used during training.
NUMERIC_COLS: Final[list[str]] = [
    "amount",
    "hour_of_day",
    "is_weekend",
    "location_risk_score",
    "transaction_velocity",
    "distance_from_home",
]
CATEGORICAL_COLS: Final[list[str]] = ["merchant_category", "device_type"]

DECISION_THRESHOLD: Final[float] = 0.5


class _Bundle:
    """Lazy holder for the loaded artifacts. Loaded on first use."""

    def __init__(self) -> None:
        self._loaded = False
        self.scaler = None
        self.lr = None
        self.rf = None
        self.iso = None
        self.feature_names: list[str] = []

    def load(self) -> None:
        if self._loaded:
            return
        if not (MODEL_DIR / "random_forest.joblib").exists():
            raise FileNotFoundError(
                f"Trained models not found in {MODEL_DIR}. "
                "Run `python ml/train.py` first."
            )
        self.scaler = joblib.load(MODEL_DIR / "scaler.joblib")
        self.lr = joblib.load(MODEL_DIR / "logistic_regression.joblib")
        self.rf = joblib.load(MODEL_DIR / "random_forest.joblib")
        self.iso = joblib.load(MODEL_DIR / "isolation_forest.joblib")
        self.feature_names = list(joblib.load(MODEL_DIR / "feature_names.joblib"))
        self._loaded = True


_BUNDLE = _Bundle()


def _row_to_feature_vector(transaction: dict[str, Any]) -> tuple[pd.DataFrame, np.ndarray]:
    """
    Apply the same one-hot encoding used in training and align columns.

    Missing dummy columns (e.g., a category not present in this row) are
    filled with 0; extras are dropped. Returns the *unscaled* DataFrame
    (for human-readable feature values) and the scaled numpy array.
    """
    _BUNDLE.load()

    base = {
        "amount": float(transaction.get("amount", 0.0)),
        "hour_of_day": int(transaction.get("hour_of_day", 12)),
        "is_weekend": int(bool(transaction.get("is_weekend", 0))),
        "location_risk_score": float(transaction.get("location_risk_score", 0.2)),
        "transaction_velocity": int(transaction.get("transaction_velocity", 1)),
        "distance_from_home": float(transaction.get("distance_from_home", 5.0)),
        "merchant_category": str(transaction.get("merchant_category", "grocery")),
        "device_type": str(transaction.get("device_type", "mobile")),
    }
    df = pd.DataFrame([base])
    encoded = pd.get_dummies(df, columns=CATEGORICAL_COLS)
    bool_cols = encoded.select_dtypes(include=["bool"]).columns
    encoded[bool_cols] = encoded[bool_cols].astype(int)

    # Align to training-time column order.
    aligned = encoded.reindex(columns=_BUNDLE.feature_names, fill_value=0)
    scaled = _BUNDLE.scaler.transform(aligned.values)
    return aligned, scaled


def predict_transaction(transaction: dict[str, Any]) -> dict[str, Any]:
    """
    Score a single transaction and return the prediction payload.

    `transaction` is a dict with keys:
        amount, hour_of_day, is_weekend, location_risk_score,
        transaction_velocity, distance_from_home,
        merchant_category, device_type
    """
    _BUNDLE.load()
    aligned, scaled = _row_to_feature_vector(transaction)

    risk_score = float(_BUNDLE.rf.predict_proba(scaled)[0, 1])
    is_fraud = risk_score >= DECISION_THRESHOLD

    # Feature importances × per-row magnitude (in scaled space) gives a rough
    # contribution score for *this* transaction.
    importances = np.asarray(_BUNDLE.rf.feature_importances_)
    contributions = importances * np.abs(scaled[0])
    top_idx = np.argsort(contributions)[::-1][:3]

    flagged: list[dict[str, Any]] = []
    for idx in top_idx:
        feat = _BUNDLE.feature_names[idx]
        raw_value = aligned.iloc[0][feat]
        flagged.append(
            {
                "feature": feat,
                "importance": float(importances[idx]),
                "value": (
                    float(raw_value)
                    if isinstance(raw_value, (int, float, np.integer, np.floating))
                    else str(raw_value)
                ),
            }
        )

    return {
        "is_fraud": bool(is_fraud),
        "risk_score": round(risk_score, 4),
        "model_used": "random_forest",
        "flagged_features": flagged,
    }
