"""Flood scenario, municipalities and demo closures. Owner: Šimon."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request

from app.auth.deps import require_official
from app.db.models import User
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
