"""Flood scenario, municipalities and demo closures. Owner: Šimon."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session

from app.auth.deps import require_official
from app.db.models import User
from app.db.session import get_session
from app.services.access import resolve_weights
from app.services.budget import budget_plans
from app.services.scenarios import demo_closures, flood_scenario, municipalities

router = APIRouter(tags=["Scénáře"])

FloodLevel = Literal["q5", "q20", "q100"]


@router.get("/flood")
def flood(
    request: Request,
    level: FloodLevel = Query(default="q100"),
    _: User = Depends(require_official),
) -> dict:
    return flood_scenario(request.app.state.engine, level)


@router.get("/obce")
def obce(request: Request) -> dict:
    return municipalities(request.app.state.engine)


@router.get("/demo-closures")
def demo(request: Request) -> dict:
    return demo_closures(request.app.state.engine)


@router.get("/budget")
def budget(
    request: Request,
    amount: int = Query(ge=0),
    amount2: int | None = Query(default=None, ge=0),
    _: User = Depends(require_official),
    session: Session = Depends(get_session),
) -> dict:
    weights, source = resolve_weights(session, _)
    payload = budget_plans(request.app.state.engine, amount, amount2, weights)
    payload["weights_source"] = source
    return payload
