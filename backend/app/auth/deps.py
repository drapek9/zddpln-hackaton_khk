"""Request dependencies: current user and role checks."""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from app.auth.security import COOKIE, decode_token
from app.db.models import User
from app.db.session import get_session

OFFICIAL_ROLES = ("official", "admin")


def _token_from_request(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        token = header.split(" ", 1)[1].strip()
        if token:
            return token
    return request.cookies.get(COOKIE) or None


def optional_user(request: Request, session: Session = Depends(get_session)) -> User | None:
    token = _token_from_request(request)
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
        version = int(payload.get("ver", -1))
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
    user = session.get(User, user_id)
    if user is None or version != user.token_version:
        return None
    if user.blocked:
        raise HTTPException(status_code=403, detail="Účet je zablokovaný.")
    return user


def require_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Přihlaste se.")
    return user


def require_official(user: User = Depends(require_user)) -> User:
    if user.role not in OFFICIAL_ROLES:
        raise HTTPException(status_code=403, detail="Na tohle nemáte oprávnění.")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Na tohle nemáte oprávnění.")
    return user


def require_citizen(user: User = Depends(require_user)) -> User:
    if user.role != "citizen":
        raise HTTPException(status_code=403, detail="Hlasovat a hlásit závady může přihlášený občan.")
    return user
