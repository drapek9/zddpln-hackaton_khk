"""Road list, ranking, detail and official pins."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.auth.deps import optional_user, require_official
from app.core.engine import Engine
from app.core.schemas import PriorityClass, Weights
from app.db.models import RoadPin, User, utcnow
from app.db.session import get_session
from app.services.access import audit, intensity_of, load_pins, load_votes, require_road, resolve_weights
from app.services.labels import stav_for_people

router = APIRouter(tags=["Úseky"])


class PinBody(BaseModel):
    road_id: int
    priority: PriorityClass
    reason: str | None = Field(default=None, max_length=500)


def _rows(engine: Engine, session: Session, user: User | None, query_weights: Weights | None = None):
    if query_weights is not None:
        rows = engine.ranking(query_weights, load_pins(session), load_votes(session))
        return rows, "query"
    weights, source = resolve_weights(session, user)
    rows = engine.ranking(weights, load_pins(session), load_votes(session))
    return rows, source


def weights_from_query(request: Request) -> Weights | None:
    """Slider values for this request only. Missing keys stay at the model defaults."""
    raw: dict[str, float] = {}
    for key in Weights.model_fields:
        if key not in request.query_params:
            continue
        try:
            raw[key] = float(request.query_params[key])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Váha {key} není číslo.") from exc
    if not raw:
        return None
    return Weights.model_validate({**Weights().model_dump(), **raw})


def _feature(row, road: dict) -> dict:
    vehicles, quality = intensity_of(road)
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": road.get("g") or []},
        "properties": {
            "id": row.road.id,
            "usek": row.road.usek,
            "sil": row.road.sil,
            "trida": row.road.trida,
            "okres": row.road.okres,
            "stav": row.road.stav,
            "stav_nazev": stav_for_people(row.road.stav),
            "delka_m": row.road.delka_m,
            "score": row.score,
            "priority": row.priority,
            "model_class": row.model_class,
            "pinned": row.pinned,
            "pin_reason": row.pin_reason,
            "rank": row.rank,
            "votes": row.votes,
            "intenzita": vehicles,
            "intenzita_kvalita": quality,
        },
    }


@router.get("/ranking")
def ranking(
    request: Request,
    limit: int | None = Query(default=None, ge=1, le=20000),
    offset: int = Query(default=0, ge=0),
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
) -> dict:
    rows, source = _rows(request.app.state.engine, session, user, weights_from_query(request))
    page = rows[offset : offset + limit if limit else None]
    return {
        "weights_source": source,
        "count": len(rows),
        "vypocteno": date.today().isoformat(),
        "items": [row.model_dump() for row in page],
    }


@router.get("/useky")
def useky(
    request: Request,
    limit: int | None = Query(default=None, ge=1, le=20000),
    offset: int = Query(default=0, ge=0),
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
) -> dict:
    engine: Engine = request.app.state.engine
    rows, source = _rows(engine, session, user, weights_from_query(request))
    page = rows[offset : offset + limit if limit else None]
    features = []
    for row in page:
        road = engine.road(row.road.id) or {}
        features.append(_feature(row, road))
    return {
        "type": "FeatureCollection",
        "metadata": _metadata(source),
        "features": features,
    }


@router.get("/useky/{road_id}")
def usek_detail(
    road_id: int,
    request: Request,
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
) -> dict:
    engine: Engine = request.app.state.engine
    road = require_road(engine, road_id)
    query_weights = weights_from_query(request)
    rows, source = _rows(engine, session, user, query_weights)
    row = next((item for item in rows if item.road.id == road_id), None)
    if row is None:
        raise HTTPException(status_code=404, detail="Neznámý úsek.")
    weights = query_weights if query_weights is not None else resolve_weights(session, user)[0]
    votes = load_votes(session).get(road_id, 0)
    vehicles, quality = intensity_of(road)
    return {
        "weights_source": source,
        "item": row.model_dump(),
        "breakdown": [part.model_dump() for part in engine.breakdown(road_id, weights, votes)],
        "geometry": road.get("g") or [],
        "intenzita": vehicles,
        "intenzita_kvalita": quality,
        "vypocteno": date.today().isoformat(),
    }


@router.post("/pins")
def set_pin(
    body: PinBody,
    request: Request,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    require_road(request.app.state.engine, body.road_id)
    row = session.get(RoadPin, body.road_id)
    if row is None:
        row = RoadPin(road_id=body.road_id, priority=body.priority, reason=body.reason, user_id=user.id)
    else:
        row.priority = body.priority
        row.reason = body.reason
        row.user_id = user.id
        row.created_at = utcnow()
    session.add(row)
    audit(session, user, "pin.set", f"úsek {body.road_id} → {body.priority}; {body.reason or ''}")
    session.commit()
    return {"road_id": row.road_id, "priority": row.priority, "reason": row.reason}


@router.delete("/pins/{road_id}")
def delete_pin(
    road_id: int,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(RoadPin, road_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Úsek není připíchnutý.")
    session.delete(row)
    audit(session, user, "pin.delete", f"úsek {road_id}")
    session.commit()
    return {"ok": True}


def _metadata(source: str) -> dict:
    return {
        "nazev": "Cesty KHK",
        "licence": "EUPL-1.2",
        "vypocteno": date.today().isoformat(),
        "weights_source": source,
        "intenzita": "Počet aut za den je ze sčítání ŘSD 2025 (CC BY-SA 4.0), nebo štítek odhad. Když údaj chybí, kvalita je chybi.",
    }
