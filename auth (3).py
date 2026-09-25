"""
JWT and password-hashing utilities.

- `hash_password` / `verify_password` use passlib's bcrypt.
- `create_access_token` builds a short-lived JWT (default 60 minutes).
- `get_current_user` is a FastAPI dependency that validates the Bearer
  token and returns the user row from the database.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Final

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import connection

load_dotenv()

SECRET_KEY: Final[str] = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM: Final[str] = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: Final[int] = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash for `plain`."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a stored bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """Create a signed JWT with `sub`, `iat`, and `exp` claims."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT. Raises HTTPException(401) on failure."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(token: str = Depends(_oauth2_scheme)) -> dict[str, Any]:
    """FastAPI dependency that resolves the current user from the Bearer token."""
    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    with connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="User no longer exists")
        return dict(row)
