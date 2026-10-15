"""Budget assistant (T17): which stavby a budget buys.

A stavba is a run of adjacent bad úseky (nevyhovující, havarijní, SUPERhavarijní)
of one road (same `sil`) in one okres. A short good úsek (up to GAP_M) between two
bad ones is absorbed, so the road closes only once. Long runs are cut into pieces
of at most MAX_KM along the road.

Prices per km are an estimate (NAPADY.md č. 1: CDV, Liberecký kraj III/28711).
The selection is greedy and deterministic: same input, same plan.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Literal

from .graph import RoadGraph
from .schemas import Stavba

PRICES_KC_PER_KM: dict[str, int] = {
    "nevyhovující": 2_500_000,
    "havarijní": 12_000_000,
    "SUPERhavarijní": 17_000_000,
}
"""Default price by state. A gap is priced like nevyhovující (new surface only)."""
BAD = set(PRICES_KC_PER_KM)
HAVARIJNI = {"havarijní", "SUPERhavarijní"}
GAP_M = 300.0
MAX_KM = 5.0
MIN_KM = 0.5


def build_stavby(roads: Iterable[dict[str, Any]], graph: RoadGraph) -> list[Stavba]:
    """All candidate stavby without score, cost or detour (they depend on weights and prices)."""
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in roads:
        if r["id"] in graph.road_ends:
            groups[(r["sil"], r["okres"])].append(r)

    out: list[Stavba] = []
    for (sil, okres), group in sorted(groups.items()):
        by_id = {r["id"]: r for r in group}
        at_node: dict[int, list[int]] = defaultdict(list)
        for r in group:
            for n in set(graph.road_ends[r["id"]]):
                at_node[n].append(r["id"])

        def neighbours(rid: int) -> list[int]:
            # Link only where the road simply continues (2 úseky meet). A junction of
            # 3+ úseky of the same road splits the stavby, so each one is one stretch.
            return sorted({o for n in set(graph.road_ends[rid]) if len(at_node[n]) == 2 for o in at_node[n] if o != rid})

        bad = {rid for rid, r in by_id.items() if r["stav"] in BAD}
        gaps = {
            rid
            for rid, r in by_id.items()
            if rid not in bad and r["delka"] <= GAP_M and _touches_two_bad(rid, graph, at_node, bad)
        }
        keep = bad | gaps
        seen: set[int] = set()
        for start in sorted(bad):
            if start in seen:
                continue
            comp = _component(start, keep, neighbours)
            seen |= comp
            for piece in _cut(_order(comp, keep, neighbours), by_id):
                piece = _trim_gaps(piece, bad)
                if piece:
                    out.append(_stavba(sil, okres, piece, by_id, bad))
    return out


def _touches_two_bad(rid: int, graph: RoadGraph, at_node: dict[int, list[int]], bad: set[int]) -> bool:
    a, b = graph.road_ends[rid]
    return a != b and any(o in bad for o in at_node[a] if o != rid) and any(o in bad for o in at_node[b] if o != rid)


def _component(start: int, keep: set[int], neighbours) -> set[int]:
    comp, stack = {start}, [start]
    while stack:
        for o in neighbours(stack.pop()):
            if o in keep and o not in comp:
                comp.add(o)
                stack.append(o)
    return comp


def _order(comp: set[int], keep: set[int], neighbours) -> list[int]:
    """Úseky along the road: depth-first from an end (an úsek with one neighbour)."""
    inside = {rid: [o for o in neighbours(rid) if o in comp] for rid in comp}
    ends = sorted(rid for rid, ns in inside.items() if len(ns) <= 1)
    start = ends[0] if ends else min(comp)
    order, seen, stack = [], set(), [start]
    while stack:
        rid = stack.pop()
        if rid in seen:
            continue
        seen.add(rid)
        order.append(rid)
        stack.extend(sorted((o for o in inside[rid] if o not in seen), reverse=True))
    return order


def _cut(order: list[int], by_id: dict[int, dict[str, Any]]) -> list[list[int]]:
    """Pieces of at most MAX_KM. A short last piece joins the previous one if that still fits."""
    pieces: list[list[int]] = [[]]
    km = 0.0
    for rid in order:
        d = by_id[rid]["delka"] / 1000
        if pieces[-1] and km + d > MAX_KM:
            pieces.append([])
            km = 0.0
        pieces[-1].append(rid)
        km += d
    piece_km = lambda p: sum(by_id[r]["delka"] for r in p) / 1000  # noqa: E731
    if len(pieces) > 1 and piece_km(pieces[-1]) < MIN_KM and piece_km(pieces[-2]) + piece_km(pieces[-1]) <= MAX_KM:
        last = pieces.pop()
        pieces[-1] += last
    return pieces


def _trim_gaps(piece: list[int], bad: set[int]) -> list[int]:
    """A cut can leave a gap at a piece end; a stavba starts and ends on a bad úsek."""
    i, j = 0, len(piece)
    while i < j and piece[i] not in bad:
        i += 1
    while j > i and piece[j - 1] not in bad:
        j -= 1
    return piece[i:j]


def _stavba(sil: str, okres: str, piece: list[int], by_id: dict[int, dict[str, Any]], bad: set[int]) -> Stavba:
    stav_km: dict[str, float] = defaultdict(float)
    for rid in piece:
        stav_km[by_id[rid]["stav"]] += by_id[rid]["delka"] / 1000
    first = by_id[piece[0]]
    obce = [o for rid in piece for o in by_id[rid].get("obce") or []]
    return Stavba(
        id=f"{sil.lstrip('0')}-{okres}-{min(piece)}",
        sil=sil,
        trida=first["trida"],
        okres=okres,
        road_ids=piece,
        gap_road_ids=[rid for rid in piece if rid not in bad],
        km=round(sum(stav_km.values()), 3),
        stav_km={k: round(v, 3) for k, v in sorted(stav_km.items())},
        cost_kc=0,
        score=0,
        obce=list(dict.fromkeys(obce)),
    )


def price(stavba: Stavba, prices: dict[str, int]) -> int:
    gap_price = prices["nevyhovující"]
    return round(sum(km * prices.get(stav, gap_price) for stav, km in stavba.stav_km.items()))


def select(
    stavby: list[Stavba], amount_kc: int, order: Literal["per_kc", "score"]
) -> list[Stavba]:
    """Greedy: best first, take each stavba that still fits. Ties by id."""
    if order == "per_kc":
        # Benefit = score x bad km (gaps add cost, not benefit).
        key = lambda s: (-(s.score * _bad_km(s)) / max(s.cost_kc, 1), s.id)  # noqa: E731
    else:
        key = lambda s: (-s.score, s.id)  # noqa: E731
    left, chosen = amount_kc, []
    for s in sorted(stavby, key=key):
        if 0 < s.cost_kc <= left:
            chosen.append(s)
            left -= s.cost_kc
    return chosen


def _bad_km(stavba: Stavba) -> float:
    return sum(km for stav, km in stavba.stav_km.items() if stav in BAD)
