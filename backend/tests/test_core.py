import json
from pathlib import Path

import pytest

from app.core.engine import Engine
from app.core.schemas import Pin, Weights

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def engine() -> Engine:
    return Engine.load()


def test_loads_snapshot(engine: Engine):
    assert len(engine.data.roads) > 4000
    assert engine.data.stats["useky"] > 1900


def test_score_matches_frontend(engine: Engine):
    """Python score == src/lib/priority.ts roadScore for every road."""
    fx = json.loads((FIXTURES / "ts_scores.json").read_text(encoding="utf-8"))
    alt = Weights(**fx["alt"])
    from app.core import scoring

    mismatches = []
    for road_id, default_ts, alt_ts in fx["scores"]:
        road = engine.road(road_id)
        # Fixture was made with the old school weight 80; the formula itself did not change.
        py_default = scoring.score(road, Weights(schools=80), this_year=fx["year"])
        py_alt = scoring.score(road, alt, this_year=fx["year"])
        if (py_default, py_alt) != (default_ts, alt_ts):
            mismatches.append((road_id, default_ts, py_default, alt_ts, py_alt))
    assert not mismatches, mismatches[:10]


def test_ranking_classes_and_pin(engine: Engine):
    rows = engine.ranking()
    assert [r.rank for r in rows[:3]] == [1, 2, 3]
    assert rows[0].priority == "kriticka"
    assert rows[-1].priority == "nizka"
    assert rows[0].score >= rows[100].score

    low = rows[-1].road.id
    pinned = engine.ranking(pins=[Pin(road_id=low, priority="kriticka", reason="havárie")])
    top = pinned[0]
    assert top.road.id == low and top.pinned and top.model_class == "nizka" and top.priority == "kriticka"


def test_votes_are_weak_and_capped(engine: Engine):
    road_id = engine.data.roads[0]["id"]
    base = engine.score(road_id, Weights(votes=100))
    assert engine.score(road_id, Weights(votes=100), votes=1000) - base <= 10
    assert engine.score(road_id, Weights(votes=0), votes=1000) == engine.score(road_id, Weights(votes=0))


def test_detour_found_and_avoids_closed_road(engine: Engine):
    results = [engine.detour(r["id"]) for r in engine.data.roads[:300]]
    found = [d for d in results if d.found]
    # With OSM I. class roads most detours exist (~81 % on the full network).
    assert len(found) / len(results) > 0.7
    for d in found:
        assert d.road_id not in d.via_road_ids
        assert all(rid > 0 for rid in d.via_road_ids)
        assert d.detour_km and d.detour_km > 0
        assert len(d.geometry) >= 2


def test_route_and_closure(engine: Engine):
    # Two points on roads in the largest component.
    d = next(engine.detour(r["id"]) for r in engine.data.roads if engine.detour(r["id"]).found)
    road = engine.road(d.road_id)
    a, b = tuple(road["g"][0]), tuple(road["g"][-1])
    r = engine.route(a, b)
    assert r.found and r.road_ids
    blocked = engine.route(a, b, closed=[d.road_id])
    assert blocked.found and d.road_id not in blocked.road_ids
    assert blocked.minutes >= r.minutes


def test_osm_roads_connect_the_network(engine: Engine):
    assert engine.data.osm_roads, "public/data/osm_roads.json missing (scripts/fetch_osm_roads.py)"
    import networkx as nx

    g = engine.graph.graph
    biggest = max(nx.connected_components(g), key=len)
    khk_in_biggest = {d["road_id"] for _, _, d in g.subgraph(biggest).edges(data=True) if d["road_id"] > 0}
    # Other components are OSM-only roads outside the kraj (e.g. Poland).
    assert len(khk_in_biggest) / len(engine.data.roads) > 0.9


def test_impact_alerts_match_frontend(engine: Engine):
    """Python impact_alerts == src/lib/priority.ts impactAlerts (texts, order, levels)."""
    from app.core import impact

    fx = json.loads((FIXTURES / "ts_alerts.json").read_text(encoding="utf-8"))
    mismatches = []
    for road_id, k, ts_alerts in fx["rows"]:
        rep = fx["repairs"][k]
        py = impact.impact_alerts(
            engine.road(road_id),
            rep and rep["from"],
            rep and rep["to"],
            rep and rep["restriction"],
            engine.data.connections,
            has_repair=rep is not None,
        )
        if [a.model_dump() for a in py] != ts_alerts:
            mismatches.append((road_id, k))
    assert not mismatches, mismatches[:10]


