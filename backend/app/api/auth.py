"""Login, registration and the current account."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth.deps import require_user
from app.auth.security import COOKIE, create_token, hash_password, verify_password
from app.config import get_settings
from app.db.models import User
from app.db.session import get_session

router = APIRouter(prefix="/auth", tags=["Přihlášení"])

_WINDOW_S = 60.0
_MAX_FAILURES = 5
_failures: dict[str, list[float]] = {}


def _client_ip(request: Request) -> str:
    if request.client is None or not request.client.host:
        return "unknown"
    return request.client.host


def _recent(ip: str) -> list[float]:
    now = time.monotonic()
    return [stamp for stamp in _failures.get(ip, []) if now - stamp < _WINDOW_S]


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)


def _user_payload(user: User) -> dict:
    return {"id": user.id, "email": user.email, "role": user.role, "blocked": user.blocked}


def _issue(response: Response, user: User) -> dict:
    token = create_token(user.id, user.role, user.token_version)
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {"token": token, "user": _user_payload(user)}


@router.post("/register", status_code=201)
def register(body: Credentials, response: Response, session: Session = Depends(get_session)) -> dict:
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="E-mail nemá platný tvar.")
    exists = session.exec(select(User).where(User.email == email)).first()
    if exists is not None:
        raise HTTPException(status_code=409, detail="E-mail už je registrovaný.")
    user = User(email=email, password_hash=hash_password(body.password), role="citizen")
    session.add(user)
    session.commit()
    session.refresh(user)
    return _issue(response, user)


@router.post("/login")
def login(
    body: Credentials,
    response: Response,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    ip = _client_ip(request)
    recent = _recent(ip)
    _failures[ip] = recent
    if len(recent) >= _MAX_FAILURES:
        raise HTTPException(status_code=429, detail="Příliš mnoho pokusů. Zkuste to za minutu.")
    email = body.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        _failures[ip] = [*recent, time.monotonic()]
        raise HTTPException(status_code=401, detail="Špatný e-mail nebo heslo.")
    if user.blocked:
        _failures[ip] = [*recent, time.monotonic()]
        raise HTTPException(status_code=403, detail="Účet je zablokovaný.")
    _failures.pop(ip, None)
    return _issue(response, user)


@router.post("/logout")
def logout(response: Response, user: User = Depends(require_user), session: Session = Depends(get_session)) -> dict:
    user.token_version += 1
    session.add(user)
    session.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(require_user)) -> dict:
    return _user_payload(user)
