"""Shared contract between core logic (Tomáš) and the API layer (Šimon).

Rules: only add fields. Never rename or remove a field without both agreeing.
Czech values (stav, trida) are kept as they come from Data KHK.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LonLat = tuple[float, float]

PriorityClass = Literal["kriticka", "vysoka", "stredni", "nizka"]
AlertLevel = Literal["critical", "warning", "info"]


class Weights(BaseModel):
    """Slider weights 0-100. Same keys and defaults as src/lib/types.ts."""

    stav: float = 100
    worse: float = 70
    trida: float = 55
    schools: float = 80
    hospitals: float = 95
    rescue: float = 90
    transit: float = 75
    industry: float = 45
    social: float = 40
    age: float = 50
    votes: float = 0
    """Weak citizen-vote factor. Admin sets it; 0 = off."""


class Pin(BaseModel):
    """Manual priority set by an official. Always wins over the model."""

    road_id: int
    priority: PriorityClass
    reason: str | None = None


class ScorePart(BaseModel):
    key: str
    label: str
    points: float


class RoadSummary(BaseModel):
    id: int
    usek: str
    sil: str
    trida: str
    okres: str
    stav: str
    rok: int
    delka_m: float
    last_repair: int | None
    obce: list[str]
    lines: list[str]


class RankedRoad(BaseModel):
    road: RoadSummary
    score: int
    model_class: PriorityClass
    priority: PriorityClass
    """Final class: the pin if present, otherwise model_class."""
    pinned: bool = False
    pin_reason: str | None = None
    rank: int
    votes: int = 0


class Alert(BaseModel):
    level: AlertLevel
    title: str
    detail: str


class DetourResult(BaseModel):
    road_id: int
    found: bool
    closed_km: float
    detour_km: float | None = None
    extra_km: float | None = None
    extra_min: float | None = None
    geometry: list[LonLat] = Field(default_factory=list)
    """Detour line [lon, lat] for the map."""
    via_road_ids: list[int] = Field(default_factory=list)
    havarijni_km: float = 0
    """Detour length on havarijní / SUPERhavarijní roads."""
    class1_km: float = 0
    """Detour length on I. class roads and motorways (OSM)."""
    note: str = ""


class RouteResult(BaseModel):
    found: bool
    km: float | None = None
    minutes: float | None = None
    road_ids: list[int] = Field(default_factory=list)
    """Kraj road segments (úseky) on the route, without OSM roads. Used for notifications."""
    geometry: list[LonLat] = Field(default_factory=list)
    snapped_from_m: float | None = None
    snapped_to_m: float | None = None
    note: str = ""
