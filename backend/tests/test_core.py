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
    assert len(found) > 100
    for d in found:
        assert d.road_id not in d.via_road_ids
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
