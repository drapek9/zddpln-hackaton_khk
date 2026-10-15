"""Login, registration and the current account."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.responses import TokenOut, UserOut
from app.auth.deps import require_user
from app.auth.security import COOKIE, create_token, hash_password, verify_password
from app.config import get_settings
from app.db.models import User
from app.db.session import get_session

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Přihlášení"])

_WINDOW_S = 60.0
_MAX_FAILURES = 5
_failures: dict[str, list[float]] = {}


def _client_ip(request: Request) -> str:
    host = request.client.host if request.client and request.client.host else "unknown"
    # Behind cloudflared and the Vite proxy every request comes from loopback; without the
    # forwarded address one person's typos would lock the whole team out for a minute.
    if host in ("127.0.0.1", "::1", "localhost", "unknown"):
        forwarded = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "").split(",")[0]
        if forwarded.strip():
            return forwarded.strip()
    return host


def _recent(ip: str) -> list[float]:
    now = time.monotonic()
    return [stamp for stamp in _failures.get(ip, []) if now - stamp < _WINDOW_S]


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class LoginBody(BaseModel):
    # Short demo names ("spravce") and simple demo passwords are allowed at login.
    email: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=200)


DEMO_DOMAIN = "cesty-khk.test"


# Short names people actually type for the demo accounts (with or without diacritics).
_DEMO_ALIASES = {"občan": "obcan", "sprava": "spravce", "správa": "spravce", "správce": "spravce", "urednik": "spravce", "úředník": "spravce"}


def _login_email(raw: str) -> str:
    email = raw.strip().lower()
    # "admin@" or "spravce@" without a domain means the demo account.
    if email.endswith("@"):
        email = email[:-1]
    if "@" in email:
        return email
    return f"{_DEMO_ALIASES.get(email, email)}@{DEMO_DOMAIN}"


def _is_https(request: Request) -> bool:
    # cloudflared and other proxies send X-Forwarded-Proto; the Vite proxy passes it on.
    forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    return request.url.scheme == "https" or forwarded == "https"


def _user_payload(user: User) -> dict:
    return {"id": user.id, "email": user.email, "role": user.role, "blocked": user.blocked}


def _issue(response: Response, user: User, request: Request) -> dict:
    token = create_token(user.id, user.role, user.token_version)
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="lax",
        # A Secure cookie over plain HTTP (Wi-Fi address) is dropped and login silently fails.
        secure=get_settings().cookie_secure and _is_https(request),
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {"token": token, "user": _user_payload(user)}


@router.post("/register", status_code=201, response_model=TokenOut)
def register(
    body: Credentials,
    response: Response,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
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
    return _issue(response, user, request)


@router.post("/login", response_model=TokenOut)
def login(
    body: LoginBody,
    response: Response,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    ip = _client_ip(request)
    recent = _recent(ip)
    _failures[ip] = recent
    if len(recent) >= _MAX_FAILURES:
        raise HTTPException(status_code=429, detail="Příliš mnoho pokusů. Zkuste to za minutu.")
    email = _login_email(body.email)
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        _failures[ip] = [*recent, time.monotonic()]
        # No password in the log; only whether the account exists, so the operator sees typos vs wrong .env.
        log.info("login failed for %s (account %s)", email, "exists" if user else "missing")
        raise HTTPException(status_code=401, detail="Špatné jméno, e-mail nebo heslo.")
    if user.blocked:
        _failures[ip] = [*recent, time.monotonic()]
        raise HTTPException(status_code=403, detail="Účet je zablokovaný.")
    _failures.pop(ip, None)
    return _issue(response, user, request)


@router.post("/logout")
def logout(response: Response, user: User = Depends(require_user), session: Session = Depends(get_session)) -> dict:
    user.token_version += 1
    session.add(user)
    session.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)) -> dict:
    return _user_payload(user)
