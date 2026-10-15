"""S12 flood scenario and S13 municipalities plus demo closures.

The API calls Tomáš's Engine as soon as the method exists. Until then it
returns only numbers it can stand behind. Missing pieces stay null.

Waiting, and why this module does not invent them:
- T13: snapshots obce.json, flood.json, students.json, planned2022.json.
  Without them there is no population, no municipality center, no flood polygons
  and no real 2022 closures.
- T14: Engine.students_on(road_id). The agreed field DetourResult.students_per_day
  is added to schemas.py only together with Tomáš.
- T15: Engine.flood(level) and DetourResult.cut_off_obce, same schema rule.
- T16: Engine.demo_closures() from the 2022 repair plans.
"""

from __future__ import annotations

from typing import Any

from app.core.engine import Engine

_SUGGESTED: list[dict[str, Any]] | None = None


def flood_scenario(engine: Engine, level: str) -> dict[str, Any]:
    computed = _call(engine, "flood", level)
    if computed is not None:
        payload = _as_dict(computed)
        payload["level"] = level
        payload["ready"] = True
        return payload
    # T13 has not loaded flood polygons and T15 has not added Engine.flood.
    # An empty list means "not computed", not "no road is flooded".
    return {
        "level": level,
        "ready": False,
        "closed_road_ids": [],
        "cut_off_obce": None,
        "people": None,
        "students_per_day": None,
        "note": "Povodňový scénář dopočítá Engine.flood, až bude snímek záplav (Tomáš T13 a T15).",
    }


def municipalities(engine: Engine) -> dict[str, Any]:
    raw = _call(engine, "obce")
    if raw is None:
        raw = getattr(engine.data, "obce", None)
    if raw:
        return {"ready": True, "source": "data-khk", "items": [_obec(item) for item in raw]}
    # Names already sit on road segments. Code, center, boundary and population do not.
    names = sorted({name for road in engine.data.roads for name in (road.get("obce") or []) if name})
    return {
        "ready": False,
        "source": "nazvy-z-useku",
        "items": [
            {"kod": None, "nazev": name, "obyvatel": None, "lon": None, "lat": None, "hranice": None}
            for name in names
        ],
        "note": "Jsou tu jen názvy obcí uvedené u úseků. Kód, střed, hranice a počet obyvatel přijdou se sadou Obce (Tomáš T13).",
    }


def demo_closures(engine: Engine) -> dict[str, Any]:
    raw = _call(engine, "demo_closures")
    if raw:
        return {
            "ready": True,
            "source": "plany-2022",
            "items": [_demo_from_engine(item) for item in raw],
        }
    return {
        "ready": False,
        "source": "navrh-ze-site",
        "label": "demo data",
        "items": _suggested(engine),
        "note": "Skutečné ukázky z plánů oprav 2022 dodá Engine.demo_closures (Tomáš T16). Tady jsou úseky dnešní sítě, u kterých už objížďka jde spočítat.",
    }


def closure_pending_fields(engine: Engine, road_id: int, detour_payload: dict[str, Any]) -> dict[str, Any]:
    """Fields reserved for the closure card. Existing detour keys stay as they are.

    students_per_day is None until T14. cut_off_obce is None until T15 puts it on
    the detour or exposes a method. None means "not computed", not zero.
    """
    students = detour_payload.get("students_per_day")
    if students is None:
        students = _call(engine, "students_on", road_id)
    cut_off = detour_payload.get("cut_off_obce")
    if cut_off is None:
        cut_off = _call(engine, "cut_off_obce", road_id)
    return {"students_per_day": students, "cut_off_obce": cut_off}


def _call(engine: Engine, name: str, *args: Any) -> Any:
    method = getattr(engine, name, None)
    if not callable(method):
        return None
    try:
        return method(*args)
    except TypeError:
        return None


def _as_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, dict):
        return dict(value)
    return {"result": value}


def _obec(item: Any) -> dict[str, Any]:
    data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
    return {
        "kod": data.get("kod") or data.get("code"),
        "nazev": data.get("nazev") or data.get("name") or "",
        "obyvatel": data.get("obyvatel") or data.get("population"),
        "lon": data.get("lon"),
        "lat": data.get("lat"),
        "hranice": data.get("hranice") or data.get("geometry"),
    }


def _demo_from_engine(item: Any) -> dict[str, Any]:
    data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
    data.setdefault("label", "demo data")
    data.setdefault("source", "plany-2022")
    return data


def _suggested(engine: Engine) -> list[dict[str, Any]]:
    global _SUGGESTED
    if _SUGGESTED is not None:
        return _SUGGESTED
    picked: list[dict[str, Any]] = []
    seen: set[str] = set()
    checked = 0
    for road in engine.data.roads:
        if len(picked) >= 3 or checked >= 60:
            break
        reasons = _reasons(road)
        if not reasons:
            continue
        obec = (road.get("obce") or [""])[0]
        if obec and obec in seen:
            continue
        checked += 1
        detour = engine.detour(road["id"])
        if not detour.found:
            continue
        if obec:
            seen.add(obec)
        picked.append(
            {
                "road_id": road["id"],
                "usek": road.get("usek"),
                "sil": road.get("sil"),
                "obec": obec or None,
                "why": reasons,
                "detour_found": True,
                "extra_km": detour.extra_km,
                "extra_min": detour.extra_min,
                "geometry": detour.geometry,
                "label": "demo data",
                "source": "navrh-ze-site",
            }
        )
    _SUGGESTED = picked
    return picked


def _reasons(road: dict[str, Any]) -> list[str]:
    counts = road.get("counts") or {}
    reasons: list[str] = []
    if counts.get("school"):
        reasons.append("škola")
    if counts.get("hospital"):
        reasons.append("nemocnice")
    if counts.get("zzs") or counts.get("hzs"):
        reasons.append("IZS")
    if road.get("lines"):
        reasons.append("autobus")
    return reasons
