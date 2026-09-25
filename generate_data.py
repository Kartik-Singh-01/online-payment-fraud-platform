"""
Synthetic transaction data generator for the fraud detection ML pipeline.

Generates a CSV of ~5000 transactions with engineered features and a
~3% fraud rate. Fraudulent rows have biased distributions (high amounts at
unusual hours, distant locations, high velocity) so a realistic classifier
can learn the signal.

Run:  python data/generate_data.py
Output: backend/data/transactions.csv
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
N_ROWS: Final[int] = 5000
FRAUD_RATE: Final[float] = 0.03
RANDOM_SEED: Final[int] = 42

MERCHANT_CATEGORIES: Final[list[str]] = [
    "grocery",
    "electronics",
    "fashion",
    "travel",
    "digital_goods",
    "restaurant",
    "gas_station",
    "jewelry",
]

DEVICE_TYPES: Final[list[str]] = ["mobile", "desktop", "tablet", "unknown"]


def _generate_legit_rows(n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Generate `n` legitimate transactions with realistic distributions."""
    return pd.DataFrame(
        {
            "amount": np.round(rng.gamma(shape=2.0, scale=40.0, size=n), 2),
            "hour_of_day": rng.choice(range(24), size=n, p=_daytime_weights()),
            "is_weekend": rng.choice([0, 1], size=n, p=[0.72, 0.28]),
            "merchant_category": rng.choice(MERCHANT_CATEGORIES, size=n),
            "device_type": rng.choice(DEVICE_TYPES, size=n, p=[0.55, 0.30, 0.10, 0.05]),
            "location_risk_score": np.clip(rng.normal(0.20, 0.12, size=n), 0.0, 1.0),
            "transaction_velocity": rng.poisson(lam=2.0, size=n),
            "distance_from_home": np.round(np.abs(rng.normal(8.0, 12.0, size=n)), 2),
            "is_fraud": 0,
        }
    )


def _generate_fraud_rows(n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Generate `n` fraudulent transactions with a deliberately skewed profile.

    Distributions are intentionally overlapping with the legitimate class so
    that classifiers face a realistic (non-trivially-separable) problem.
    Fraud rows still have meaningfully higher risk features on average, but
    Logistic Regression should *not* achieve perfect test-set metrics.
    """
    return pd.DataFrame(
        {
            # Mean ~$125 vs legit ~$80 — elevated but not orders-of-magnitude apart.
            "amount": np.round(rng.gamma(shape=2.5, scale=50.0, size=n), 2),
            "hour_of_day": rng.choice(range(24), size=n, p=_nighttime_weights()),
            "is_weekend": rng.choice([0, 1], size=n, p=[0.45, 0.55]),
            "merchant_category": rng.choice(
                MERCHANT_CATEGORIES,
                size=n,
                # Fraud is over-represented in high-ticket / digital categories.
                p=[0.05, 0.20, 0.10, 0.20, 0.20, 0.05, 0.05, 0.15],
            ),
            "device_type": rng.choice(DEVICE_TYPES, size=n, p=[0.30, 0.25, 0.10, 0.35]),
            # Mean 0.55, std 0.22 — overlaps meaningfully with legit (mean 0.20, std 0.12).
            "location_risk_score": np.clip(rng.normal(0.55, 0.22, size=n), 0.0, 1.0),
            # Poisson mean 4 vs legit mean 2 — elevated but not 4× apart.
            "transaction_velocity": rng.poisson(lam=4.0, size=n),
            # Mean ~50 km, std 40 km — overlaps with legit (mean ~8 km) via the tail.
            "distance_from_home": np.round(np.abs(rng.normal(50.0, 40.0, size=n)), 2),
            "is_fraud": 1,
        }
    )


def _daytime_weights() -> np.ndarray:
    """Hour-of-day weights skewed toward business hours (legitimate traffic)."""
    weights = np.array(
        [0.5, 0.3, 0.2, 0.2, 0.3, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 5.5,
         6.0, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0],
        dtype=float,
    )
    return weights / weights.sum()


def _nighttime_weights() -> np.ndarray:
    """Hour-of-day weights skewed toward late-night/early-morning (fraud)."""
    weights = np.array(
        [3.0, 4.0, 4.5, 5.0, 4.5, 4.0, 3.0, 2.0, 1.5, 1.0, 1.0, 1.0,
         1.0, 1.0, 1.0, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.0, 3.5],
        dtype=float,
    )
    return weights / weights.sum()


def generate_dataset(
    n_rows: int = N_ROWS,
    fraud_rate: float = FRAUD_RATE,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    """Generate a synthetic transaction dataset and return as a DataFrame."""
    rng = np.random.default_rng(seed)
    n_fraud = int(round(n_rows * fraud_rate))
    n_legit = n_rows - n_fraud

    df = pd.concat(
        [_generate_legit_rows(n_legit, rng), _generate_fraud_rows(n_fraud, rng)],
        ignore_index=True,
    )
    # Shuffle so fraud rows aren't all at the end.
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return df


def main() -> None:
    out_dir = Path(__file__).resolve().parent
    out_path = out_dir / "transactions.csv"
    df = generate_dataset()
    df.to_csv(out_path, index=False)

    n_total = len(df)
    n_fraud = int(df["is_fraud"].sum())
    print(f"[generate_data] wrote {out_path}")
    print(f"[generate_data] rows: {n_total} | fraud: {n_fraud} ({n_fraud / n_total:.2%})")


if __name__ == "__main__":
    main()