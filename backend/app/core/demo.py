"""Demo closures from real plans (T16). Data: Data KHK, Plánované opravy silniční infrastruktury na rok 2022.

Each plan is a line with a road number ("III/29920"), a term and a closure type.
We match the line to our úseky of the same road: the plan line is sampled every
SAMPLE_M metres and each sample goes to the nearest úsek within MATCH_M.
An úsek is closed when at least MIN_OVERLAP_M of the plan lies on it.
"""

from __future__ import annotations

import calendar
import math
import re
from typing import Any

from .graph import to_xy

SAMPLE_M = 20.0
MATCH_M = 40.0
MIN_OVERLAP_M = 60.0
MIN_SHARE = 0.3
"""Below this share of the plan length on our úseky the match is dropped (it only crosses a road)."""


def road_number(text: str | None) -> str:
    """"III/29920" -> "29920", "03535" -> "3535"."""
    return (text or "").split("/")[-1].strip().lstrip("0")


def parse_term(text: str | None, end: bool) -> str | None:
    """"04/2022" -> 2022-04-01 (start) or 2022-04-30 (end). "2022" -> whole year."""
    m = re.fullmatch(r"\s*(?:(\d{1,2})\s*/\s*)?(\d{4})\s*", text or "")
    if not m:
        return None
    year = int(m.group(2))
    month = int(m.group(1)) if m.group(1) else (12 if end else 1)
    if not 1 <= month <= 12:
        return None
    day = calendar.monthrange(year, month)[1] if end else 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def _seg_dist2(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
    qx, qy = a[0] + t * dx - p[0], a[1] + t * dy - p[1]
    return qx * qx + qy * qy


def _samples(paths: list[list[list[float]]]) -> list[tuple[float, float]]:
    """Points every SAMPLE_M metres along the plan lines (projected metres)."""
    out: list[tuple[float, float]] = []
    for path in paths:
        xy = [to_xy((p[0], p[1])) for p in path]
        for a, b in zip(xy, xy[1:]):
            n = max(1, math.ceil(math.dist(a, b) / SAMPLE_M))
            out += [(a[0] + (b[0] - a[0]) * (i + 0.5) / n, a[1] + (b[1] - a[1]) * (i + 0.5) / n) for i in range(n)]
    return out


def match_plan(
    plan: dict[str, Any], roads_by_number: dict[str, list[dict[str, Any]]], all_roads: list[dict[str, Any]] = ()
) -> tuple[list[int], float, bool]:
    """Our road ids under the plan line (longest overlap first), the matched share 0-1
    and whether the match ignored the road number.

    Some plans carry a road number that differs from Stav povrchu (e.g. "II/3041"
    drawn on II/304). When the same number covers less than half of the line,
    every road near the line is tried and wins if it covers at least half.
    Matches below MIN_SHARE are dropped.
    """
    samples = _samples(plan.get("paths") or [])
    if not samples:
        return [], 0.0, False
    number = road_number(plan.get("silnice"))
    ids, share = _match(samples, roads_by_number.get(number, []) if number else [])
    by_position = False
    if share < 0.5 and all_roads:
        ids2, share2 = _match(samples, _near(samples, all_roads))
        if share2 >= 0.5 and share2 > share:
            ids, share, by_position = ids2, share2, True
    if share < MIN_SHARE:
        return [], share, False
    return ids, share, by_position


def _near(samples: list[tuple[float, float]], roads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Roads whose bbox is within MATCH_M of the plan samples."""
    xs, ys = [p[0] for p in samples], [p[1] for p in samples]
    box = (min(xs) - MATCH_M, min(ys) - MATCH_M, max(xs) + MATCH_M, max(ys) + MATCH_M)
    near = []
    for r in roads:
        (x0, y0), (x1, y1) = to_xy((r["b"][0], r["b"][1])), to_xy((r["b"][2], r["b"][3]))
        if x0 <= box[2] and x1 >= box[0] and y0 <= box[3] and y1 >= box[1]:
            near.append(r)
    return near


def _match(samples: list[tuple[float, float]], roads: list[dict[str, Any]]) -> tuple[list[int], float]:
    cands = [(r["id"], [to_xy((p[0], p[1])) for p in r["g"]]) for r in roads]
    if not cands:
        return [], 0.0
    overlap: dict[int, float] = {}
    lim = MATCH_M * MATCH_M
    for p in samples:
        best, best_d = None, lim
        for rid, xy in cands:
            for a, b in zip(xy, xy[1:]):
                d = _seg_dist2(p, a, b)
                if d <= best_d:
                    best, best_d = rid, d
        if best is not None:
            overlap[best] = overlap.get(best, 0.0) + SAMPLE_M
    ids = sorted((rid for rid, m in overlap.items() if m >= MIN_OVERLAP_M), key=lambda r: -overlap[r])
    matched = sum(overlap[r] for r in ids)
    return ids, round(min(1.0, matched / (len(samples) * SAMPLE_M)), 2)
