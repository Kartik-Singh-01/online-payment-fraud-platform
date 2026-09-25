"""
SQLite database helpers. Plain `sqlite3` is used (no SQLAlchemy needed for
this size). Connections return rows as `sqlite3.Row` so route code can use
dict-style access.

Tables:
    users
        id, username, email, password_hash, created_at
    transactions
        id, user_id, amount, merchant_id, location, device_type,
        hour_of_day, is_weekend, location_risk_score, transaction_velocity,
        distance_from_home, merchant_category, timestamp,
        is_fraud, risk_score, status, flagged_features (json),
        analyst_decision, reviewed_at
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Final, Iterator

from dotenv import load_dotenv

load_dotenv()

ROOT: Final[Path] = Path(__file__).resolve().parent
DEFAULT_DB_PATH: Final[Path] = ROOT / "fraud.db"
DB_PATH: Final[Path] = Path(os.getenv("DATABASE_URL", str(DEFAULT_DB_PATH)))


def get_connection() -> sqlite3.Connection:
    """Open a new connection. Caller is responsible for closing it."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    """Context-managed connection that commits/closes correctly."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    with connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT NOT NULL UNIQUE,
                email           TEXT NOT NULL UNIQUE,
                password_hash   TEXT NOT NULL,
                created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id                 TEXT NOT NULL,
                amount                  REAL NOT NULL,
                merchant_id             TEXT NOT NULL,
                merchant_category       TEXT NOT NULL,
                location                TEXT,
                device_type             TEXT NOT NULL,
                hour_of_day             INTEGER NOT NULL,
                is_weekend              INTEGER NOT NULL,
                location_risk_score     REAL NOT NULL,
                transaction_velocity    INTEGER NOT NULL,
                distance_from_home      REAL NOT NULL,
                timestamp               TEXT NOT NULL,
                is_fraud                INTEGER NOT NULL DEFAULT 0,
                risk_score              REAL NOT NULL DEFAULT 0,
                status                  TEXT NOT NULL DEFAULT 'SAFE',
                flagged_features        TEXT,
                analyst_decision        TEXT,
                reviewed_at             TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
            CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp);
            CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_id);
            """
        )
