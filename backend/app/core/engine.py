"""Engine: the only entry point the API layer uses from core.

The engine is stateless towards the database. The API passes in pins, votes,
weights and closures; the engine computes. Load it once at startup.
"""

from __future__ import annotations

import heapq
import math
import random
import threading
from datetime import date
from pathlib import Path
from typing import Any, Iterable

from . import budget, demo, impact, scoring
from .data import Dataset, load_dataset, summary
from .graph import RoadGraph, to_xy
from .people import People
from .schemas import Alert, BudgetPlan, DemoClosure, StableRoad, StabilityResult, Stavba, SrtiClosure, DetourResult, FloodResult, ObecImpact, PeopleImpact, LonLat, Pin, RankedRoad, RoadSummary, RouteResult, ScorePart, Weights


class Engine:
    def __init__(self, dataset: Dataset):
        self.data = dataset
        self.graph = RoadGraph.build(dataset.roads, dataset.osm_roads)
        self._people: People | None = None
        self._people_lock = threading.Lock()
        self._demo: list[DemoClosure] | None = None
        self._demo_lock = threading.Lock()
        self._road_grid: dict[tuple[int, int], list[tuple[float, float, int]]] | None = None
        self._stavby: list[Stavba] | None = None
        self._stavby_lock = threading.Lock()

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

    def stability(
        self, weights: Weights | None = None, top_n: int = 100, samples: int = 50, spread: float = 0.5, seed: int = 0
    ) -> StabilityResult:
        """How sure the top N is (T10). Model order only, no pins and no votes.

        Each part of the score is linear in its weight, so the parts are computed
        once at weight 100 and rescaled for each random weight set.
        """
        w = weights or Weights()
        samples = max(1, samples)
        keys = list(Weights.model_fields)
        full = Weights(**{k: 100 for k in keys})
        roads = self.data.roads
        base = [[pt for _, _, pt in scoring._raw_parts(r, full, 0, None)] for r in roads]
        ids = [r["id"] for r in roads]
        n = min(top_n, len(roads))

        def top(wv: list[float]) -> list[int]:
            scores = []
            for rid, parts in zip(ids, base):
                total = 0.0
                for pt, k in zip(parts, wv):
                    total += pt * k / 100
                scores.append((-scoring.js_round(total), rid))
            return [rid for _, rid in heapq.nsmallest(n, scores)]

        given = [getattr(w, k) for k in keys]
        ranked = top(given)
        rng = random.Random(seed)
        hits = dict.fromkeys(ranked, 0)
        for _ in range(samples):
            wv = [min(100.0, max(0.0, v * rng.uniform(1 - spread, 1 + spread))) for v in given]
            for rid in top(wv):
                if rid in hits:
                    hits[rid] += 1
        items = []
        for i, rid in enumerate(ranked, start=1):
            share = round(hits[rid] / samples, 2)
            label = "jisté" if share >= 0.9 else "pravděpodobné" if share >= 0.5 else "nejisté"
            items.append(StableRoad(road_id=rid, rank=i, share=share, label=label))
        return StabilityResult(
            top_n=n,
            samples=samples,
            spread=spread,
            items=items,
            note=f"{samples} náhodných sad vah (každá váha ±{round(spread * 100)} %). "
            f"„jisté“ = v top {n} aspoň v 90 % sad.",
        )

    # ---- budget (T17) ---------------------------------------------------

    def stavby(self) -> list[Stavba]:
        """All candidate stavby (bad úseky joined per road and okres), without score and cost."""
        if self._stavby is None:
            with self._stavby_lock:
                if self._stavby is None:
                    self._stavby = budget.build_stavby(self.data.roads, self.graph)
        return [s.model_copy(deep=True) for s in self._stavby]

    def budget_plan(
        self,
        amount_kc: int,
        weights: Weights | None = None,
        okres: str | None = None,
        prices: dict[str, int] | None = None,
        order: str = "per_kc",
        with_detours: bool = True,
    ) -> BudgetPlan:
        """Stavby a budget buys (T17). Prices are an estimate; the plan is deterministic."""
        w = weights or Weights()
        p = {**budget.PRICES_KC_PER_KM, **(prices or {})}
        by_id = self.data.by_id
        cands = [s for s in self.stavby() if okres is None or s.okres == okres]
        for s in cands:
            bad = [by_id[r] for r in s.road_ids if r not in s.gap_road_ids]
            km = sum(r["delka"] for r in bad) or 1
            s.score = round(sum(scoring.score(r, w) * r["delka"] for r in bad) / km, 1)
            s.cost_kc = budget.price(s, p)
            if s.km < budget.MIN_KM:
                s.warnings.append("Krátká stavba (pod 0,5 km).")
        chosen = budget.select(cands, max(0, int(amount_kc)), "score" if order == "score" else "per_kc")
        if with_detours:
            for s in chosen:
                s.detour = self.graph.detour_set(s.road_ids)
                if not s.detour.found:
                    s.warnings.append("Objížďka nenalezena: úplná uzavírka by odřízla část sítě.")
                elif (s.detour.extra_km or 0) > 15:
                    s.warnings.append(f"Dlouhá objížďka: +{s.detour.extra_km:.1f} km.")
        hav = lambda s: sum(km for st, km in s.stav_km.items() if st in budget.HAVARIJNI)  # noqa: E731
        hav_total = sum(
            r["delka"]
            for r in self.data.roads
            if r["stav"] in budget.HAVARIJNI and r["id"] in self.graph.road_ends and (okres is None or r["okres"] == okres)
        ) / 1000
        hav_total, hav_fixed = round(hav_total, 1), round(sum(hav(s) for s in chosen), 1)
        return BudgetPlan(
            amount_kc=int(amount_kc),
            spent_kc=sum(s.cost_kc for s in chosen),
            km=round(sum(s.km for s in chosen), 2),
            stavby=chosen,
            havarijni_km_total=hav_total,
            havarijni_km_fixed=hav_fixed,
            havarijni_km_left=round(hav_total - hav_fixed, 1),
            candidates=len(cands),
            prices_kc_per_km=p,
            order="score" if order == "score" else "per_kc",
            okres=okres,
            note="Ceny za km jsou předpoklad (CDV, Liberecký kraj), ne rozpočet. "
            "Pořadí a poměry platí, přesné částky ne.",
        )

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

    def srti_closures(self, on: str | None = None, active_only: bool = False) -> list[SrtiClosure]:
        """Current road works and closures in the kraj from ŘSD / NDIC SRTI (T8).

        `on` = ISO day for the `active` flag (default today). Each item is snapped
        to the nearest kraj úsek within 100 m (`road_id`), if there is one.
        """
        day = on or date.today().isoformat()
        out: list[SrtiClosure] = []
        for it in self.data.srti.get("items", []):
            start, end = (it.get("start") or "")[:10], (it.get("end") or "")[:10]
            active = (not start or start <= day) and (not end or day <= end)
            if active_only and not active:
                continue
            road_id = self._nearest_road((it["lon"], it["lat"]), 100.0)
            road = self.data.by_id.get(road_id) if road_id is not None else None
            out.append(
                SrtiClosure(
                    id=it["id"],
                    label=it.get("label", ""),
                    full_closure=bool(it.get("full_closure")),
                    lon=it["lon"],
                    lat=it["lat"],
                    start=it.get("start"),
                    end=it.get("end"),
                    active=active,
                    road=it.get("road"),
                    road_id=road_id,
                    road_label=_road_label(road) if road else None,
                    snapshot=self.data.srti.get("snapshot", ""),
                )
            )
        return out

    def _nearest_road(self, p: LonLat, max_m: float) -> int | None:
        """Nearest kraj road (id > 0) by vertex distance, within max_m metres."""
        if self._road_grid is None:
            grid: dict[tuple[int, int], list[tuple[float, float, int]]] = {}
            for r in self.data.roads:
                for lon, lat in r["g"]:
                    x, y = to_xy((lon, lat))
                    grid.setdefault((int(x // 200), int(y // 200)), []).append((x, y, r["id"]))
            self._road_grid = grid
        x, y = to_xy(p)
        cx, cy = int(x // 200), int(y // 200)
        best, best_d = None, max_m
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for vx, vy, rid in self._road_grid.get((cx + dx, cy + dy), ()):
                    d = math.hypot(vx - x, vy - y)
                    if d <= best_d:
                        best, best_d = rid, d
        return best

    def route(self, home: LonLat, work: LonLat, closed: Iterable[int] = ()) -> RouteResult:
        """Fastest route between two points. `closed` = road ids to avoid."""
        return self.graph.route(home, work, closed)

    def _require(self, road_id: int) -> dict[str, Any]:
        road = self.data.by_id.get(road_id)
        if road is None:
            raise KeyError(f"Unknown road id {road_id}")
        return road


def _road_label(road: dict[str, Any]) -> str:
    trida = {"2": "II", "3": "III"}.get(str(road.get("trida", ""))[:1], "")
    num = str(road.get("sil", "")).lstrip("0")
    obce = road.get("obce") or []
    return f"{trida}/{num}" + (f" ({obce[0]})" if obce else "") if trida else num
