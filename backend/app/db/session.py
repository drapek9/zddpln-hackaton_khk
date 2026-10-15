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


def ensure_user_columns() -> None:
    """Add S35 columns on a database created before they existed. create_all does not alter."""
    engine = get_db_engine()
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(user)").fetchall()
        if not rows:
            return
        present = {row[1] for row in rows}
        statements = {
            "status": "ALTER TABLE user ADD COLUMN status VARCHAR DEFAULT 'active'",
            "email_verified_at": "ALTER TABLE user ADD COLUMN email_verified_at DATETIME",
            "organization": "ALTER TABLE user ADD COLUMN organization VARCHAR DEFAULT ''",
            "job_title": "ALTER TABLE user ADD COLUMN job_title VARCHAR DEFAULT ''",
            "display_name": "ALTER TABLE user ADD COLUMN display_name VARCHAR DEFAULT ''",
        }
        for name, sql in statements.items():
            if name not in present:
                conn.exec_driver_sql(sql)


def get_session() -> Iterator[Session]:
    session = Session(get_db_engine())
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
