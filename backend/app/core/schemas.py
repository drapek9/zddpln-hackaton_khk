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
    intensity: int | None = None
    """Vehicles per day (ŘSD census 2025, SV). Added 15 Oct (T7)."""
    intensity_src: Literal["csd2025", "odhad"] | None = None
    """csd2025 = matched census section, odhad = estimate (show the label "odhad")."""


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
    closed_road_ids: list[int] = Field(default_factory=list)
    """Added 15 Oct (T16): all roads closed together. Empty for a single-road detour (= [road_id])."""


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


# ---- added 15 Oct (T14/T15): people affected by closures, Data KHK -----------


class ObecImpact(BaseModel):
    kod: str
    nazev: str
    obyvatel: int = 0
    studenti: int = 0
    """Daily high-school students from this obec affected (Data KHK: Dojížďka do středních škol)."""


class PeopleImpact(BaseModel):
    """Who is affected when `closed_road_ids` are closed. Measured flows, not estimates."""

    closed_road_ids: list[int] = Field(default_factory=list)
    students_per_day: int = 0
    """High-school students whose shortest home→school route uses a closed road."""
    students_by_obec: list[ObecImpact] = Field(default_factory=list)
    """Home obce of those students, most affected first. Only the top 10; the sum can be below students_per_day."""
    cut_off_obce: list[ObecImpact] = Field(default_factory=list)
    """Obce that lose every road connection to a hospital (Data KHK: Nemocnice). Empty if no hospital data."""
    cut_off_people: int = 0
    cut_off_students: int = 0
    """Students who cannot reach their school by road at all."""
    note: str = ""


class FloodResult(PeopleImpact):
    level: Literal["q5", "q20", "q100"]
    flooded_km: float = 0
    """Length of closed kraj roads (whole úseky with at least FLOOD_MIN_M metres in the zone)."""


# ---- added 15 Oct (T16): real planned closures 2022 as demo cases, Data KHK ---


class DemoClosure(BaseModel):
    """A real closure from Data KHK (Plánované opravy silniční infrastruktury na rok 2022) with its impact."""

    id: int
    """Index in the 2022 plan list (stable for one data snapshot)."""
    nazev: str
    silnice: str
    """Road as in the source, e.g. "III/29920"."""
    staniceni: str = ""
    typ_uzavirky: str = ""
    """As in the source: "úplná", "za provozu", "novostavba"."""
    termin: str = ""
    """Term as in the source, e.g. "04/2022 – 11/2022"."""
    date_from: str | None = None
    date_to: str | None = None
    """ISO dates derived from the term (whole months)."""
    obec: str = ""
    okres: str = ""
    geometry: list[list[LonLat]] = Field(default_factory=list)
    """Closure lines from the source [[lon, lat], ...]."""
    road_ids: list[int] = Field(default_factory=list)
    """Our úseky (Data KHK Stav povrchu) on the closure."""
    matched_share: float = 0
    """Share of the closure length that lies on `road_ids` (0-1)."""
    detour: DetourResult | None = None
    people: PeopleImpact | None = None
    vehicles_per_day: int | None = None
    vehicles_src: Literal["csd2025", "odhad"] | None = None
    alerts: list[Alert] = Field(default_factory=list)
    recommended: bool = False
    """One of three demo cases: most students, most vehicles, longest detour."""
    recommended_reason: str = ""
    note: str = ""
    """Honest caveats about the match, e.g. the plan has a different road number than Stav povrchu."""
    source: str = "Data KHK: Plánované opravy silniční infrastruktury na rok 2022 (liniové)"
