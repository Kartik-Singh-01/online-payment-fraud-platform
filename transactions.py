"""
Transaction routes.

POST /transactions    -> create transaction, run ML prediction, persist result
GET  /transactions    -> paginated list with optional status filter
GET  /transactions/{id}
PATCH /transactions/{id}/review   -> analyst decision
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from database import connection
from ml.predict import predict_transaction
from models.transaction import (
    PaginatedTransactions,
    TransactionCreate,
    TransactionOut,
    TransactionPredictResponse,
    TransactionReview,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _row_to_transaction_out(row: dict[str, Any]) -> TransactionOut:
    """Convert a sqlite3.Row (or dict) to a TransactionOut model."""
    flagged_raw = row.get("flagged_features") or "[]"
    try:
        flagged = json.loads(flagged_raw)
    except (TypeError, json.JSONDecodeError):
        flagged = []
    return TransactionOut(
        id=row["id"],
        user_id=row["user_id"],
        amount=row["amount"],
        merchant_id=row["merchant_id"],
        merchant_category=row["merchant_category"],
        location=row["location"],
        device_type=row["device_type"],
        hour_of_day=row["hour_of_day"],
        is_weekend=bool(row["is_weekend"]),
        location_risk_score=row["location_risk_score"],
        transaction_velocity=row["transaction_velocity"],
        distance_from_home=row["distance_from_home"],
        timestamp=row["timestamp"],
        is_fraud=bool(row["is_fraud"]),
        risk_score=row["risk_score"],
        status=row["status"],
        flagged_features=flagged,
        analyst_decision=row["analyst_decision"],
        reviewed_at=row["reviewed_at"],
    )


def _derive_time_features(ts: datetime) -> tuple[int, int]:
    """Return (hour_of_day, is_weekend) from a timestamp."""
    return ts.hour, int(ts.weekday() >= 5)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=TransactionPredictResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    payload: TransactionCreate,
    current_user: dict = Depends(get_current_user),
) -> TransactionPredictResponse:
    """Create a transaction, immediately score it, persist, and return prediction."""
    ts = payload.timestamp or datetime.utcnow()
    derived_hour, derived_weekend = _derive_time_features(ts)
    hour_of_day = payload.hour_of_day if payload.hour_of_day is not None else derived_hour
    is_weekend = int(payload.is_weekend) if payload.is_weekend is not None else derived_weekend

    feature_dict = {
        "amount": payload.amount,
        "hour_of_day": hour_of_day,
        "is_weekend": is_weekend,
        "merchant_category": payload.merchant_category,
        "device_type": payload.device_type,
        "location_risk_score": payload.location_risk_score,
        "transaction_velocity": payload.transaction_velocity,
        "distance_from_home": payload.distance_from_home,
    }

    try:
        prediction = predict_transaction(feature_dict)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    tx_status = "ALERT" if prediction["is_fraud"] else "SAFE"
    flagged_json = json.dumps(prediction["flagged_features"])

    with connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO transactions (
                user_id, amount, merchant_id, merchant_category, location,
                device_type, hour_of_day, is_weekend, location_risk_score,
                transaction_velocity, distance_from_home, timestamp,
                is_fraud, risk_score, status, flagged_features
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.user_id,
                payload.amount,
                payload.merchant_id,
                payload.merchant_category,
                payload.location,
                payload.device_type,
                hour_of_day,
                is_weekend,
                payload.location_risk_score,
                payload.transaction_velocity,
                payload.distance_from_home,
                ts.isoformat(),
                int(prediction["is_fraud"]),
                prediction["risk_score"],
                tx_status,
                flagged_json,
            ),
        )
        new_id = int(cur.lastrowid)

    logger.info(
        "prediction_complete",
        extra={
            "transaction_id": new_id,
            "is_fraud": prediction["is_fraud"],
            "risk_score": prediction["risk_score"],
            "analyst": current_user["username"],
        },
    )

    return TransactionPredictResponse(
        transaction_id=new_id,
        is_fraud=prediction["is_fraud"],
        risk_score=prediction["risk_score"],
        model_used=prediction["model_used"],
        flagged_features=prediction["flagged_features"],
        status=tx_status,
    )


@router.get("", response_model=PaginatedTransactions)
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: dict = Depends(get_current_user),
) -> PaginatedTransactions:
    """Return a paginated list of transactions, newest first."""
    where = ""
    params: list[Any] = []
    if status_filter:
        where = "WHERE status = ?"
        params.append(status_filter)

    offset = (page - 1) * limit

    with connection() as conn:
        total_row = conn.execute(
            f"SELECT COUNT(*) AS c FROM transactions {where}", params
        ).fetchone()
        total = int(total_row["c"])

        rows = conn.execute(
            f"""
            SELECT * FROM transactions {where}
            ORDER BY datetime(timestamp) DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

    items = [_row_to_transaction_out(dict(r)) for r in rows]
    return PaginatedTransactions(items=items, total=total, page=page, limit=limit)


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: int,
    current_user: dict = Depends(get_current_user),
) -> TransactionOut:
    """Fetch a single transaction by id."""
    with connection() as conn:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _row_to_transaction_out(dict(row))


@router.patch("/{transaction_id}/review", response_model=TransactionOut)
async def review_transaction(
    transaction_id: int,
    payload: TransactionReview,
    current_user: dict = Depends(get_current_user),
) -> TransactionOut:
    """Apply an analyst decision (approve | reject | investigate) to a transaction."""
    new_status_map = {
        "approve": "APPROVED",
        "reject": "CONFIRMED_FRAUD",
        "investigate": "UNDER_REVIEW",
    }
    new_status = new_status_map[payload.action]
    decision_note = (
        f"{payload.action.upper()} by {current_user['username']}"
        + (f": {payload.note}" if payload.note else "")
    )
    reviewed_at = datetime.utcnow().isoformat()

    with connection() as conn:
        cur = conn.execute(
            """
            UPDATE transactions
               SET status = ?, analyst_decision = ?, reviewed_at = ?
             WHERE id = ?
            """,
            (new_status, decision_note, reviewed_at, transaction_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (transaction_id,)
        ).fetchone()

    logger.info(
        "analyst_decision",
        extra={
            "transaction_id": transaction_id,
            "action": payload.action,
            "analyst": current_user["username"],
        },
    )
    return _row_to_transaction_out(dict(row))
