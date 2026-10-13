"""Priority score. Port of roadScore / scoreBreakdown from src/lib/priority.ts.

Keep this file and the frontend in sync until the frontend reads scores
from the API. tests/test_scoring.py checks the known values.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Any, Iterable

from .data import summary
from .schemas import Pin, PriorityClass, RankedRoad, ScorePart, Weights

STAV_SCORE = {
    "SUPERhavarijní": 100,
    "havarijní": 82,
    "nevyhovující": 58,
    "vyhovující": 28,
    "dobrý": 12,
    "výborný": 4,
}

# Share of the ranked network per class, from the top. Tune with the team.
CLASS_SHARES: list[tuple[PriorityClass, float]] = [
    ("kriticka", 0.10),
    ("vysoka", 0.20),
    ("stredni", 0.30),
    ("nizka", 0.40),
]

VOTE_POINTS = 2
VOTE_CAP = 10


def js_round(x: float) -> int:
    """Math.round from JavaScript (half up), not Python banker's rounding."""
    return math.floor(x + 0.5)


def _raw_parts(road: dict[str, Any], w: Weights, votes: int, this_year: int | None) -> list[tuple[str, str, float]]:
    year = this_year or date.today().year
    c = road.get("counts") or {}
    last = road.get("lastRepair")
    years_ago = min(year - last, 12) if last else 10
    lines = road.get("lines") or []
    g = c.get

    parts = [
        ("stav", "Stav povrchu", STAV_SCORE.get(road.get("stav", ""), 20) * w.stav / 100),
        ("worse", "Zhoršování", (18 if road.get("worse") else 0) * w.worse / 100),
        ("trida", "Třída silnice", (14 if "2" in (road.get("trida") or "") else 4) * w.trida / 100),
        ("schools", "Školy", min(g("school", 0) * 4, 28) * (w.schools / 100)),
        (
            "hospitals",
            "Zdravotnictví",
            min(g("hospital", 0) * 12 + g("doctor", 0) + g("social", 0) * 2, 36) * (w.hospitals / 100),
        ),
        ("rescue", "IZS", min(g("zzs", 0) * 10 + g("hzs", 0) * 8 + g("police", 0) * 4, 32) * (w.rescue / 100)),
        ("transit", "Veřejná doprava", min(g("stop", 0) * 1.2 + len(lines) * 3, 28) * (w.transit / 100)),
        ("industry", "Průmysl", min(g("industry", 0) * 8, 20) * (w.industry / 100)),
        ("social", "Ohrožené oblasti (HSOO)", (12 if road.get("hsoo") else 0) * w.social / 100),
        ("age", "Roky od opravy", min(years_ago * 4, 32) * (w.age / 100)),
        ("votes", "Hlasy občanů", min(votes * VOTE_POINTS, VOTE_CAP) * (w.votes / 100)),
    ]
    return parts


def score_parts(road: dict[str, Any], w: Weights, votes: int = 0, this_year: int | None = None) -> list[ScorePart]:
    """Score breakdown for the detail panel."""
    return [ScorePart(key=k, label=label, points=round(p, 2)) for k, label, p in _raw_parts(road, w, votes, this_year)]


def score(road: dict[str, Any], w: Weights, votes: int = 0, this_year: int | None = None) -> int:
    # Plain left-to-right float addition like JavaScript. Python's sum() uses
    # compensated summation (3.12+) and would round some x.5 cases differently.
    total = 0.0
    for _, _, points in _raw_parts(road, w, votes, this_year):
        total += points
    return js_round(total)


def classify(rank_index: int, total: int) -> PriorityClass:
    """Class from position in the ranking (0 = best)."""
    if total <= 0:
        return "nizka"
    position = (rank_index + 0.5) / total
    upper = 0.0
    for name, share in CLASS_SHARES:
        upper += share
        if position <= upper:
            return name
    return "nizka"


def ranking(
    roads: Iterable[dict[str, Any]],
    w: Weights,
    pins: Iterable[Pin] = (),
    votes: dict[int, int] | None = None,
    this_year: int | None = None,
) -> list[RankedRoad]:
    """All roads ordered by priority.

    Order: pinned roads by their class (kritická first), then the model order.
    A pin changes the class and the order, and the model class stays visible.
    """
    votes = votes or {}
    pin_by_road = {p.road_id: p for p in pins}
    scored = [(road, score(road, w, votes.get(road["id"], 0), this_year)) for road in roads]
    scored.sort(key=lambda item: (-item[1], item[0]["id"]))
    total = len(scored)

    class_order = {name: i for i, (name, _) in enumerate(CLASS_SHARES)}
    rows = []
    for i, (road, s) in enumerate(scored):
        model_class = classify(i, total)
        pin = pin_by_road.get(road["id"])
        rows.append(
            RankedRoad(
                road=summary(road),
                score=s,
                model_class=model_class,
                priority=pin.priority if pin else model_class,
                pinned=pin is not None,
                pin_reason=pin.reason if pin else None,
                rank=0,
                votes=votes.get(road["id"], 0),
            )
        )
    # Stable sort: within one class, pinned roads first, then by score.
    rows.sort(key=lambda r: (class_order[r.priority], not r.pinned, -r.score, r.road.id))
    for i, row in enumerate(rows, start=1):
        row.rank = i
    return rows
