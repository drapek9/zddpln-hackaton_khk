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
        py_default = scoring.score(road, Weights(), this_year=fx["year"])
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
