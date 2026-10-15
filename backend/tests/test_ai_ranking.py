"""City-ranking shift and the Groq fallback. No network."""

from app.ai.ranking import _points_from_model, reorder_window
from app.ai.service import complete
from app.core.schemas import RankedRoad, RoadSummary


def _row(index: int, score: int, pinned: bool = False) -> RankedRoad:
    return RankedRoad(
        road=RoadSummary(
            id=index,
            usek=str(index),
            sil="II/1",
            trida="II",
            okres="HK",
            stav="havarijní",
            rok=2022,
            delka_m=100,
            last_repair=None,
            obce=[],
            lines=[],
        ),
        score=score,
        model_class="kriticka",
        priority="kriticka",
        pinned=pinned,
        rank=index + 1,
    )


def test_shift_stops_at_five_places():
    rows = [_row(index, 100 - index) for index in range(10)]
    ordered = reorder_window(rows, {7: 100}, window=10, max_shift=5)
    place = {row.road.id: index for index, row in enumerate(ordered)}
    assert place[7] == 2
    for road_id, index in place.items():
        assert abs(index - road_id) <= 5


def test_pinned_road_does_not_move():
    rows = [_row(index, 100 - index, pinned=(index == 3)) for index in range(10)]
    ordered = reorder_window(rows, {7: 100}, window=10, max_shift=5)
    assert [row.road.id for row in ordered].index(3) == 3
    assert [row.road.id for row in ordered].index(7) == 4


def test_points_are_clamped_and_unknown_ids_dropped():
    parsed = _points_from_model('{"items":[{"id":"12","points":"140","reason":"souběh"},{"id":"x","points":1}]}')
    assert parsed == {12: (100, "souběh")}


def test_second_model_runs_when_the_first_fails(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setenv("AI_API_KEY", "test-key")
    monkeypatch.setenv("AI_ENDPOINT", "https://example.test/v1")
    monkeypatch.setenv("AI_MODEL", "openai/gpt-oss-120b")
    monkeypatch.setenv("AI_MODEL_FALLBACK", "openai/gpt-oss-20b")
    monkeypatch.setattr("app.ai.service._cache_get", lambda _key: None)
    monkeypatch.setattr("app.ai.service._cache_put", lambda _key, _payload: None)
    calls = []

    def fake(_settings, _system, _user, model, _temperature):
        calls.append(model)
        if model.endswith("120b"):
            return None
        return "záloha"

    monkeypatch.setattr("app.ai.service._chat_completions", fake)
    assert complete("system", "user-fallback") == "záloha"
    assert calls == ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
