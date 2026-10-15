"""Secret key and .env loading. Does not start the app."""

from __future__ import annotations

import pytest

from app.config import Settings, get_settings, require_secret


def _settings(secret: str) -> Settings:
    return Settings(
        db_url="sqlite://",
        secret_key=secret,
        cors_origins=[],
        cookie_secure=False,
        ai_provider="none",
        ai_api_key="",
        ai_endpoint="",
        ai_model="",
        ai_model_fallback="",
        vapid_public_key="",
        vapid_private_key="",
        vapid_subject="mailto:admin@cesty-khk.test",
        smtp_host="",
        smtp_port=1025,
    )


def test_short_or_placeholder_key_is_refused(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CESTY_ALLOW_DEV_KEY", raising=False)
    with pytest.raises(RuntimeError, match="32"):
        require_secret(_settings("dev-only-change-me"))
    with pytest.raises(RuntimeError, match="32"):
        require_secret(_settings("short"))


def test_dev_flag_allows_placeholder_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CESTY_ALLOW_DEV_KEY", "1")
    require_secret(_settings("dev-only-change-me"))


def test_long_key_is_accepted(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CESTY_ALLOW_DEV_KEY", raising=False)
    require_secret(_settings("x" * 32))


def test_shell_env_wins_over_dotenv(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AI_PROVIDER", "from-shell")
    assert get_settings().ai_provider == "from-shell"
