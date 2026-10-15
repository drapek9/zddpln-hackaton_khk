"""Citizen reports and votes. AI only proposes a fixed structure."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.ai.service import classify_report
from app.auth.deps import require_citizen, require_official, require_user
from app.db.models import Report, User, Vote
from app.db.session import get_session
from app.services.access import get_settings_row, require_road

router = APIRouter(tags=["Hlášení a hlasy"])


class ReportBody(BaseModel):
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    description: str = Field(min_length=3, max_length=4000)
    has_photo: bool = False


class ReportPatch(BaseModel):
    status: str | None = Field(default=None, pattern="^(nove|vyrizeno)$")
    road_id: int | None = None
    kind: str | None = Field(default=None, pattern="^(vytluk|oznaceni|prekazka|jine)$")
    severity: str | None = Field(default=None, pattern="^(nizka|stredni|vysoka)$")


class VoteBody(BaseModel):
    road_id: int


def _report_dict(row: Report) -> dict:
    return {
        "id": row.id,
        "lon": row.lon,
        "lat": row.lat,
        "description": row.description,
        "has_photo": row.has_photo,
        "kind": row.kind,
        "severity": row.severity,
        "road_id": row.road_id,
        "source": row.source,
        "label": "návrh AI" if row.source == "ai" else "šablona",
        "status": row.status,
        "created_at": row.created_at.isoformat(),
    }


@router.post("/reports", status_code=201)
def create_report(
    body: ReportBody,
    request: Request,
    user: User = Depends(require_citizen),
    session: Session = Depends(get_session),
) -> dict:
    # Photo bytes are not stored. has_photo only records that the citizen attached one.
    proposal = classify_report(
        body.description,
        body.lon,
        body.lat,
        request.app.state.engine,
        enabled=bool(get_settings_row(session).ai_enabled),
    )
    row = Report(
        user_id=user.id,
        lon=body.lon,
        lat=body.lat,
        description=body.description.strip(),
        has_photo=body.has_photo,
        kind=proposal["kind"],
        severity=proposal["severity"],
        road_id=proposal["road_id"],
        source=proposal["source"],
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _report_dict(row)


@router.get("/reports")
def list_reports(
    request: Request,
    road_id: int | None = None,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    query = select(Report).order_by(Report.id.desc())
    if user.role == "citizen":
        query = query.where(Report.user_id == user.id)
    elif user.role not in {"official", "admin"}:
        raise HTTPException(status_code=403, detail="Na tohle nemáte oprávnění.")
    rows = session.exec(query).all()
    if road_id is not None:
        rows = [row for row in rows if row.road_id == road_id]
    return {"items": [_report_dict(row) for row in rows]}


@router.post("/reports/{report_id}/classify")
def reclassify(
    report_id: int,
    request: Request,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Report, report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Hlášení neexistuje.")
    proposal = classify_report(
        row.description,
        row.lon,
        row.lat,
        request.app.state.engine,
        enabled=bool(get_settings_row(session).ai_enabled),
    )
    row.kind = proposal["kind"]
    row.severity = proposal["severity"]
    row.road_id = proposal["road_id"]
    row.source = proposal["source"]
    session.add(row)
    session.commit()
    session.refresh(row)
    return _report_dict(row)


@router.patch("/reports/{report_id}")
def update_report(
    report_id: int,
    body: ReportPatch,
    request: Request,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Report, report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Hlášení neexistuje.")
    if body.road_id is not None:
        require_road(request.app.state.engine, body.road_id)
        row.road_id = body.road_id
    if body.kind is not None:
        row.kind = body.kind
    if body.severity is not None:
        row.severity = body.severity
    if body.status is not None:
        row.status = body.status
    session.add(row)
    session.commit()
    session.refresh(row)
    return _report_dict(row)


@router.post("/votes", status_code=201)
def add_vote(
    body: VoteBody,
    request: Request,
    user: User = Depends(require_citizen),
    session: Session = Depends(get_session),
) -> dict:
    require_road(request.app.state.engine, body.road_id)
    exists = session.exec(select(Vote).where(Vote.user_id == user.id, Vote.road_id == body.road_id)).first()
    if exists is not None:
        raise HTTPException(status_code=409, detail="Na tenhle úsek už hlas máte.")
    session.add(Vote(user_id=user.id, road_id=body.road_id))
    session.commit()
    return {"road_id": body.road_id, "ok": True}


@router.delete("/votes/{road_id}")
def delete_vote(
    road_id: int,
    user: User = Depends(require_citizen),
    session: Session = Depends(get_session),
) -> dict:
    row = session.exec(select(Vote).where(Vote.user_id == user.id, Vote.road_id == road_id)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Hlas neexistuje.")
    session.delete(row)
    session.commit()
    return {"ok": True}


@router.get("/votes/me")
def my_votes(user: User = Depends(require_citizen), session: Session = Depends(get_session)) -> dict:
    rows = session.exec(select(Vote).where(Vote.user_id == user.id)).all()
    return {"road_ids": [row.road_id for row in rows]}
