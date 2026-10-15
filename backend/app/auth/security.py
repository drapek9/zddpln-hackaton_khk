"""Password hashing and JWT sessions.

The token is accepted from the httponly cookie or from Authorization: Bearer.
Logout bumps token_version, so both stop working.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings

COOKIE = "cesty_session"
ALGORITHM = "HS256"
TOKEN_DAYS = 7
PBKDF2_ROUNDS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ROUNDS)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ROUNDS)
    return hmac.compare_digest(check.hex(), digest)


def create_token(user_id: int, role: str, token_version: int) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "ver": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
