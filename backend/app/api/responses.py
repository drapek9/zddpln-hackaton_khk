"""Response models so OpenAPI describes the shapes the frontend calls.

These wrap the core models. They do not add fields to the shared contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.schemas import Alert, DetourResult, ObecImpact, RankedRoad, StabilityResult


class HealthOut(BaseModel):
    ok: bool
    roads: int
    graph_nodes: int
    db: bool


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    blocked: bool


class TokenOut(BaseModel):
    token: str
    user: UserOut


class CompactRankItem(BaseModel):
    id: int
    score: int
    priority: str
    model_class: str
    rank: int
    pinned: bool
    votes: int
    formula_rank: int | None = None
    ai_points: int | None = None
    ai_reason: str | None = None
    ai_label: str | None = None


class RankedRoadOut(RankedRoad):
    """Formula row plus the optional city-AI shift. Core RankedRoad stays unchanged."""

    formula_rank: int | None = None
    ai_points: int | None = None
    ai_reason: str | None = None
    ai_label: str | None = None


class RankingOut(BaseModel):
    weights_source: str
    count: int
    vypocteno: str
    ai: str = "vzorec"
    ai_note: str = ""
    items: list[RankedRoadOut | CompactRankItem] = Field(default_factory=list)


class StabilityOut(StabilityResult):
    weights_source: str


class ClosureCard(BaseModel):
    id: int | None = None
    road_id: int
    title: str
    date_from: str
    date_to: str
    restriction: str
    note: str | None = None
    status: str
    confirmed: bool
    simulated: bool
    label: str


class RescueStop(BaseModel):
    nazev: str = ""
    sluzba: str = "zzs"
    extra_min: float | None = None
    nad_20_min: bool = False
    obyvatel: int | None = None
    pred_min: float | None = None
    po_min: float | None = None


class RescueCard(BaseModel):
    items: list[RescueStop] = Field(default_factory=list)
    label: str
    note: str = ""


class AnnouncementOut(BaseModel):
    text: str
    source: str
    label: str


class ClosureImpactOut(BaseModel):
    """Shape of a saved closure and of POST /api/closures."""

    closure: ClosureCard
    detour: DetourResult
    alerts: list[Alert]
    announcement: AnnouncementOut
    vehicles_per_day: int | None = None
    vehicles_quality: str
    citizens_on_route: int
    students_per_day: int | None = None
    cut_off_obce: list[ObecImpact] | None = None
    rescue: RescueCard | None = None


class ClosurePreviewOut(ClosureImpactOut):
    """POST /api/closures/preview. Nothing is written."""

    saved: bool
