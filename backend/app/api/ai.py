"""AI proposals. Nothing here is saved until a person confirms it elsewhere."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.ai.service import announcement_text, explain_road, propose_weights
from app.auth.deps import require_official
from app.core.schemas import Weights
from app.db.models import Closure, User
from app.db.session import get_session
from app.services.access import get_settings_row, load_votes, require_road, resolve_weights
from app.services.impacts import alerts_for_closure

router = APIRouter(prefix="/ai", tags=["AI"])


class RoadBody(BaseModel):
    road_id: int


class WeightsText(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    target: str = Field(default="self", pattern="^(self|permanent)$")


@router.post("/explain")
def explain(
    body: RoadBody,
    request: Request,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    engine = request.app.state.engine
    require_road(engine, body.road_id)
    weights, source = resolve_weights(session, user)
    votes = load_votes(session).get(body.road_id, 0)
    enabled = get_settings_row(session).ai_enabled
    result = explain_road(engine, body.road_id, weights, votes, enabled)
    result["weights_source"] = source
    return result


class ClosureBody(BaseModel):
    closure_id: int


@router.post("/announcement")
def announcement_for_closure(
    body: ClosureBody,
    request: Request,
    _: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Closure, body.closure_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Uzavírka neexistuje.")
    engine = request.app.state.engine
    detour = engine.detour(row.road_id)
    alerts = alerts_for_closure(engine, row.road_id, row.date_from, row.date_to, row.restriction, detour)
    enabled = get_settings_row(session).ai_enabled
    return announcement_text(engine, row, alerts, detour, enabled)


@router.post("/weights")
def weights_from_text(
    body: WeightsText,
    user: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    if body.target == "permanent" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Trvalé váhy mění jen admin.")
    if body.target == "permanent" or user.role != "official":
        base = Weights.model_validate_json(get_settings_row(session).weights_json)
    else:
        base, _source = resolve_weights(session, user)
    enabled = get_settings_row(session).ai_enabled
    return propose_weights(body.text, base, enabled)


@router.get("/weights/current")
def current_weights(user: User = Depends(require_official), session: Session = Depends(get_session)) -> dict:
    weights, source = resolve_weights(session, user)
    return {"weights": weights.model_dump(), "source": source}
