"""People affected by closures (T14, T15). Data: Data KHK, scripts/fetch_khk_extra.py.

- Student flows: "Dojížďka do středních škol" gives (home obec -> school, students).
  Each flow is routed once on the road graph (fastest path). A closure then
  affects every flow whose path uses a closed road.
- Cut-off obce: with the closed roads removed, an obec is cut off when its
  node can no longer reach any hospital (Data KHK: Nemocnice) by road.
- Cut-off students: the home obec and the school end up in different parts of
  the network, so the student cannot get to school by road at all.
- Flood: roads with at least FLOOD_MIN_M metres inside a Q5/Q20/Q100 zone are closed.

Honest limits:
- Only daily high-school students, not all commuters.
- An obec is one point (the graph node closest to its centre on a road of
  that obec). Local streets are missing.
- Students take the fastest road path, not the real bus route.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any, Iterable

import networkx as nx

from .graph import RoadGraph, to_xy
from .schemas import FloodResult, LonLat, ObecImpact, PeopleImpact

FLOOD_MIN_M = 100
"""A road is closed in a flood when at least this many metres are in the zone.
Lower values also close short bridges over the river, which mostly stay open."""
TOP_OBCE = 10


class People:
    def __init__(
        self,
        graph: RoadGraph,
        extra: dict[str, Any],
        roads: list[dict[str, Any]],
        osm_roads: list[dict[str, Any]],
        pois: list[dict[str, Any]] = (),
    ):
        self.g = graph
        self.extra = extra
        self.obce: dict[str, dict[str, Any]] = {o["kod"]: o for o in extra.get("obce", [])}
        self._osm_id = {f"osm:{r['osm_id']}": -(i + 1) for i, r in enumerate(osm_roads) if "osm_id" in r}

        self._road_nodes: dict[int, set[int]] = defaultdict(set)
        for u, v, d in graph.graph.edges(data=True):
            self._road_nodes[d["road_id"]].update((u, v))
        self._name_roads: dict[str, list[int]] = defaultdict(list)
        for r in roads:
            for name in r.get("obce", []):
                self._name_roads[name].append(r["id"])

        # Snap only to the main network (the biggest component holds 96 % of kraj roads;
        # the rest are OSM pieces outside the kraj).
        self.giant: set[int] = max(nx.connected_components(graph.graph), key=len) if graph.graph else set()
        self._giant_xy = [(n, graph.node_xy[n]) for n in self.giant]

        self.obec_node: dict[str, int] = {}
        for kod, o in self.obce.items():
            node = self._snap_obec(o)
            if node is not None:
                self.obec_node[kod] = node
        self.hospital_nodes: set[int] = {
            n for p in pois if p.get("kind") == "hospital" for n in [self._nearest((p["x"], p["y"]))] if n is not None
        }
        self._route_flows()

    # ---- building -------------------------------------------------------

    def _nearest(self, p: LonLat, nodes: Iterable[tuple[int, tuple[float, float]]] | None = None) -> int | None:
        x, y = to_xy(p)
        best, best_d = None, math.inf
        for n, (nx_, ny_) in nodes if nodes is not None else self._giant_xy:
            d = (nx_ - x) ** 2 + (ny_ - y) ** 2
            if d < best_d:
                best, best_d = n, d
        return best

    def _snap_obec(self, o: dict[str, Any]) -> int | None:
        """Node closest to the obec centre on a road of that obec, else in its bbox, else anywhere."""
        x0, y0, x1, y1 = o["b"]
        c = (o["c"][0], o["c"][1])

        def inside(n: int) -> bool:
            lon, lat = self.g.vertices[n].lonlat
            return x0 <= lon <= x1 and y0 <= lat <= y1

        own = {
            n
            for rid in self._name_roads.get(o["nazev"], [])
            for n in self._road_nodes.get(rid, ())
            if n in self.giant and inside(n)
        }
        node = self._nearest(c, [(n, self.g.node_xy[n]) for n in own])
        if node is None:
            node = self._nearest(c, [(n, xy) for n, xy in self._giant_xy if inside(n)])
        if node is None:
            node = self._nearest(c)
        return node

    def _route_flows(self) -> None:
        """Route every (home obec -> school) flow once. One Dijkstra per school (fewer than obce)."""
        G = self.g.graph
        school_node: dict[tuple[float, float], int | None] = {}
        by_school: dict[int, list[dict[str, Any]]] = defaultdict(list)
        self.unrouted_students = 0
        for fl in self.extra.get("students", []):
            key = (fl["p"][0], fl["p"][1])
            if key not in school_node:
                school_node[key] = self._nearest(key)
            dst = school_node[key]
            if dst is None or fl["home"] not in self.obec_node:
                self.unrouted_students += fl["n"]
                continue
            by_school[dst].append(fl)

        self.flows: list[tuple[str, int, int, frozenset[int]]] = []
        """(home kod, students, school node, road ids on the path incl. OSM)."""
        self.road_flows: dict[int, list[int]] = defaultdict(list)
        for dst, flows in by_school.items():
            pred, _ = nx.dijkstra_predecessor_and_distance(G, dst, weight=_minutes)
            for fl in flows:
                src = self.obec_node[fl["home"]]
                if src != dst and src not in pred:
                    self.unrouted_students += fl["n"]
                    continue
                path_roads = frozenset(self._path_roads(pred, dst, src))
                idx = len(self.flows)
                self.flows.append((fl["home"], fl["n"], dst, path_roads))
                for rid in path_roads:
                    self.road_flows[rid].append(idx)

        self.road_students: dict[int, int] = {
            rid: sum(self.flows[i][1] for i in idxs) for rid, idxs in self.road_flows.items() if rid > 0
        }

    def _path_roads(self, pred: dict[int, list[int]], src: int, dst: int) -> list[int]:
        G = self.g.graph
        out: list[int] = []
        node = dst
        while node != src:
            prev = pred[node][0]
            out.append(min(G[prev][node].values(), key=lambda d: d["minutes"])["road_id"])
            node = prev
        return out

    def _components(self, closed: set[int]) -> dict[int, int]:
        """Node -> component index with the closed roads removed."""
        G = self.g.graph
        view = nx.subgraph_view(G, filter_edge=lambda a, b, k: G[a][b][k]["road_id"] not in closed)
        comp_of: dict[int, int] = {}
        for i, comp in enumerate(nx.connected_components(view)):
            for n in comp:
                comp_of[n] = i
        return comp_of

    # ---- queries --------------------------------------------------------

    def students_on(self, road_id: int) -> int:
        return self.road_students.get(road_id, 0)

    def impact(self, closed: Iterable[int], cut_off: bool = True) -> PeopleImpact:
        closed_set = set(closed)
        hit: set[int] = set()
        for rid in closed_set:
            hit.update(self.road_flows.get(rid, ()))

        cut_obce: list[str] = []
        cut_students = 0
        if cut_off and closed_set and self.hospital_nodes:
            comp_of = self._components(closed_set)
            with_hospital = {comp_of[n] for n in self.hospital_nodes}
            cut_obce = [kod for kod, node in self.obec_node.items() if comp_of[node] not in with_hospital]
            for i, (home, n, school, _) in enumerate(self.flows):
                if comp_of[self.obec_node[home]] != comp_of[school]:
                    cut_students += n
                    hit.add(i)

        by_obec: dict[str, int] = defaultdict(int)
        for i in hit:
            by_obec[self.flows[i][0]] += self.flows[i][1]
        return PeopleImpact(
            closed_road_ids=sorted(closed_set),
            students_per_day=sum(by_obec.values()),
            students_by_obec=[self._obec(k, n) for k, n in sorted(by_obec.items(), key=lambda kv: -kv[1])[:TOP_OBCE]],
            cut_off_obce=sorted((self._obec(k, by_obec.get(k, 0)) for k in cut_obce), key=lambda o: -o.obyvatel),
            cut_off_people=sum(self.obce[k].get("obyvatel", 0) for k in cut_obce),
            cut_off_students=cut_students,
            note=(
                "Středoškoláci denně (Data KHK: Dojížďka do středních škol), nejrychlejší cesta po silnicích. "
                "Obec = jeden bod v síti, místní komunikace v grafu nejsou."
            ),
        )

    def flood(self, level: str, min_m: int = FLOOD_MIN_M) -> FloodResult:
        zone = (self.extra.get("flood") or {}).get(level)
        if zone is None:
            raise KeyError(f"Unknown flood level {level!r} or khk_extra.json missing (scripts/fetch_khk_extra.py)")
        closed: list[int] = []
        for key, metres in zone["flooded_m"].items():
            if metres < min_m:
                continue
            rid = self._osm_id.get(key) if key.startswith("osm:") else int(key)
            if rid is not None:
                closed.append(rid)
        base = self.impact(closed)
        flooded_km = sum(self.g.road_km.get(r, 0.0) for r in closed if r > 0)
        return FloodResult(
            **base.model_dump(),
            level=level,
            flooded_km=round(flooded_km, 1),
        )

    def _obec(self, kod: str, studenti: int) -> ObecImpact:
        o = self.obce.get(kod, {})
        return ObecImpact(kod=kod, nazev=o.get("nazev", kod), obyvatel=o.get("obyvatel", 0), studenti=studenti)


def _minutes(u: int, v: int, data: dict[Any, dict[str, Any]]) -> float:
    return min(d["minutes"] for d in data.values())

