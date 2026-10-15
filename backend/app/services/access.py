"""Shared reads and writes: weights, pins, votes, audit."""

from __future__ import annotations

import json

from fastapi import HTTPException
from sqlmodel import Session, select

from app.core.engine import Engine
from app.core.schemas import Pin, Weights
from app.db.models import AppSetting, AuditEvent, OfficialWeights, RoadPin, User, Vote, utcnow

SETTINGS_ID = 1


def audit(session: Session, user: User | None, action: str, detail: str) -> None:
    session.add(
        AuditEvent(
            user_id=user.id if user else None,
            email=user.email if user else "",
            action=action,
            detail=detail,
        )
    )


def get_settings_row(session: Session) -> AppSetting:
    row = session.get(AppSetting, SETTINGS_ID)
    if row is None:
        row = AppSetting(id=SETTINGS_ID, weights_json=Weights().model_dump_json())
        session.add(row)
        session.flush()
    return row


def resolve_weights(session: Session, user: User | None) -> tuple[Weights, str]:
    """Official personal weights, otherwise the admin defaults."""
    if user is not None and user.role == "official":
        personal = session.get(OfficialWeights, user.id)
        if personal is not None:
            return Weights.model_validate_json(personal.weights_json), "official"
    row = get_settings_row(session)
    if row.weights_json:
        return Weights.model_validate_json(row.weights_json), "admin"
    return Weights(), "default"


def load_pins(session: Session) -> list[Pin]:
    rows = session.exec(select(RoadPin)).all()
    return [Pin(road_id=row.road_id, priority=row.priority, reason=row.reason) for row in rows]


def load_votes(session: Session) -> dict[int, int]:
    """Vote counts after the admin cap. The engine applies its own point cap on top."""
    cap = get_settings_row(session).vote_cap
    counts: dict[int, int] = {}
    for vote in session.exec(select(Vote)).all():
        counts[vote.road_id] = counts.get(vote.road_id, 0) + 1
    if cap < 0:
        cap = 0
    return {road_id: min(count, cap) for road_id, count in counts.items()}


def require_road(engine: Engine, road_id: int) -> dict:
    road = engine.road(road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Neznámý úsek.")
    return road


def intensity_of(road: dict) -> tuple[int | float | None, str]:
    """Vehicles per day and the source label already stored on the road.

    `road["intensity"]` is `{"sv": vehicles_per_day, "src": "csd2025" | "odhad", "usek": ...}`.
    This function does not estimate traffic. A missing count stays missing.
    """
    raw = road.get("intensity")
    if isinstance(raw, dict):
        count = _as_count(raw.get("sv"))
        if count is None:
            return None, "chybi"
        return count, str(raw.get("src") or "odhad")
    for key in ("intenzita", "vehicles_per_day"):
        count = _as_count(road.get(key))
        if count is None:
            continue
        quality = road.get("intensity_quality") or road.get("intenzita_kvalita") or "odhad"
        return count, str(quality)
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return _as_count(raw), str(road.get("intensity_quality") or road.get("intenzita_kvalita") or "odhad")
    return None, "chybi"


def _as_count(value: object) -> int | float | None:
    if isinstance(value, bool) or isinstance(value, dict) or value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        try:
            number = float(str(value))
        except (TypeError, ValueError):
            return None
    if number.is_integer():
        return int(number)
    return number


def closure_label(simulated: bool) -> str:
    return "demo data" if simulated else "zadáno úředníkem"


def dump_ids(ids: list[int]) -> str:
    return json.dumps(ids)


def load_ids(raw: str | None) -> list[int]:
    if not raw:
        return []
    data = json.loads(raw)
    return [int(item) for item in data]


def touch(row) -> None:
    row.updated_at = utcnow()
