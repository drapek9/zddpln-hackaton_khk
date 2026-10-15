"""Budget plans for an official.

The call is the one in PLAN_FINAL chapter 17:
`Engine.budget_plan(amount_kc, weights) -> BudgetPlan`
(`stavby`, `km`, `spent_kc`, `havarijni_km_left`).
The price on that plan is an estimate (`label: estimate`).

This module does not build projects or prices. If the method is missing,
`ready` is false and no crown amount is invented. Field names below match
`BudgetPlan` / `Stavba` in core/schemas.py.

Not in that signature, so not computed here either:
- a price per m², depth, surface or years since the last repair
- a chain that continues onto a different road number
- five to ten separate offers under one ceiling
If `budget_plan` later returns `offers`, they are passed through unchanged.
"""

from __future__ import annotations

from typing import Any

from app.core.engine import Engine
from app.core.schemas import Weights

_WAITING = (
    "Rozpočtový plán dopočítá Engine.budget_plan, až ho dodá Tomáš (T17). "
    "Částku teď nevymýšlíme."
)


def budget_plans(engine: Engine, amount: int, amount2: int | None, weights: Weights) -> dict[str, Any]:
    method = getattr(engine, "budget_plan", None)
    payload = _empty(amount, amount2, _WAITING)
    if not callable(method):
        return payload
    plans = [_one(method, amount, weights)]
    if amount2 is not None:
        plans.append(_one(method, amount2, weights))
    if any(item is None for item in plans):
        payload["note"] = (
            "Engine.budget_plan existuje, ale nešlo z něj přečíst stavby, kilometry a koruny. "
            "Částku nevymýšlíme."
        )
        return payload
    payload["ready"] = True
    payload["plans"] = plans
    payload["note"] = "Cena je předpoklad. Pořadí počítá model, člověk ho potvrzuje."
    return payload


def normalize_plan(result: Any, amount: int) -> dict[str, Any] | None:
    """Read a BudgetPlan. Returns None when the numbers are not there."""
    data = _as_dict(result)
    if data is None:
        return None
    projects = _projects(data.get("projects") or data.get("stavby") or data.get("items"))
    repaired_km = _number(data, "repaired_km", "km", "opravene_km")
    cost_kc = _number(data, "spent_kc", "cost_kc", "cena", "kc")
    remaining = _number(data, "havarijni_km_left", "remaining_emergency_km", "havarijni_km_zbytek", "havarijni_km")
    if projects is None and repaired_km is None and cost_kc is None and remaining is None:
        return None
    plan = {
        "amount": int(_number(data, "amount", "amount_kc") or amount),
        "repaired_km": repaired_km if repaired_km is not None else _sum(projects, "km"),
        "cost_kc": cost_kc if cost_kc is not None else _sum(projects, "cost_kc"),
        "remaining_emergency_km": remaining,
        "projects": projects or [],
        "label": "estimate",
    }
    offers = data.get("offers") or data.get("nabidky")
    if isinstance(offers, list):
        plan["offers"] = [_as_dict(item) or {} for item in offers]
    return plan


def _one(method, amount: int, weights: Weights) -> dict[str, Any] | None:
    try:
        result = method(amount, weights)
    except TypeError:
        try:
            result = method(amount_kc=amount, weights=weights)
        except TypeError:
            return None
    return normalize_plan(result, amount)


def _empty(amount: int, amount2: int | None, note: str) -> dict[str, Any]:
    return {
        "ready": False,
        "amount": amount,
        "amount2": amount2,
        "plans": [],
        "label": "estimate",
        "note": note,
    }


def _projects(raw: Any) -> list[dict[str, Any]] | None:
    if not isinstance(raw, list):
        return None
    projects = []
    for item in raw:
        data = _as_dict(item)
        if data is None:
            continue
        projects.append(
            {
                "sil": data.get("sil") or data.get("road") or data.get("silnice"),
                "okres": data.get("okres"),
                "km": _number(data, "km", "delka_km", "length_km"),
                "cost_kc": _number(data, "cost_kc", "cena", "kc"),
                "score": _number(data, "score", "skore"),
                "extra_km": _detour_km(data.get("detour")) if data.get("detour") is not None else _number(data, "extra_km", "objizdka_km"),
                "road_ids": list(data.get("road_ids") or []),
                "label": "estimate",
            }
        )
    return projects


def _detour_km(value: Any) -> int | float | None:
    data = _as_dict(value)
    if data is None:
        return None
    return _number(data, "extra_km", "objizdka_km")


def _as_dict(value: Any) -> dict[str, Any] | None:
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        return dumped if isinstance(dumped, dict) else None
    if isinstance(value, dict):
        return dict(value)
    return None


def _number(data: dict[str, Any], *keys: str) -> int | float | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, bool) or value is None:
            continue
        if isinstance(value, (int, float)):
            return value
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _sum(projects: list[dict[str, Any]] | None, key: str) -> int | float | None:
    if not projects:
        return None
    values = [item[key] for item in projects if isinstance(item.get(key), (int, float))]
    if not values:
        return None
    return sum(values)