def test_school_year_and_winter():
    from app.core.impact import in_school_year, in_winter

    assert not in_school_year("2026-07-01", "2026-08-31")
    assert in_school_year("2026-08-15", "2026-09-05")
    assert in_school_year("2026-12-20", "2027-01-10")
    assert in_school_year(None, None)
    assert in_winter("2026-03-20", "2026-04-10")
    assert not in_winter("2026-04-01", "2026-10-31")
    assert in_winter("2026-10-20", "2026-11-02")


def test_closure_impact_adds_detour_alerts(engine: Engine):
    found = next(r["id"] for r in engine.data.roads if engine.detour(r["id"]).found)
    missing = next(r["id"] for r in engine.data.roads if not engine.detour(r["id"]).found)

    full = engine.closure_impact(found, "2026-07-01", "2026-08-20", "úplná uzavírka")
    assert any(a.title.startswith("Objížďka +") for a in full)
    partial = engine.closure_impact(found, "2026-07-01", "2026-08-20", "částečné omezení")
    assert not any(a.title.startswith("Objížďka") for a in partial)

    cut = engine.closure_impact(missing, restriction="úplná uzavírka")
    assert any(a.title == "Objížďka nenalezena" and a.level == "critical" for a in cut)
    # No term and no restriction = no closure yet: no detour alerts (TS repair = null).
    assert not any(a.title.startswith("Objížďka") for a in engine.closure_impact(found))


def test_student_flows(engine: Engine):
    """Data KHK Dojížďka do středních škol: every flow routed, sums add up."""
    if not engine.data.extra:
        pytest.skip("public/data/khk_extra.json missing (scripts/fetch_khk_extra.py)")
    p = engine.people
    total = sum(fl["n"] for fl in engine.data.extra["students"])
    routed = sum(n for _, n, _, _ in p.flows)
    assert routed + p.unrouted_students == total
    assert routed / total > 0.95
    busiest = max(p.road_students, key=p.road_students.get)
    assert p.road_students[busiest] > 1000
    assert engine.students_on(busiest) == p.road_students[busiest]

    impact = engine.people_impact([busiest])
    assert impact.students_per_day >= p.road_students[busiest]
    assert impact.students_by_obec and impact.students_by_obec[0].studenti > 0


def test_cut_off_obec_on_dead_end(engine: Engine):
    if not engine.data.extra:
        pytest.skip("khk_extra.json missing")
    dead_ends = []
    for r in engine.data.roads:
        d = engine.detour(r["id"])
        if not d.found and d.closed_km > 0:
            dead_ends.append(r["id"])
        if len(dead_ends) == 40:
            break
    impacts = [engine.people_impact([rid]) for rid in dead_ends]
    cut = [i for i in impacts if i.cut_off_obce]
    assert cut, "closing a dead-end road should cut off some obce"
    assert all(i.cut_off_people == sum(o.obyvatel for o in i.cut_off_obce) for i in cut)
    # A road with a detour never cuts anyone off.
    ok = next(r["id"] for r in engine.data.roads if engine.detour(r["id"]).found)
    assert not engine.people_impact([ok]).cut_off_obce


def test_flood_levels_grow(engine: Engine):
    if not engine.data.extra:
        pytest.skip("khk_extra.json missing")
    q5, q20, q100 = (engine.flood(lvl) for lvl in ("q5", "q20", "q100"))
    assert 0 < q5.flooded_km <= q20.flooded_km <= q100.flooded_km
    assert set(q5.closed_road_ids) <= set(q100.closed_road_ids)
    assert q100.students_per_day > 0
    assert engine.flood_geojson("q100")["type"] in ("Polygon", "MultiPolygon")


def test_intensity_from_rsd(engine: Engine):
    if not any(r.get("intensity") for r in engine.data.roads):
        pytest.skip("public/data/intensity.json missing (scripts/fetch_rsd_counts.py)")
    measured = [r for r in engine.data.roads if (r.get("intensity") or {}).get("src") == "csd2025"]
    km = sum(r["delka"] for r in measured) / 1000
    assert km > 1000  # ~1 343 of 3 192 km are matched to census sections
    assert all(r["intensity"]["sv"] > 0 for r in engine.data.roads if r.get("intensity"))
    s = engine.roads()[0]
    assert s.intensity and s.intensity_src in ("csd2025", "odhad")
    road = next(r for r in measured if engine.detour(r["id"]).found)
    alerts = engine.closure_impact(road["id"], "2026-07-01", "2026-08-20", "úplná uzavírka")
    assert any("vozidel denně" in a.title for a in alerts)


def test_detour_set_matches_single_detour(engine: Engine):
    road = next(r["id"] for r in engine.data.roads if engine.detour(r["id"]).found)
    one, many = engine.detour(road), engine.graph.detour_set([road])
    assert many.found and many.closed_road_ids == [road]
    assert many.detour_km == one.detour_km and many.extra_min == one.extra_min


