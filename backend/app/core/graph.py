"""Road graph over II. and III. class roads: detours and citizen routes.

Nodes are road endpoints snapped together within SNAP_M metres. An endpoint
that touches the middle of another road splits that road, so T-junctions work.
Every edge remembers which road (úsek) it belongs to. A closure removes the
edges of one úsek and runs Dijkstra between its ends.

Honest limits:
- II. and III. class roads come from Data KHK ("Stav povrchu"). I. class
  roads and motorways come from OSM (scripts/fetch_osm_roads.py) and get
  negative ids. Local streets are missing, so some detours are longer than
  in reality or are not found.
- All traffic takes one fastest detour. In reality it splits.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Iterable

import networkx as nx

from .schemas import DetourResult, LonLat, RouteResult

SNAP_M = 25.0
OSM_SNAP2 = 1.0  # 1 m squared
LAT0 = 50.3  # middle of the Královéhradecký kraj
KX = 111_320.0 * math.cos(math.radians(LAT0))
KY = 110_540.0

# Rough free-flow speeds (km/h) used only to compare detours.
SPEED_KMH = {"2": 65.0, "3": 45.0}
OSM_SPEED_KMH = {"motorway": 110.0, "trunk": 90.0, "primary": 75.0}
DEFAULT_SPEED_KMH = 45.0
BAD_STATES = {"havarijní", "SUPERhavarijní"}


def to_xy(p: LonLat) -> tuple[float, float]:
    return p[0] * KX, p[1] * KY


def speed_for(trida: str) -> float:
    for key, kmh in SPEED_KMH.items():
        if key in (trida or ""):
            return kmh
    return DEFAULT_SPEED_KMH


@dataclass
class _Vertex:
    road_id: int
    lonlat: LonLat
    xy: tuple[float, float]


@dataclass
class RoadGraph:
    graph: nx.MultiGraph
    vertices: list[_Vertex]
    node_of: dict[int, int]
    """Vertex index to graph node id (only for vertices that are nodes)."""
    road_ends: dict[int, tuple[int, int]]
    """Road id to (start node, end node)."""
    road_km: dict[int, float]
    road_state: dict[int, str]
    node_xy: dict[int, tuple[float, float]] = field(default_factory=dict)

    # ---- building -------------------------------------------------------

    @classmethod
    def build(
        cls,
        roads: Iterable[dict[str, Any]],
        osm_roads: Iterable[dict[str, Any]] = (),
        snap_m: float = SNAP_M,
    ) -> "RoadGraph":
        roads = list(roads)
        for i, osm in enumerate(osm_roads):
            roads.append(
                {
                    "id": -(i + 1),
                    "g": osm["g"],
                    "trida": osm.get("highway", ""),
                    "stav": "",
                    "speed": OSM_SPEED_KMH.get(osm.get("highway", ""), 75.0),
                    "ref": osm.get("ref", ""),
                }
            )
        vertices: list[_Vertex] = []
        road_vertices: dict[int, list[int]] = {}
        for road in roads:
            ids = []
            for p in road["g"]:
                lonlat = (float(p[0]), float(p[1]))
                ids.append(len(vertices))
                vertices.append(_Vertex(road["id"], lonlat, to_xy(lonlat)))
            if len(ids) >= 2:
                road_vertices[road["id"]] = ids

        # Spatial grid over all vertices.
        grid: dict[tuple[int, int], list[int]] = {}
        for i, v in enumerate(vertices):
            grid.setdefault(_cell(v.xy, snap_m), []).append(i)

        # Union-find over vertex indices: snapped vertices become one node.
        parent = list(range(len(vertices)))

        def find(a: int) -> int:
            root = a
            while parent[root] != root:
                root = parent[root]
            while parent[a] != root:
                parent[a], a = root, parent[a]
            return root

        is_node: set[int] = set()
        snap2 = snap_m * snap_m
        for ids in road_vertices.values():
            for end in (ids[0], ids[-1]):
                is_node.add(end)
                ex, ey = vertices[end].xy
                cx, cy = _cell(vertices[end].xy, snap_m)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        for other in grid.get((cx + dx, cy + dy), ()):
                            if other == end:
                                continue
                            ox, oy = vertices[other].xy
                            # OSM ways share exact coordinates at real junctions.
                            # A wide snap between two OSM ways would chain along
                            # the densified vertices and merge distant points.
                            both_osm = vertices[other].road_id < 0 and vertices[end].road_id < 0
                            limit = OSM_SNAP2 if both_osm else snap2
                            if (ox - ex) ** 2 + (oy - ey) ** 2 <= limit:
                                if vertices[other].road_id == vertices[end].road_id and other in (ids[0], ids[-1]):
                                    continue  # do not close a road on itself
                                is_node.add(other)
                                ra, rb = find(end), find(other)
                                if ra != rb:
                                    parent[ra] = rb

        # OSM junctions: ways crossing at a shared OSM node have identical
        # coordinates, also when neither way ends there.
        by_coord: dict[LonLat, list[int]] = {}
        for i, v in enumerate(vertices):
            if v.road_id < 0:
                by_coord.setdefault(v.lonlat, []).append(i)
        for group in by_coord.values():
            if len({vertices[i].road_id for i in group}) < 2:
                continue
            for i in group:
                is_node.add(i)
                ra, rb = find(i), find(group[0])
                if ra != rb:
                    parent[ra] = rb

        node_of = {i: find(i) for i in is_node}
        graph = nx.MultiGraph()
        road_ends: dict[int, tuple[int, int]] = {}
        road_km: dict[int, float] = {}
        road_state: dict[int, str] = {}
        road_by_id = {r["id"]: r for r in roads}

        for road_id, ids in road_vertices.items():
            road = road_by_id[road_id]
            kmh = road.get("speed") or speed_for(road.get("trida", ""))
            road_state[road_id] = road.get("stav", "")
            start = ids[0]
            length = 0.0
            total = 0.0
            for j in range(1, len(ids)):
                length += _dist(vertices[ids[j - 1]].xy, vertices[ids[j]].xy)
                if ids[j] in node_of or j == len(ids) - 1:
                    a, b = node_of[start], node_of.get(ids[j], find(ids[j]))
                    if a != b:
                        graph.add_edge(
                            a,
                            b,
                            road_id=road_id,
                            m=length,
                            minutes=length / 1000 / kmh * 60,
                            path=(start, ids[j]),
                        )
                    total += length
                    start = ids[j]
                    length = 0.0
            road_ends[road_id] = (node_of[ids[0]], node_of[ids[-1]])
            road_km[road_id] = total / 1000

        node_xy = {n: vertices[n].xy for n in graph.nodes}
        return cls(graph, vertices, node_of, road_ends, road_km, road_state, node_xy)

    # ---- queries --------------------------------------------------------

    def detour(self, road_id: int) -> DetourResult:
        if road_id not in self.road_ends:
            return DetourResult(road_id=road_id, found=False, closed_km=0, note="Úsek není v grafu.")
        start, end = self.road_ends[road_id]
        closed_km = round(self.road_km[road_id], 2)
        if start == end:
            return DetourResult(road_id=road_id, found=False, closed_km=closed_km, note="Úsek začíná a končí ve stejném uzlu.")

        view = nx.subgraph_view(self.graph, filter_edge=lambda a, b, k: self.graph[a][b][k]["road_id"] != road_id)
        try:
            nodes = nx.dijkstra_path(view, start, end, weight=_min_weight("minutes"))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return DetourResult(
                road_id=road_id,
                found=False,
                closed_km=closed_km,
                note="Objížďka po silnicích II. a III. třídy nenalezena (chybí silnice I. třídy nebo místní komunikace).",
            )

        edges = _pick_edges(view, nodes, "minutes")
        km = sum(e["m"] for e in edges) / 1000
        minutes = sum(e["minutes"] for e in edges)
        closed_min = sum(
            d["minutes"] for _, _, d in self.graph.edges(data=True) if d["road_id"] == road_id
        )
        via = _unique(e["road_id"] for e in edges if e["road_id"] > 0)
        class1_km = sum(e["m"] for e in edges if e["road_id"] < 0) / 1000
        bad_km = sum(e["m"] for e in edges if self.road_state.get(e["road_id"]) in BAD_STATES) / 1000
        return DetourResult(
            road_id=road_id,
            found=True,
            closed_km=closed_km,
            detour_km=round(km, 2),
            extra_km=round(km - closed_km, 2),
            extra_min=round(minutes - closed_min, 1),
            geometry=self._geometry(nodes, edges),
            via_road_ids=via,
            havarijni_km=round(bad_km, 2),
            class1_km=round(class1_km, 2),
            note="Model posílá všechnu dopravu jednou nejrychlejší objížďkou. Ve skutečnosti se rozdělí.",
        )

    def route(self, origin: LonLat, dest: LonLat, closed: Iterable[int] = ()) -> RouteResult:
        closed_set = set(closed)
        a, da = self.nearest_node(origin)
        b, db = self.nearest_node(dest)
        if a is None or b is None:
            return RouteResult(found=False, note="Graf je prázdný.")
        view = self.graph
        if closed_set:
            view = nx.subgraph_view(
                self.graph, filter_edge=lambda x, y, k: self.graph[x][y][k]["road_id"] not in closed_set
            )
        try:
            nodes = nx.dijkstra_path(view, a, b, weight=_min_weight("minutes"))
        except nx.NetworkXNoPath:
            return RouteResult(found=False, snapped_from_m=round(da), snapped_to_m=round(db), note="Trasa po silnicích kraje nenalezena.")
        edges = _pick_edges(view, nodes, "minutes")
        return RouteResult(
            found=True,
            km=round(sum(e["m"] for e in edges) / 1000, 2),
            minutes=round(sum(e["minutes"] for e in edges), 1),
            road_ids=_unique(e["road_id"] for e in edges if e["road_id"] > 0),
            geometry=self._geometry(nodes, edges),
            snapped_from_m=round(da),
            snapped_to_m=round(db),
            note="Trasa jen po silnicích II. a III. třídy z dat kraje.",
        )

    def nearest_node(self, p: LonLat) -> tuple[int | None, float]:
        x, y = to_xy(p)
        best, best_d = None, math.inf
        for n, (nx_, ny_) in self.node_xy.items():
            d = (nx_ - x) ** 2 + (ny_ - y) ** 2
            if d < best_d:
                best, best_d = n, d
        return best, math.sqrt(best_d)

    def components(self) -> list[int]:
        return sorted((len(c) for c in nx.connected_components(self.graph)), reverse=True)

    # ---- helpers --------------------------------------------------------

    def _geometry(self, nodes: list[int], edges: list[dict[str, Any]]) -> list[LonLat]:
        out: list[LonLat] = []
        for node, edge in zip(nodes, edges):
            i, j = edge["path"]
            seg = [v.lonlat for v in self.vertices[i : j + 1]]
            if self.node_of[i] != node:
                seg.reverse()
            if out and seg and out[-1] == seg[0]:
                seg = seg[1:]
            out.extend(seg)
        return out


def _cell(xy: tuple[float, float], size: float) -> tuple[int, int]:
    return int(xy[0] // size), int(xy[1] // size)


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _min_weight(attr: str):
    def weight(u: int, v: int, data: dict[Any, dict[str, Any]]) -> float:
        return min(d[attr] for d in data.values())

    return weight


def _pick_edges(g: nx.MultiGraph, nodes: list[int], attr: str) -> list[dict[str, Any]]:
    return [min(g[u][v].values(), key=lambda d: d[attr]) for u, v in zip(nodes, nodes[1:])]


def _unique(items: Iterable[int]) -> list[int]:
    seen: dict[int, None] = {}
    for item in items:
        seen.setdefault(item, None)
    return list(seen)
