"""T20 weights move the order when they are turned on (B-W-2)."""

from __future__ import annotations

from app.core.scoring import ranking
from app.core.schemas import Weights


def _road(road_id: int, students: int = 0, vehicles: int = 0, detour_min: float = 0, cut_off: bool = False) -> dict:
    return {
        "id": road_id,
        "usek": str(road_id),
        "sil": "303",
        "trida": "2. třída",
        "okres": "Náchod",
        "stav": "havarijní",
        "rok": 2020,
        "delka": 1000,
        "lastRepair": 2010,
        "obce": ["Hronov"],
        "lines": [],
        "worse": False,
        "hsoo": False,
        "counts": {},
        "intensity": {"sv": vehicles, "src": "odhad"},
        "factors": {"students": students, "detour_min": detour_min, "cut_off": cut_off},
    }


def test_students_weight_moves_school_route_up():
    quiet = _road(1, students=0)
    school = _road(2, students=400)
    off = ranking([school, quiet], Weights(students=0))
    on = ranking([school, quiet], Weights(students=100))
    assert [row.road.id for row in off] == [1, 2]
    assert on[0].road.id == 2
    assert on[0].score > off[0].score


def test_intensity_and_detour_add_points():
    road = _road(1, vehicles=8000, detour_min=20)
    base = ranking([road], Weights())[0].score
    busy = ranking([road], Weights(intensity=100))[0].score
    long = ranking([road], Weights(detour=100))[0].score
    cut = ranking([_road(1, cut_off=True)], Weights(detour=100))[0].score
    assert busy > base
    assert long > base
    assert cut > long
