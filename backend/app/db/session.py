"""SQLite engine and request-scoped sessions."""

from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, create_engine

from app.config import get_settings

_engine = None


def get_db_engine():
    global _engine
    if _engine is None:
        url = get_settings().db_url
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(url, connect_args=connect_args)
    return _engine


def get_session() -> Iterator[Session]:
    session = Session(get_db_engine())
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
