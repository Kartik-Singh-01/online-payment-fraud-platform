"""
Alert management routes plus model-performance and CSV export endpoints.

GET /alerts                     -> filterable list of flagged transactions
GET /alerts/{id}                -> single alert detail
GET /models/performance         -> precision/recall/f1/roc_auc + confusion matrix
GET /reports/export             -> CSV export of filtered transactions
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from auth import get_current_user
from database import connection
from ml.evaluate import load_metrics

logger = logging.getLogger(__name__)
alerts_router = APIRouter(prefix="/alerts", tags=["alerts"])
models_router = APIRouter(prefix="/models", tags=["models"])
reports_router = APIRouter(prefix="/reports", tags=["reports"])


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@alerts_router.get("")
async def list_alerts(
    min_risk: float = Query(0.0, ge=0.0, le=1.0),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return flagged transactions with optional filters."""
    where = ["risk_score >= ?"]
    params: list[Any] = [min_risk]

    if status_filter:
        where.append("status = ?")
        params.append(status_filter)
    else:
        # Default: only flagged or under-review transactions are "alerts".
        where.append("status IN ('ALERT', 'UNDER_REVIEW', 'CONFIRMED_FRAUD')")

    if start_date:
        where.append("substr(timestamp, 1, 10) >= ?")
        params.append(start_date)
    if end_date:
        where.append("substr(timestamp, 1, 10) <= ?")
        params.append(end_date)

    sql = (
        "SELECT * FROM transactions WHERE "
        + " AND ".join(where)
        + " ORDER BY risk_score DESC, datetime(timestamp) DESC LIMIT ?"
    )
    params.append(limit)

    with connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    return [dict(r) for r in rows]


@alerts_router.get("/{alert_id}")
async def get_alert(
    alert_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Fetch a single alert (transaction) by id."""
    with connection() as conn:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (alert_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return dict(row)


# ---------------------------------------------------------------------------
# Model performance
# ---------------------------------------------------------------------------
@models_router.get("/performance")
async def get_model_performance(
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the persisted training metrics for all three models."""
    try:
        return load_metrics()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# Reports / CSV export
# ---------------------------------------------------------------------------
@reports_router.get("/export")
async def export_transactions(
    fmt: str = Query("csv", alias="format"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: dict = Depends(get_current_user),
) -> StreamingResponse:
    """Stream a CSV (or, if requested, a CSV) of filtered transactions."""
    if fmt.lower() != "csv":
        raise HTTPException(status_code=400, detail="Only CSV export is supported")

    where: list[str] = []
    params: list[Any] = []
    if status_filter:
        where.append("status = ?")
        params.append(status_filter)
    if start_date:
        where.append("substr(timestamp, 1, 10) >= ?")
        params.append(start_date)
    if end_date:
        where.append("substr(timestamp, 1, 10) <= ?")
        params.append(end_date)

    sql = "SELECT * FROM transactions"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY datetime(timestamp) DESC"

    with connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for r in rows:
            writer.writerow(dict(r))
    else:
        buf.write("id,timestamp,amount,merchant_id,status,is_fraud,risk_score\n")

    csv_bytes = buf.getvalue().encode("utf-8")
    filename = f"transactions_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    logger.info("export_csv", extra={"rows": len(rows), "analyst": current_user["username"]})

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
