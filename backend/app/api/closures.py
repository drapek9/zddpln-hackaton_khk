"""Closure simulator: create, preview, confirm, work status."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth.deps import optional_user, require_official
from app.db.models import Closure, User
from app.db.session import get_session
from app.services.access import audit, require_road
from app.services.closures import (
    PUBLIC_STATUSES,
    active_closed_ids,
    closure_dict,
    mark_confirmed,
    move_status,
    preview,
)

router = APIRouter(tags=["Uzavírky"])


class ClosureBody(BaseModel):
    road_id: int
    title: str = Field(min_length=3, max_length=200)
    date_from: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    date_to: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    restriction: str = Field(default="úplná uzavírka", max_length=200)
    note: str | None = Field(default=None, max_length=2000)
    simulated: bool = True


class StatusBody(BaseModel):
    status: str


def _check_dates(body: ClosureBody) -> None:
    if body.date_from > body.date_to:
        raise HTTPException(status_code=400, detail="Datum konce je před začátkem.")


@router.post("/closures", status_code=201)
def create_closure(
    body: ClosureBody,
    request: Request,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    _check_dates(body)
    require_road(request.app.state.engine, body.road_id)
    row = Closure(
        road_id=body.road_id,
        title=body.title,
        date_from=body.date_from,
        date_to=body.date_to,
        restriction=body.restriction,
        note=body.note,
        simulated=body.simulated,
        created_by=user.id,
    )
    session.add(row)
    audit(session, user, "closure.create", f"úsek {body.road_id}, {body.date_from}–{body.date_to}")
    session.commit()
    session.refresh(row)
    return preview(session, request.app.state.engine, row)


@router.get("/closures")
@router.get("/uzavirky")
def list_closures(
    request: Request,
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
    include_drafts: bool = Query(default=False),
) -> dict:
    rows = session.exec(select(Closure).order_by(Closure.id)).all()
    official = user is not None and user.role in {"official", "admin"}
    if not (official and include_drafts):
        rows = [row for row in rows if row.confirmed and row.status in PUBLIC_STATUSES]
    return {
        "items": [closure_dict(row) for row in rows],
        "srti": _srti(request.app.state.engine),
        "active_road_ids": active_closed_ids(session),
    }


@router.get("/closures/{closure_id}")
def get_closure(
    closure_id: int,
    request: Request,
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Closure, closure_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Uzavírka neexistuje.")
    official = user is not None and user.role in {"official", "admin"}
    if not official and not (row.confirmed and row.status in PUBLIC_STATUSES):
        raise HTTPException(status_code=404, detail="Uzavírka neexistuje.")
    return preview(session, request.app.state.engine, row)


@router.post("/closures/{closure_id}/confirm")
def confirm_closure(
    closure_id: int,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Closure, closure_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Uzavírka neexistuje.")
    notified = mark_confirmed(session, row, user)
    audit(session, user, "closure.confirm", f"uzavírka {row.id}, upozornění {notified}")
    session.commit()
    session.refresh(row)
    return {"closure": closure_dict(row), "notified": notified}


@router.patch("/closures/{closure_id}")
def update_status(
    closure_id: int,
    body: StatusBody,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Closure, closure_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Uzavírka neexistuje.")
    previous = row.status
    move_status(row, body.status)
    notified = 0
    if row.status in PUBLIC_STATUSES and not row.confirmed:
        notified = mark_confirmed(session, row, user)
    session.add(row)
    audit(session, user, "closure.status", f"uzavírka {row.id}: {previous} → {row.status}")
    session.commit()
    session.refresh(row)
    return {"closure": closure_dict(row), "notified": notified}


def _srti(engine) -> list:
    method = getattr(engine, "srti_closures", None)
    if not callable(method):
        return []
    try:
        rows = method()
    except Exception:
        return []
    public = []
    for item in rows or []:
        if hasattr(item, "model_dump"):
            data = item.model_dump()
        elif isinstance(item, dict):
            data = dict(item)
        else:
            continue
        data["source"] = "srti"
        public.append(data)
    return public
