"""Transaction Pydantic schemas (request/response shapes)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# Aligned with the encoders used during training.
MerchantCategory = Literal[
    "grocery",
    "electronics",
    "fashion",
    "travel",
    "digital_goods",
    "restaurant",
    "gas_station",
    "jewelry",
]
DeviceType = Literal["mobile", "desktop", "tablet", "unknown"]
TransactionStatus = Literal["SAFE", "ALERT", "UNDER_REVIEW", "CONFIRMED_FRAUD", "APPROVED"]
AnalystAction = Literal["approve", "reject", "investigate"]


class FlaggedFeature(BaseModel):
    feature: str
    importance: float
    value: float | str


class TransactionCreate(BaseModel):
    """Payload accepted by POST /transactions."""

    amount: float = Field(..., gt=0, description="Transaction amount in USD")
    merchant_id: str = Field(..., min_length=1, max_length=64)
    user_id: str = Field(..., min_length=1, max_length=64)
    location: Optional[str] = Field(default=None, max_length=128)
    device_type: DeviceType = "mobile"
    timestamp: Optional[datetime] = None

    # Optional engineered features. If not supplied, sensible defaults are used.
    merchant_category: MerchantCategory = "grocery"
    hour_of_day: Optional[int] = Field(default=None, ge=0, le=23)
    is_weekend: Optional[bool] = None
    location_risk_score: float = Field(default=0.2, ge=0.0, le=1.0)
    transaction_velocity: int = Field(default=1, ge=0, le=100)
    distance_from_home: float = Field(default=5.0, ge=0.0)

    @field_validator("amount")
    @classmethod
    def _round_amount(cls, v: float) -> float:
        return round(v, 2)


class TransactionOut(BaseModel):
    id: int
    user_id: str
    amount: float
    merchant_id: str
    merchant_category: str
    location: Optional[str]
    device_type: str
    hour_of_day: int
    is_weekend: bool
    location_risk_score: float
    transaction_velocity: int
    distance_from_home: float
    timestamp: datetime
    is_fraud: bool
    risk_score: float
    status: TransactionStatus
    flagged_features: list[FlaggedFeature] = []
    analyst_decision: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class TransactionPredictResponse(BaseModel):
    """Response for POST /transactions."""

    transaction_id: int
    is_fraud: bool
    risk_score: float
    model_used: str
    flagged_features: list[FlaggedFeature]
    status: TransactionStatus


class TransactionReview(BaseModel):
    """Payload for PATCH /transactions/{id}/review."""

    action: AnalystAction
    note: Optional[str] = Field(default=None, max_length=500)


class PaginatedTransactions(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    limit: int
