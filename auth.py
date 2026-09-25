"""Authentication routes: register and login."""

from __future__ import annotations

import logging
import sqlite3

from fastapi import APIRouter, HTTPException, status

from auth import create_access_token, hash_password, verify_password
from database import connection
from models.user import TokenResponse, UserLogin, UserOut, UserRegister

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister) -> TokenResponse:
    """Register a new fraud-analyst user and return an access token."""
    pw_hash = hash_password(payload.password)
    try:
        with connection() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (payload.username, payload.email, pw_hash),
            )
            user_id = cur.lastrowid
            row = conn.execute(
                "SELECT id, username, email, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from exc

    user = UserOut(**dict(row))
    token = create_access_token(subject=user.username)
    logger.info("user_registered", extra={"username": user.username})
    return TokenResponse(access_token=token, user=user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin) -> TokenResponse:
    """Authenticate a user and return a JWT bearer token."""
    with connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?",
            (payload.username,),
        ).fetchone()

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    user = UserOut(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        created_at=row["created_at"],
    )
    token = create_access_token(subject=user.username)
    logger.info("user_logged_in", extra={"username": user.username})
    return TokenResponse(access_token=token, user=user)
