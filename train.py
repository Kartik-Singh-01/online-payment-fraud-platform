"""
Training pipeline for the fraud detection models.

Why these models?
- LogisticRegression: a strong, calibrated, interpretable baseline that
  produces meaningful probability scores out of the box.
- RandomForestClassifier: a non-linear ensemble that handles mixed feature
  types and exposes feature importances — useful for the "flagged features"
  shown to the analyst.
- IsolationForest: an unsupervised anomaly detector. It is trained without
  the label and provides a complementary signal: even if a transaction looks
  legitimate to a supervised model, an anomaly score is informative.

Class imbalance:
  Fraud rate is ~3%. We use SMOTE on the *training* split only (never on
  the held-out test set) so we don't leak synthetic minority samples into
  evaluation.

Run:  python ml/train.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Final

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ---------------------------------------------------------------------------
# Paths and constants
# ---------------------------------------------------------------------------
ROOT: Final[Path] = Path(__file__).resolve().parent.parent
DATA_PATH: Final[Path] = ROOT / "data" / "transactions.csv"
MODEL_DIR: Final[Path] = ROOT / "ml" / "saved_models"
METRICS_PATH: Final[Path] = MODEL_DIR / "metrics.json"

NUMERIC_COLS: Final[list[str]] = [
    "amount",
    "hour_of_day",
    "is_weekend",
    "location_risk_score",
    "transaction_velocity",
    "distance_from_home",
]

CATEGORICAL_COLS: Final[list[str]] = ["merchant_category", "device_type"]

RANDOM_STATE: Final[int] = 42


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------
def build_feature_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """One-hot encode the categorical columns and return (X, ordered_feature_names)."""
    X = pd.get_dummies(df[NUMERIC_COLS + CATEGORICAL_COLS], columns=CATEGORICAL_COLS)
    # Cast bool dummy columns to int for downstream scalers/models.
    bool_cols = X.select_dtypes(include=["bool"]).columns
    X[bool_cols] = X[bool_cols].astype(int)
    return X, list(X.columns)


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------
def _evaluate(y_true: np.ndarray, y_pred: np.ndarray, y_proba: np.ndarray) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_proba)),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


# ---------------------------------------------------------------------------
# Main training entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"{DATA_PATH} not found. Run `python data/generate_data.py` first."
        )

    print(f"[train] loading {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)

    X, feature_names = build_feature_frame(df)
    y = df["is_fraud"].astype(int).values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # SMOTE on the training set only.
    smote = SMOTE(random_state=RANDOM_STATE)
    X_train_bal, y_train_bal = smote.fit_resample(X_train_scaled, y_train)
    print(
        f"[train] training rows after SMOTE: {len(y_train_bal)} "
        f"(fraud={int(y_train_bal.sum())})"
    )

    metrics: dict[str, dict] = {}

    # -- Logistic Regression --------------------------------------------------
    print("\n[train] fitting LogisticRegression")
    lr = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
    lr.fit(X_train_bal, y_train_bal)
    lr_proba = lr.predict_proba(X_test_scaled)[:, 1]
    lr_pred = (lr_proba >= 0.5).astype(int)
    metrics["logistic_regression"] = _evaluate(y_test, lr_pred, lr_proba)
    print(classification_report(y_test, lr_pred, digits=3))
    print(f"  ROC-AUC: {metrics['logistic_regression']['roc_auc']:.4f}")

    # -- Random Forest --------------------------------------------------------
    print("\n[train] fitting RandomForestClassifier")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    rf.fit(X_train_bal, y_train_bal)
    rf_proba = rf.predict_proba(X_test_scaled)[:, 1]
    rf_pred = (rf_proba >= 0.5).astype(int)
    metrics["random_forest"] = _evaluate(y_test, rf_pred, rf_proba)
    print(classification_report(y_test, rf_pred, digits=3))
    print(f"  ROC-AUC: {metrics['random_forest']['roc_auc']:.4f}")

    # Persist feature importances, sorted, for the UI.
    importances = sorted(
        [{"feature": f, "importance": float(i)}
         for f, i in zip(feature_names, rf.feature_importances_)],
        key=lambda r: r["importance"],
        reverse=True,
    )
    metrics["random_forest"]["feature_importances"] = importances

    # -- Isolation Forest -----------------------------------------------------
    print("\n[train] fitting IsolationForest")
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.03,
        random_state=RANDOM_STATE,
    )
    # Trained on legitimate-only training data (unsupervised anomaly model).
    iso.fit(X_train_scaled[y_train == 0])
    # decision_function: higher = more normal. Invert + min-max for a 0..1 risk.
    iso_decision = iso.decision_function(X_test_scaled)
    iso_proba = (iso_decision.max() - iso_decision) / (
        iso_decision.max() - iso_decision.min() + 1e-9
    )
    iso_pred = (iso.predict(X_test_scaled) == -1).astype(int)
    metrics["isolation_forest"] = _evaluate(y_test, iso_pred, iso_proba)
    print(classification_report(y_test, iso_pred, digits=3))
    print(f"  ROC-AUC: {metrics['isolation_forest']['roc_auc']:.4f}")

    # ---------------------------------------------------------------------
    # Persist artifacts.
    # ---------------------------------------------------------------------
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(scaler, MODEL_DIR / "scaler.joblib")
    joblib.dump(lr, MODEL_DIR / "logistic_regression.joblib")
    joblib.dump(rf, MODEL_DIR / "random_forest.joblib")
    joblib.dump(iso, MODEL_DIR / "isolation_forest.joblib")
    joblib.dump(feature_names, MODEL_DIR / "feature_names.joblib")

    with METRICS_PATH.open("w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\n[train] saved models to {MODEL_DIR}")
    print(f"[train] saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