def test_parse_term():
    from app.core.demo import parse_term, road_number

    assert parse_term("04/2022", end=False) == "2022-04-01"
    assert parse_term("02/2024", end=True) == "2024-02-29"
    assert parse_term("2022", end=True) == "2022-12-31"
    assert parse_term("", end=False) is None
    assert road_number("III/02864") == road_number("2864") == "2864"


def test_demo_closures_2022(engine: Engine):
    if not engine.data.extra.get("planned2022"):
        pytest.skip("khk_extra.json missing")
    full = engine.demo_closures()
    assert full and all(c.typ_uzavirky == "úplná" for c in full)
    assert len(engine.demo_closures(full_only=False)) == len(engine.data.extra["planned2022"])
    matched = [c for c in full if c.road_ids]
    assert len(matched) >= 0.8 * len(full)
    rec = [c for c in full if c.recommended]
    assert len(rec) == 3 and len({c.recommended_reason for c in rec}) == 3
    for c in rec:
        assert c.detour and c.detour.found and set(c.detour.closed_road_ids) == set(c.road_ids)
        assert set(c.detour.via_road_ids).isdisjoint(c.road_ids)
        assert c.people and c.people.closed_road_ids == sorted(c.road_ids)
        assert c.date_from and c.date_to and c.date_from <= c.date_to
        assert any(a.title.startswith("Objížďka +") for a in c.alerts)
    # Returned copies: changing one does not change the cache.
    full[0].nazev = "x"
    assert engine.demo_closures()[0].nazev != "x"


def test_obce_and_cut_off_for_api(engine: Engine):
    if not engine.data.extra.get("obce"):
        pytest.skip("khk_extra.json missing")
    obce = engine.obce()
    assert len(obce) == len(engine.data.extra["obce"]) and obce[0]["lon"] and obce[0]["kod"]
    road = next(r["id"] for r in engine.data.roads if engine.detour(r["id"]).found)
    assert engine.cut_off_obce(road) == []


def test_srti_closures(engine: Engine):
    if not engine.data.srti.get("items"):
        pytest.skip("public/data/srti.json missing (scripts/fetch_srti.py)")
    items = engine.srti_closures(on="2026-10-15")
    assert len(items) == len(engine.data.srti["items"])
    assert any(i.full_closure for i in items)
    snapped = [i for i in items if i.road_id is not None]
    assert snapped and all(engine.road(i.road_id) for i in snapped) and snapped[0].road_label
    active = engine.srti_closures(on="2026-10-15", active_only=True)
    assert all(i.active for i in active) and len(active) <= len(items)


def test_stavby_are_one_road_one_okres_and_bad_at_ends(engine: Engine) -> None:
    from app.core import budget

    stavby = engine.stavby()
    assert stavby
    seen: set[int] = set()
    for s in stavby:
        roads = [engine.road(r) for r in s.road_ids]
        assert {r["sil"] for r in roads} == {s.sil}
        assert {r["okres"] for r in roads} == {s.okres}
        assert roads[0]["stav"] in budget.BAD and roads[-1]["stav"] in budget.BAD
        assert all(engine.road(g)["delka"] <= budget.GAP_M for g in s.gap_road_ids)
        assert not seen & set(s.road_ids)
        seen |= set(s.road_ids)
    assert max(s.km for s in stavby) <= budget.MAX_KM + 2.5  # one úsek can overshoot


def test_budget_plan_fits_and_is_deterministic(engine: Engine) -> None:
    a = engine.budget_plan(100_000_000, with_detours=False)
    b = engine.budget_plan(100_000_000, with_detours=False)
    assert a.model_dump() == b.model_dump()
    assert 0 < a.spent_kc <= a.amount_kc
    assert a.spent_kc == sum(s.cost_kc for s in a.stavby)
    assert a.havarijni_km_left == round(a.havarijni_km_total - a.havarijni_km_fixed, 1)
    more = engine.budget_plan(250_000_000, with_detours=False)
    assert more.km > a.km
    urgent = engine.budget_plan(100_000_000, order="score", with_detours=False)
    assert urgent.havarijni_km_fixed > a.havarijni_km_fixed
    assert engine.budget_plan(0, with_detours=False).stavby == []
    okres = engine.budget_plan(100_000_000, okres="Náchod", with_detours=False)
    assert okres.stavby and {s.okres for s in okres.stavby} == {"Náchod"}


