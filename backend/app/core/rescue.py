"""Ambulance (ZZS) and fire brigade (HZS) drive times when roads close (T18).

Times come from a multi-source Dijkstra over the road graph from all bases of a
service. An obec is one node (see People). Graph speeds are an estimate, not a
real ambulance drive, so every result has src = "estimate".
"""

from __future__ import annotations

from typing import Any, Iterable

import networkx as nx

from .people import People
from .schemas import Alert, RescueImpact, RescueObec

LIMIT_MIN = 20.0
"""Ambulance arrival limit (Act 374/2011 on ZZS, plan of coverage)."""
MIN_EXTRA = 1.0
"""Report an obec only from this delay (minutes)."""
SERVICES = ("zzs", "hzs")
NAMES = {"zzs": "záchranky", "hzs": "hasičů"}


class Rescue:
    def __init__(self, people: People, pois: Iterable[dict[str, Any]]):
        self.p = people
        self.bases: dict[str, set[int]] = {s: set() for s in SERVICES}
        for poi in pois:
            if poi.get("kind") in self.bases:
                node = people._nearest((poi["x"], poi["y"]))
                if node is not None:
                    self.bases[poi["kind"]].add(node)
        self.before = {s: self._times(s, frozenset()) for s in SERVICES}

    def _times(self, service: str, closed: frozenset[int]) -> dict[int, float]:
        if not self.bases[service]:
            return {}

        def weight(u: int, v: int, data: dict[Any, dict[str, Any]]) -> float | None:
            ok = [d["minutes"] for d in data.values() if d["road_id"] not in closed]
            return min(ok) if ok else None

        return nx.multi_source_dijkstra_path_length(self.p.g.graph, self.bases[service], weight=weight)

    def _edge_of_closure(self, node: int, closed: frozenset[int], after: dict[int, float]) -> float | None:
        """An obec point that lies on the closed stretch itself (a closed průtah) is
        reached at the nearest end of the closure: residents there use local streets,
        which the graph does not have. None when no end of the closure is reachable."""
        G = self.p.g.graph
        seen, stack = {node}, [node]
        while stack:
            u = stack.pop()
            for v, data in G[u].items():
                if v not in seen and all(d["road_id"] in closed for d in data.values()):
                    seen.add(v)
                    stack.append(v)
        ends = [after[n] for n in seen if n in after]
        return min(ends) if ends else None

    def impact(self, closed: Iterable[int]) -> RescueImpact:
        closed_set = frozenset(closed)
        rows: list[RescueObec] = []
        for s in SERVICES:
            before = self.before[s]
            after = self._times(s, closed_set) if closed_set else before
            for kod, node in self.p.obec_node.items():
                if node not in before:
                    continue
                b, a = before[node], after.get(node)
                if a is None:
                    a = self._edge_of_closure(node, closed_set, after)
                if a is not None and a - b < MIN_EXTRA:
                    continue
                o = self.p.obce[kod]
                rows.append(
                    RescueObec(
                        kod=kod,
                        nazev=o.get("nazev", kod),
                        obyvatel=o.get("obyvatel", 0),
                        service=s,
                        before_min=round(b, 1),
                        after_min=None if a is None else round(a, 1),
                        extra_min=None if a is None else round(a - b, 1),
                        over_limit=s == "zzs" and b <= LIMIT_MIN and (a is None or a > LIMIT_MIN),
                    )
                )
        rows.sort(key=lambda r: (r.after_min is not None, -(r.extra_min or 0), -r.obyvatel, r.kod))
        zzs = [r for r in rows if r.service == "zzs"]
        return RescueImpact(
            closed_road_ids=sorted(closed_set),
            obce=rows,
            people_slower=sum(r.obyvatel for r in zzs),
            zzs_over_limit=sum(r.over_limit for r in zzs),
            limit_min=LIMIT_MIN,
            alerts=_alerts(rows),
            note=(
                "Odhad: nejrychlejší cesta po silnicích z nejbližší základny ZZS / stanice HZS (Data KHK), "
                "rychlosti podle třídy silnice. Obec = jeden bod v síti; leží-li bod přímo na uzavírce, "
                "počítá se dojezd k jejímu nejbližšímu okraji."
            ),
        )


def _alerts(rows: list[RescueObec]) -> list[Alert]:
    alerts: list[Alert] = []
    over = [r for r in rows if r.over_limit]
    if over:
        names = ", ".join(r.nazev for r in over[:3]) + (" a další" if len(over) > 3 else "")
        alerts.append(
            Alert(
                level="critical",
                title=f"Záchranka přes {LIMIT_MIN:.0f} min: {_obce(len(over))}",
                detail=f"Dojezd ZZS do obcí {names} překročí {LIMIT_MIN:.0f} min (odhad).",
            )
        )
    for s in SERVICES:
        worst = next((r for r in rows if r.service == s and not r.over_limit), None)
        if worst is None:
            continue
        if worst.after_min is None:
            detail = f"Do obce {worst.nazev} po uzavírce nevede v modelu žádná silnice od základny {NAMES[s]} (místní cesty model nemá)."
        else:
            detail = (
                f"Dojezd {NAMES[s]} do obce {worst.nazev} se prodlouží o {worst.extra_min:.0f} min "
                f"({worst.before_min:.0f} → {worst.after_min:.0f} min, odhad)."
            )
        level = "warning" if worst.after_min is None or (worst.extra_min or 0) >= 5 else "info"
        alerts.append(Alert(level=level, title=f"Delší dojezd {NAMES[s]}", detail=detail))
    return alerts


def _obce(n: int) -> str:
    return f"{n} obec" if n == 1 else f"{n} obce" if 2 <= n <= 4 else f"{n} obcí"
