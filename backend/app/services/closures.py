"""Closure records, detour preview and confirmation."""

from __future__ import annotations

from fastapi import HTTPException
from sqlmodel import Session, select

from app.ai.service import announcement_text
from app.core.engine import Engine
from app.db.models import Closure, User, utcnow
from app.notify.service import citizens_on_road, notify_closure
from app.services.access import closure_label, intensity_of, require_road
from app.services.impacts import alerts_for_closure
from app.services.scenarios import closure_pending_fields

STATUSES = ("navrzeno", "schvaleno", "naplanovano", "probiha", "hotovo")
PUBLIC_STATUSES = ("schvaleno", "naplanovano", "probiha", "hotovo")
ACTIVE_STATUSES = ("schvaleno", "naplanovano", "probiha")


def closure_dict(row: Closure) -> dict:
    return {
        "id": row.id,
        "road_id": row.road_id,
        "title": row.title,
        "date_from": row.date_from,
        "date_to": row.date_to,
        "restriction": row.restriction,
        "note": row.note,
        "status": row.status,
        "confirmed": row.confirmed,
        "simulated": row.simulated,
        "label": closure_label(row.simulated),
    }


def preview(session: Session, engine: Engine, row: Closure) -> dict:
    require_road(engine, row.road_id)
    try:
        detour = engine.detour(row.road_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Neznámý úsek.") from exc
    alerts = alerts_for_closure(engine, row.road_id, row.date_from, row.date_to, row.restriction, detour)
    road = engine.road(row.road_id) or {}
    vehicles, quality = intensity_of(road)
    text = announcement_text(engine, row, alerts, detour, enabled=False)
    detour_payload = detour.model_dump()
    pending = closure_pending_fields(engine, row.road_id, detour_payload)
    return {
        "closure": closure_dict(row),
        "detour": detour_payload,
        "alerts": [alert.model_dump() for alert in alerts],
        "announcement": text,
        "vehicles_per_day": vehicles,
        "vehicles_quality": quality,
        "citizens_on_route": citizens_on_road(session, row.road_id),
        # Kept beside detour until T14/T15 add them on DetourResult. Names are not renamed.
        "students_per_day": pending["students_per_day"],
        "cut_off_obce": pending["cut_off_obce"],
    }


def active_closed_ids(session: Session) -> list[int]:
    rows = session.exec(select(Closure).where(Closure.confirmed.is_(True))).all()
    return [row.road_id for row in rows if row.status in ACTIVE_STATUSES]


def mark_confirmed(session: Session, row: Closure, user: User) -> int:
    if row.status == "navrzeno":
        row.status = "schvaleno"
    if not row.confirmed:
        row.confirmed = True
        row.confirmed_by = user.id
        row.confirmed_at = utcnow()
    row.updated_at = utcnow()
    session.add(row)
    session.flush()
    return notify_closure(session, row)


def move_status(row: Closure, new_status: str) -> None:
    if new_status not in STATUSES:
        raise HTTPException(status_code=400, detail="Neznámý stav práce.")
    if STATUSES.index(new_status) < STATUSES.index(row.status):
        raise HTTPException(status_code=400, detail="Stav práce může jít jen dopředu.")
    row.status = new_status
    row.updated_at = utcnow()

