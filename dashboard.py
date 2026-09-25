"""
Dashboard routes — aggregate stats for the main dashboard page.

GET /dashboard/stats returns:
    {
        "kpis": { total_today, fraud_today, legit_today, fraud_rate },
        "daily_volume": [{ date, fraud, legitimate }, ...]   # last 7 days
        "type_distribution": [{ type, count }, ...]           # by merchant_category
        "top_fraud_merchants": [{ merchant_id, count }, ...]  # top 5
        "recent": [TransactionOut, ...]                       # latest 10
    }
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends

from auth import get_current_user
from database import connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _row_to_recent(row: dict[str, Any]) -> dict[str, Any]:
    """Compact transaction shape used in the dashboard recent list."""
    flagged_raw = row.get("flagged_features") or "[]"
    try:
        flagged = json.loads(flagged_raw)
    except (TypeError, json.JSONDecodeError):
        flagged = []
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "amount": row["amount"],
        "merchant_id": row["merchant_id"],
        "merchant_category": row["merchant_category"],
        "location": row["location"],
        "device_type": row["device_type"],
        "hour_of_day": row["hour_of_day"],
        "is_weekend": bool(row["is_weekend"]),
        "location_risk_score": row["location_risk_score"],
        "transaction_velocity": row["transaction_velocity"],
        "distance_from_home": row["distance_from_home"],
        "timestamp": row["timestamp"],
        "is_fraud": bool(row["is_fraud"]),
        "risk_score": row["risk_score"],
        "status": row["status"],
        "flagged_features": flagged,
        "analyst_decision": row["analyst_decision"],
        "reviewed_at": row["reviewed_at"],
    }


@router.get("/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Return aggregated dashboard statistics for the past 7 days."""
    today = datetime.utcnow().date()
    seven_days_ago = today - timedelta(days=6)

    with connection() as conn:
        today_iso = today.isoformat()
        kpi_row = conn.execute(
            """
            SELECT
                COUNT(*)                                AS total,
                SUM(CASE WHEN is_fraud = 1 THEN 1 ELSE 0 END) AS fraud,
                SUM(CASE WHEN is_fraud = 0 THEN 1 ELSE 0 END) AS legit
            FROM transactions
            WHERE substr(timestamp, 1, 10) = ?
            """,
            (today_iso,),
        ).fetchone()

        total_today = int(kpi_row["total"] or 0)
        fraud_today = int(kpi_row["fraud"] or 0)
        legit_today = int(kpi_row["legit"] or 0)
        fraud_rate = (fraud_today / total_today) if total_today else 0.0

        daily_rows = conn.execute(
            """
            SELECT substr(timestamp, 1, 10) AS day,
                   SUM(CASE WHEN is_fraud = 1 THEN 1 ELSE 0 END) AS fraud,
                   SUM(CASE WHEN is_fraud = 0 THEN 1 ELSE 0 END) AS legitimate
            FROM transactions
            WHERE substr(timestamp, 1, 10) >= ?
            GROUP BY day
            ORDER BY day ASC
            """,
            (seven_days_ago.isoformat(),),
        ).fetchall()
        daily_lookup = {r["day"]: r for r in daily_rows}

        # Always emit 7 days even where there's no data.
        daily_volume = []
        for offset in range(7):
            d = (seven_days_ago + timedelta(days=offset)).isoformat()
            r = daily_lookup.get(d)
            daily_volume.append(
                {
                    "date": d,
                    "fraud": int(r["fraud"]) if r else 0,
                    "legitimate": int(r["legitimate"]) if r else 0,
                }
            )

        type_rows = conn.execute(
            """
            SELECT merchant_category AS type, COUNT(*) AS count
            FROM transactions
            GROUP BY merchant_category
            ORDER BY count DESC
            """
        ).fetchall()
        type_distribution = [{"type": r["type"], "count": int(r["count"])} for r in type_rows]

        top_merchants = conn.execute(
            """
            SELECT merchant_id, COUNT(*) AS count
            FROM transactions
            WHERE is_fraud = 1
            GROUP BY merchant_id
            ORDER BY count DESC
            LIMIT 5
            """
        ).fetchall()
        top_fraud_merchants = [
            {"merchant_id": r["merchant_id"], "count": int(r["count"])}
            for r in top_merchants
        ]

        recent_rows = conn.execute(
            "SELECT * FROM transactions ORDER BY datetime(timestamp) DESC LIMIT 10"
        ).fetchall()
        recent = [_row_to_recent(dict(r)) for r in recent_rows]

    return {
        "kpis": {
            "total_today": total_today,
            "fraud_today": fraud_today,
            "legit_today": legit_today,
            "fraud_rate": round(fraud_rate, 4),
        },
        "daily_volume": daily_volume,
        "type_distribution": type_distribution,
        "top_fraud_merchants": top_fraud_merchants,
        "recent": recent,
    }
