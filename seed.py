"""
Seed the SQLite database with a demo analyst user and ~200 demo
transactions. Predictions are run through the trained Random Forest so
the fraud rate / status fields look realistic.

Run:  python seed.py
"""

from __future__ import annotations

import json
import logging
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from auth import hash_password
from database import connection, init_db
from ml.predict import predict_transaction

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")

DEMO_USER = {
    "username": "analyst",
    "email": "analyst@example.com",
    "password": "analyst123",
}

MERCHANTS = [
    "M-AMZN-0001", "M-EBAY-0042", "M-WMRT-0099", "M-TGTC-0211",
    "M-BSTB-0044", "M-NEWC-7732", "M-CSHX-1010", "M-DGTL-9001",
]
MERCHANT_CATEGORIES = [
    "grocery", "electronics", "fashion", "travel",
    "digital_goods", "restaurant", "gas_station", "jewelry",
]
DEVICE_TYPES = ["mobile", "desktop", "tablet", "unknown"]
LOCATIONS = [
    "New York, US", "San Francisco, US", "London, UK", "Berlin, DE",
    "Lagos, NG", "Manila, PH", "Sao Paulo, BR", "Singapore, SG",
]


def _ensure_demo_user() -> None:
    with connection() as conn:
        try:
            conn.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (
                    DEMO_USER["username"],
                    DEMO_USER["email"],
                    hash_password(DEMO_USER["password"]),
                ),
            )
            logger.info("Created demo user 'analyst' (password: analyst123)")
        except sqlite3.IntegrityError:
            logger.info("Demo user already exists, skipping")


def _make_transaction(rng: random.Random, suspicious: bool) -> dict:
    """Return a transaction payload biased toward fraud or legitimate."""
    if suspicious:
        return {
            "amount": round(rng.uniform(300, 2500), 2),
            "merchant_id": rng.choice(MERCHANTS),
            "user_id": f"U-{rng.randint(1000, 9999)}",
            "merchant_category": rng.choice(["digital_goods", "electronics", "jewelry", "travel"]),
            "device_type": rng.choice(["unknown", "desktop", "mobile"]),
            "location": rng.choice(LOCATIONS),
            "hour_of_day": rng.choice([0, 1, 2, 3, 4, 23]),
            "is_weekend": rng.choice([0, 1]),
            "location_risk_score": round(rng.uniform(0.55, 0.95), 2),
            "transaction_velocity": rng.randint(5, 12),
            "distance_from_home": round(rng.uniform(120, 400), 2),
        }
    return {
        "amount": round(rng.uniform(5, 250), 2),
        "merchant_id": rng.choice(MERCHANTS),
        "user_id": f"U-{rng.randint(1000, 9999)}",
        "merchant_category": rng.choice(MERCHANT_CATEGORIES),
        "device_type": rng.choice(["mobile", "desktop", "tablet"]),
        "location": rng.choice(LOCATIONS),
        "hour_of_day": rng.choice(list(range(7, 23))),
        "is_weekend": rng.choice([0, 1]),
        "location_risk_score": round(rng.uniform(0.05, 0.35), 2),
        "transaction_velocity": rng.randint(0, 3),
        "distance_from_home": round(rng.uniform(0, 30), 2),
    }


def seed_transactions(n: int = 200, fraud_share: float = 0.05) -> None:
    rng = random.Random(7)
    n_fraud = int(n * fraud_share)
    n_legit = n - n_fraud
    plan = [True] * n_fraud + [False] * n_legit
    rng.shuffle(plan)

    now = datetime.utcnow()
    inserted = 0
    flagged = 0

    with connection() as conn:
        for i, suspicious in enumerate(plan):
            tx = _make_transaction(rng, suspicious)
            ts = now - timedelta(minutes=rng.randint(0, 60 * 24 * 6))  # within last 6 days

            try:
                pred = predict_transaction(tx)
            except FileNotFoundError:
                logger.error("Models are missing — run `python ml/train.py` first.")
                return

            tx_status = "ALERT" if pred["is_fraud"] else "SAFE"
            if pred["is_fraud"]:
                flagged += 1

            conn.execute(
                """
                INSERT INTO transactions (
                    user_id, amount, merchant_id, merchant_category, location,
                    device_type, hour_of_day, is_weekend, location_risk_score,
                    transaction_velocity, distance_from_home, timestamp,
                    is_fraud, risk_score, status, flagged_features
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tx["user_id"], tx["amount"], tx["merchant_id"],
                    tx["merchant_category"], tx["location"], tx["device_type"],
                    tx["hour_of_day"], tx["is_weekend"], tx["location_risk_score"],
                    tx["transaction_velocity"], tx["distance_from_home"],
                    ts.isoformat(),
                    int(pred["is_fraud"]), pred["risk_score"], tx_status,
                    json.dumps(pred["flagged_features"]),
                ),
            )
            inserted += 1
    logger.info("Seeded %d transactions (%d flagged)", inserted, flagged)


def main() -> None:
    init_db()
    _ensure_demo_user()
    # Clear any prior demo transactions to keep seeding idempotent.
    with connection() as conn:
        conn.execute("DELETE FROM transactions")
    seed_transactions()
    logger.info("Seed complete.")


if __name__ == "__main__":
    main()