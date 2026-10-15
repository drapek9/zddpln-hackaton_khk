"""Engine: the only entry point the API layer uses from core.

The engine is stateless towards the database. The API passes in pins, votes,
weights and closures; the engine computes. Load it once at startup.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Iterable

from . import demo, impact, scoring
from .data import Dataset, load_dataset, summary
from .graph import RoadGraph
from .people import People
from .schemas import Alert, DemoClosure, DetourResult, FloodResult, ObecImpact, PeopleImpact, LonLat, Pin, RankedRoad, RoadSummary, RouteResult, ScorePart, Weights


class Engine:
    def __init__(self, dataset: Dataset):
        self.data = dataset
        self.graph = RoadGraph.build(dataset.roads, dataset.osm_roads)
        self._people: People | None = None
        self._people_lock = threading.Lock()
        self._demo: list[DemoClosure] | None = None
        self._demo_lock = threading.Lock()

    @property
    def people(self) -> People:
        """Student flows and obce. Built on first use (~3 s); call it at startup to warm up."""
        if self._people is None:
            with self._people_lock:
                if self._people is None:
                    self._people = People(
                        self.graph, self.data.extra, self.data.roads, self.data.osm_roads, self.data.pois
                    )
        return self._people

    @classmethod
    def load(cls, data_dir: Path | str | None = None) -> "Engine":
        return cls(load_dataset(data_dir))

    # ---- roads ----------------------------------------------------------

    def roads(self) -> list[RoadSummary]:
        return [summary(r) for r in self.data.roads]

    def road(self, road_id: int) -> dict[str, Any] | None:
        """Full raw road record (geometry, counts, samples, lines)."""
        return self.data.by_id.get(road_id)

    # ---- priority -------------------------------------------------------

    def score(self, road_id: int, weights: Weights | None = None, votes: int = 0) -> int:
        return scoring.score(self._require(road_id), weights or Weights(), votes)

    def breakdown(self, road_id: int, weights: Weights | None = None, votes: int = 0) -> list[ScorePart]:
        return scoring.score_parts(self._require(road_id), weights or Weights(), votes)

    def ranking(
        self,
        weights: Weights | None = None,
        pins: Iterable[Pin] = (),
        votes: dict[int, int] | None = None,
    ) -> list[RankedRoad]:
        return scoring.ranking(self.data.roads, weights or Weights(), pins, votes)

    # ---- closures and routes -------------------------------------------

    def detour(self, road_id: int) -> DetourResult:
        self._require(road_id)
        return self.graph.detour(road_id)

    def closure_impact(
        self,
        road_id: int,
        date_from: str | None = None,
        date_to: str | None = None,
        restriction: str | None = None,
    ) -> list[Alert]:
        """Alerts for closing a road in a term (ISO dates). Port of TS impactAlerts.

        A full closure ("uzavírka" in `restriction`) also adds detour alerts.
        No dates and no restriction = no closure planned yet (TS `repair = null`):
        only the generic alerts for the road.
        """
        road = self._require(road_id)
        has_repair = date_from is not None or date_to is not None or restriction is not None
        alerts = impact.impact_alerts(road, date_from, date_to, restriction, self.data.connections, has_repair)
        if has_repair and impact.is_full_closure(restriction):
            d = self.graph.detour(road_id)
            via = [self.data.by_id[i] for i in dict.fromkeys(d.via_road_ids) if i in self.data.by_id]
            alerts += impact.detour_alerts(road, d, via, impact.in_school_year(date_from, date_to))
        return alerts

    def people_impact(self, road_ids: Iterable[int]) -> PeopleImpact:
        """Students and obce affected when these kraj roads (ids > 0) are closed together (T14/T15)."""
        ids = list(road_ids)
        for rid in ids:
            self._require(rid)
        return self.people.impact(ids)

    def obce(self) -> list[dict[str, Any]]:
        """Obce of the kraj (Data KHK: Obce): kod, nazev, obyvatel, deti, senioru, lon, lat, bbox."""
        return [
            {
                "kod": o["kod"],
                "nazev": o["nazev"],
                "obyvatel": o.get("obyvatel", 0),
                "deti": o.get("deti", 0),
                "senioru": o.get("senioru", 0),
                "lon": o["c"][0],
                "lat": o["c"][1],
                "bbox": o["b"],
            }
            for o in self.data.extra.get("obce", [])
        ]

    def cut_off_obce(self, road_id: int) -> list[ObecImpact]:
        """Obce that lose every road connection to a hospital when this road is closed (T15)."""
        return self.people_impact([road_id]).cut_off_obce

    def intensity(self, road_id: int) -> dict[str, Any] | None:
        """{"sv": vehicles per day, "src": "csd2025" | "odhad", "usek": census section} or None (T7)."""
        return self._require(road_id).get("intensity")

    def students_on(self, road_id: int) -> int:
        """Daily high-school students whose fastest route uses this road."""
        self._require(road_id)
        return self.people.students_on(road_id)

    def flood(self, level: str = "q100") -> FloodResult:
        """Close every road in a Q5 / Q20 / Q100 flood zone; who gets cut off?"""
        return self.people.flood(level)

    def flood_geojson(self, level: str = "q100") -> dict[str, Any]:
        """Simplified flood zone polygon (GeoJSON geometry) for the map."""
        zone = (self.data.extra.get("flood") or {}).get(level)
        if zone is None:
            raise KeyError(f"Unknown flood level {level!r} or khk_extra.json missing (scripts/fetch_khk_extra.py)")
        return zone["geojson"]

    def demo_closures(self, full_only: bool = True) -> list[DemoClosure]:
        """Real closures planned for 2022 (Data KHK) with detour, students and alerts (T16).

        `recommended=True` marks the best demo cases. Computed once (~a few s), then cached.
        """
        if self._demo is None:
            with self._demo_lock:  # separate lock: building needs self.people
                if self._demo is None:
                    self._demo = self._build_demo()
        return [c.model_copy(deep=True) for c in self._demo if c.typ_uzavirky == "úplná" or not full_only]

    def _build_demo(self) -> list[DemoClosure]:
        by_number: dict[str, list[dict[str, Any]]] = {}
        for r in self.data.roads:
            by_number.setdefault(demo.road_number(r["sil"]), []).append(r)
        people = self.people
        out: list[DemoClosure] = []
        for i, plan in enumerate(self.data.extra.get("planned2022", [])):
            ids, share, by_position = demo.match_plan(plan, by_number, self.data.roads)
            typ = plan.get("typ_uzavirky") or ""
            full = typ == "úplná"
            date_from = demo.parse_term(plan.get("od"), end=False)
            date_to = demo.parse_term(plan.get("do"), end=True)
            item = DemoClosure(
                id=i,
                nazev=(plan.get("nazev") or "").strip(),
                silnice=plan.get("silnice") or "",
                staniceni=plan.get("staniceni") or "",
                typ_uzavirky=typ,
                termin=" – ".join(t for t in (plan.get("od"), plan.get("do")) if t),
                date_from=date_from,
                date_to=date_to,
                obec=plan.get("obec") or "",
                okres=plan.get("okres") or "",
                geometry=[[(p[0], p[1]) for p in path] for path in plan.get("paths") or []],
                road_ids=ids,
                matched_share=share,
            )
            notes = []
            if by_position:
                numbers = sorted({self.data.by_id[r]["sil"].lstrip("0") for r in ids})
                notes.append(f"Číslo silnice v plánu nesedí se Stavem povrchu, spárováno podle polohy ({', '.join(numbers)}).")
            if not ids:
                notes.append(
                    f"Čára plánu neleží na úsecích v datech Stav povrchu (shoda {round(share * 100)} % délky). "
                    "Dopad nepočítáme."
                )
            elif share < 0.5:
                notes.append(f"Na našich úsecích leží jen {round(share * 100)} % délky plánu.")
            item.note = " ".join(notes)
            if ids:
                # Main úsek = longest overlap. Its intensity feeds both the field and the detour alert.
                main = self.data.by_id[ids[0]]
                inten = main.get("intensity") or {}
                if inten.get("sv"):
                    item.vehicles_per_day = int(inten["sv"])
                    item.vehicles_src = inten.get("src")
                restriction = "úplná uzavírka" if full else "částečné omezení"
                item.alerts = impact.impact_alerts(
                    main, date_from, date_to, restriction, self.data.connections, has_repair=True
                )
                if full:
                    item.detour = self.graph.detour_set(ids)
                    item.people = people.impact(ids)
                    via = [self.data.by_id[r] for r in dict.fromkeys(item.detour.via_road_ids) if r in self.data.by_id]
                    item.alerts += impact.detour_alerts(
                        main, item.detour, via, impact.in_school_year(date_from, date_to)
                    )
            out.append(item)

        # Three different stories for the demo: most students, most vehicles, longest detour.
        good = [c for c in out if c.detour and c.detour.found and c.people and c.matched_share >= 0.5]
        picks = [
            ("Nejvíc středoškoláků denně", lambda c: c.people.students_per_day),
            ("Nejvíc vozidel denně (sčítání ŘSD 2025)", lambda c: c.vehicles_per_day if c.vehicles_src == "csd2025" else 0),
            ("Nejdelší objížďka", lambda c: c.detour.extra_min or 0),
        ]
        for reason, key in picks:
            rest = [c for c in good if not c.recommended and key(c) > 0]
            if rest:
                best = max(rest, key=key)
                best.recommended, best.recommended_reason = True, reason
        return out

    def route(self, home: LonLat, work: LonLat, closed: Iterable[int] = ()) -> RouteResult:
        """Fastest route between two points. `closed` = road ids to avoid."""
        return self.graph.route(home, work, closed)

    def _require(self, road_id: int) -> dict[str, Any]:
        road = self.data.by_id.get(road_id)
        if road is None:
            raise KeyError(f"Unknown road id {road_id}")
        return road