def test_budget_plan_detours(engine: Engine) -> None:
    plan = engine.budget_plan(30_000_000, order="score")
    assert plan.stavby and all(s.detour is not None for s in plan.stavby)
    assert all(s.detour.closed_road_ids == s.road_ids or len(s.road_ids) == 1 for s in plan.stavby)


def test_stability(engine: Engine) -> None:
    r = engine.stability(top_n=50, samples=20)
    assert [i.road_id for i in r.items] == [x.road.id for x in engine.ranking()][:50]
    assert all(0 <= i.share <= 1 for i in r.items)
    assert r.items[0].label == "jisté"
    assert engine.stability(top_n=50, samples=20).model_dump() == r.model_dump()
    w = Weights(stav=60, schools=100, transit=20, age=90)
    assert [i.road_id for i in engine.stability(w, top_n=50, samples=1).items] == [
        x.road.id for x in engine.ranking(w)
    ][:50]
    same = engine.stability(top_n=50, samples=5, spread=0)
    assert all(i.share == 1 for i in same.items)


def test_rescue_impact(engine: Engine) -> None:
    from app.core import rescue

    assert engine.rescue.bases["zzs"] and engine.rescue.bases["hzs"]
    assert engine.rescue_impact([]).obce == []
    demo = {c.silnice: c for c in engine.demo_closures()}
    r = engine.rescue_impact(demo["II/327"].road_ids)
    assert r.obce and r.src == "estimate"
    assert all(o.extra_min is None or o.extra_min >= rescue.MIN_EXTRA for o in r.obce)
    assert all(not o.over_limit or (o.service == "zzs" and o.before_min <= rescue.LIMIT_MIN) for o in r.obce)
    assert r.zzs_over_limit == sum(o.over_limit for o in r.obce)
    assert demo["II/327"].rescue is not None
    assert any(a.title.startswith("Záchranka přes") for a in demo["II/327"].alerts) == (r.zzs_over_limit > 0)


def test_t20_factors_off_by_default_and_on_when_weighted(engine: Engine) -> None:
    keys = [p.key for p in engine.breakdown(2773)]
    assert not {"intensity", "detour", "students"} & set(keys)
    w = Weights(intensity=50, detour=50, students=50)
    parts = {p.key: p.points for p in engine.breakdown(2773, w)}
    assert {"intensity", "detour", "students"} <= set(parts)
    assert all(0 <= parts[k] <= 12 for k in ("intensity", "detour", "students"))
    road = engine.road(2773)
    assert "students" in road["factors"] and "detour_min" in road["factors"]
    top = engine.ranking(w)
    assert top[0].score >= top[-1].score
    assert engine.score(2773, w) >= engine.score(2773)


def test_warmup_builds_every_cache(engine: Engine) -> None:
    times = engine.warmup()
    assert set(times) == {"people", "rescue", "demo_closures", "factors", "stavby", "road_grid"}
    assert engine._factors_ready and engine._road_grid is not None
    assert all("factors" in r for r in engine.data.roads)
    again = engine.warmup()
    assert sum(again.values()) < 1  # everything cached


def test_road_obce_are_unique_ignoring_case(engine: Engine) -> None:
    """T22: the layers spell some obce in two ways ("Hradec králové")."""
    dupes = [r["id"] for r in engine.data.roads if len({o.lower() for o in r["obce"]}) < len(r["obce"])]
    assert dupes == []


def test_detour_factor_cut_off_only_when_network_is_cut(engine: Engine) -> None:
    """Review 15 Oct: a loop úsek got the cut-off maximum; it has no detour to compute."""
    engine.warmup()
    loops = [r for r in engine.data.roads if (e := engine.graph.road_ends.get(r["id"])) and e[0] == e[1]]
    assert loops and not any(r["factors"]["cut_off"] for r in loops)
    cut = [r for r in engine.data.roads if r["factors"]["cut_off"]]
    assert cut and all(r["factors"]["detour_min"] is None for r in cut)


def test_stavby_never_longer_than_max(engine: Engine) -> None:
    from app.core import budget

    assert max(s.km for s in engine.stavby()) <= budget.MAX_KM + 1e-9


def test_rescue_czech_plural() -> None:
    from app.core.rescue import _obce

    assert [_obce(n) for n in (1, 3, 5, 11, 21, 22, 25, 112)] == [
        "1 obec", "3 obce", "5 obcí", "11 obcí", "21 obcí", "22 obcí", "25 obcí", "112 obcí",
    ]


def test_rescue_obec_on_closure_never_faster(engine: Engine) -> None:
    """Review 15 Oct: an obec on the closed stretch was dropped as 'faster after closure'."""
    for c in engine.demo_closures():
        if c.rescue:
            assert all(r.extra_min is None or r.extra_min >= 0 for r in c.rescue.obce)
