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
    intensity: float = 0
    """Added 15 Oct (T20): vehicles per day (ŘSD 2025 / estimate). 0 = off until the frontend ranks via the API."""
    detour: float = 0
    """Added 15 Oct (T20): how long the detour is when the úsek closes for repair."""
    students: float = 0
    """Added 15 Oct (T20): high-school students per day on the úsek (Data KHK)."""


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
    rescue: RescueImpact | None = None
    """Added 15 Oct (T18): ZZS and HZS drive times; its alerts are also in `alerts`."""


# ---- added 15 Oct (T8): current closures from ŘSD / NDIC SRTI ------------------


class SrtiClosure(BaseModel):
    """A current road work or closure from SRTI (CC BY 4.0), one point per situation."""

    id: str
    label: str
    """Czech description of the kinds, e.g. "údržba, uzavřená silnice"."""
    full_closure: bool
    lon: float
    lat: float
    start: str | None = None
    end: str | None = None
    """ISO date-times from SRTI."""
    active: bool = False
    """The given day lies between start and end."""
    road: str | None = None
    """Road number from SRTI ("I-16"), mostly only for I. class roads and motorways."""
    road_id: int | None = None
    """Nearest kraj úsek (Data KHK) within 100 m, else None."""
    road_label: str | None = None
    """Our úsek, e.g. "III/29920 (Kuks)"."""
    snapshot: str = ""
    source: str = "ŘSD / NDIC, SRTI, CC BY 4.0"


# ---- added 15 Oct (T17): budget assistant, (T10): ranking stability -----------


class Stavba(BaseModel):
    """One construction: adjacent bad úseky of one road (same `sil`) in one okres."""

    id: str
    """Stable id from road number, okres and first úsek, e.g. "29920-Náchod-1234"."""
    sil: str
    trida: str
    okres: str
    road_ids: list[int] = Field(default_factory=list)
    """All úseky in the stavba, in order along the road, including absorbed gaps."""
    gap_road_ids: list[int] = Field(default_factory=list)
    """Short good úseky between two bad ones, repaired with them so the road closes once."""
    km: float
    stav_km: dict[str, float] = Field(default_factory=dict)
    """Km per surface state (gaps under their own state)."""
    cost_kc: int
    """Estimate: km x price per km by state (see BudgetPlan.prices_kc_per_km)."""
    score: float
    """Length-weighted mean score of the bad úseky."""
    obce: list[str] = Field(default_factory=list)
    detour: DetourResult | None = None
    """Detour with the whole stavba closed. Only for selected stavby."""
    warnings: list[str] = Field(default_factory=list)


class BudgetPlan(BaseModel):
    """What a budget buys. Prices are an estimate, the selection is deterministic."""

    amount_kc: int
    spent_kc: int = 0
    km: float = 0
    stavby: list[Stavba] = Field(default_factory=list)
    """Selected stavby in selection order."""
    havarijni_km_total: float = 0
    """Havarijní + SUPERhavarijní km in scope (okres filter applied)."""
    havarijni_km_fixed: float = 0
    havarijni_km_left: float = 0
    candidates: int = 0
    """Stavby that could be bought in scope."""
    prices_kc_per_km: dict[str, int] = Field(default_factory=dict)
    order: Literal["per_kc", "score"] = "per_kc"
    """per_kc = score per crown (cheap repairs first), score = most urgent first."""
    okres: str | None = None
    price_src: Literal["estimate"] = "estimate"
    note: str = ""


class StableRoad(BaseModel):
    road_id: int
    rank: int
    """Rank with the given weights (1 = first), model only, no pins."""
    share: float
    """Share of random weight sets where the road stays in the top N (0-1)."""
    label: Literal["jisté", "pravděpodobné", "nejisté"]


class StabilityResult(BaseModel):
    top_n: int
    samples: int
    spread: float
    """Each weight is multiplied by a random factor in [1 - spread, 1 + spread], clamped to 0-100."""
    items: list[StableRoad] = Field(default_factory=list)
    """Roads in the top N with the given weights, in rank order."""
    note: str = ""


# ---- added 15 Oct (T18): ambulance (ZZS) and fire brigade (HZS) response times ---


class RescueObec(BaseModel):
    kod: str
    nazev: str
    obyvatel: int = 0
    service: Literal["zzs", "hzs"]
    """zzs = ambulance base (Data KHK), hzs = fire station."""
    before_min: float
    """Drive time from the nearest base before the closure (estimate, graph speeds)."""
    after_min: float | None = None
    """None = no road connection from any base after the closure."""
    extra_min: float | None = None
    over_limit: bool = False
    """ZZS only: the time goes over 20 min (Act on ZZS) because of the closure."""


class RescueImpact(BaseModel):
    closed_road_ids: list[int] = Field(default_factory=list)
    obce: list[RescueObec] = Field(default_factory=list)
    """Obce with a longer drive (at least 1 min), cut-off and longest delay first."""
    people_slower: int = 0
    """Inhabitants of obce where the ambulance drives longer."""
    zzs_over_limit: int = 0
    """Obce where the ambulance goes over 20 min only because of the closure."""
    limit_min: float = 20
    alerts: list[Alert] = Field(default_factory=list)
    src: Literal["estimate"] = "estimate"
    note: str = ""


DemoClosure.model_rebuild()  # `rescue` refers to RescueImpact defined below DemoClosure
