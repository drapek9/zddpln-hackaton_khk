"""Runtime settings. Secrets come from the environment, never from the repo."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    db_url: str
    secret_key: str
    cors_origins: list[str]
    cookie_secure: bool
    ai_provider: str
    ai_api_key: str
    ai_endpoint: str
    ai_model: str
    ai_model_fallback: str
    vapid_public_key: str
    vapid_private_key: str
    vapid_subject: str
    smtp_host: str
    smtp_port: int

    @property
    def ai_configured(self) -> bool:
        if self.ai_provider in {"", "none"} or not self.ai_api_key:
            return False
        if self.ai_provider == "anthropic":
            return True
        return bool(self.ai_endpoint)


def get_settings() -> Settings:
    backend_dir = Path(__file__).resolve().parents[1]
    default_db = backend_dir / "cesty.db"
    origins = [item.strip() for item in os.getenv("CESTY_CORS_ORIGINS", "http://localhost:5173").split(",") if item.strip()]
    return Settings(
        db_url=os.getenv("CESTY_DB_URL", f"sqlite:///{default_db}"),
        secret_key=os.getenv("CESTY_SECRET_KEY", "dev-only-change-me"),
        cors_origins=origins,
        cookie_secure=_flag("CESTY_COOKIE_SECURE", False),
        ai_provider=os.getenv("AI_PROVIDER", "none").strip().lower(),
        ai_api_key=os.getenv("AI_API_KEY", "").strip(),
        ai_endpoint=os.getenv("AI_ENDPOINT", "").strip(),
        ai_model=os.getenv("AI_MODEL", "").strip(),
        ai_model_fallback=os.getenv("AI_MODEL_FALLBACK", "").strip(),
        vapid_public_key=os.getenv("VAPID_PUBLIC_KEY", "").strip(),
        vapid_private_key=os.getenv("VAPID_PRIVATE_KEY", "").strip(),
        vapid_subject=os.getenv("VAPID_SUBJECT", "mailto:admin@cesty-khk.test").strip(),
        smtp_host=os.getenv("SMTP_HOST", "").strip(),
        smtp_port=int(os.getenv("SMTP_PORT", "1025")),
    )
