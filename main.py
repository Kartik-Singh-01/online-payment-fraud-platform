"""
FastAPI application entry point.

Wires up:
- CORS for the Vite dev frontend (http://localhost:5173)
- Logging configuration
- All route modules
- Database initialization on startup

Run:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes.alerts import alerts_router, models_router, reports_router
from routes.auth import router as auth_router
from routes.dashboard import router as dashboard_router
from routes.transactions import router as transactions_router

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fraud_detection")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database on startup."""
    logger.info("Starting fraud detection API")
    init_db()
    logger.info("Database ready")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Fraud Detection API",
    description="ML-powered fraud detection for David's e-commerce platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — Vite dev server defaults plus a configurable env override.
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(dashboard_router)
app.include_router(alerts_router)
app.include_router(models_router)
app.include_router(reports_router)


@app.get("/", tags=["health"])
async def root() -> dict[str, str]:
    """Lightweight health-check endpoint."""
    return {"status": "ok", "service": "fraud-detection-api"}
