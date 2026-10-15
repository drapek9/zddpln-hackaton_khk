"""City ranking assist. The formula order stays in core. This only shifts it.

The model sees the first 25 roads and returns points, not a new order.
A road may move at most 5 places. Pinned roads stay where the official put them.
Outside that window nothing moves, so the top 10 only draws from those 25.
"""

from __future__ import annotations

import json

from app.ai.service import _extract_json, complete
from app.core.engine import Engine
from app.core.schemas import RankedRoad

CITY_WINDOW = 25
MAX_SHIFT = 5

_SYSTEM = (
    "Jsi asistent kraje. Ke každému úseku dej body 0 až 100: jak moc má být výš "
    "kvůli souběhu špatného stavu se školou, nemocnicí nebo záchrankou, který samotné skóre schová. "
    "Používej jen údaje na řádku. Nic nevymýšlej a nevracej pořadí. "
    'Vrať jen JSON {"items":[{"id":číslo,"points":0-100,"reason":"jedna věta česky"}]}.'
)


def reorder_window(
    rows: list[RankedRoad],
    points: dict[int, int],
    window: int = CITY_WINDOW,
    max_shift: int = MAX_SHIFT,
) -> list[RankedRoad]:
    """Permute the head of the list. Each unpinned road stays within max_shift of its place."""
    window = min(window, len(rows))
    head = [row.model_copy() for row in rows[:window]]
    tail = list(rows[window:])
    original = {row.road.id: index for index, row in enumerate(head)}
    combined = {row.road.id: row.score + int(points.get(row.road.id, 0)) for row in head}
    moved = True
    while moved:
        moved = False
        for index in range(len(head) - 1):
            left = head[index]
            right = head[index + 1]
            if left.pinned or right.pinned:
                continue
            if combined[right.road.id] <= combined[left.road.id]:
                continue
            if abs(index - original[right.road.id]) > max_shift:
                continue
            if abs((index + 1) - original[left.road.id]) > max_shift:
                continue
            head[index], head[index + 1] = right, left
            moved = True
    ordered = []
    for index, row in enumerate(head, start=1):
        ordered.append(row.model_copy(update={"rank": index}))
    return ordered + tail


def city_order(engine: Engine, rows: list[RankedRoad]) -> tuple[list[RankedRoad], dict[int, dict]] | None:
    """One model call for the window. None means the formula order should stay."""
    window = rows[:CITY_WINDOW]
    if not window:
        return None
    raw = complete(_SYSTEM, _prompt(engine, window), temperature=0)
    parsed = _points_from_model(raw)
    if not parsed:
        return None
    points = {row.road.id: parsed[row.road.id][0] for row in window if row.road.id in parsed}
    if not points:
        return None
    formula_rank = {row.road.id: row.rank for row in rows}
    ordered = reorder_window(rows, points)
    extras: dict[int, dict] = {}
    for row in window:
        got = parsed.get(row.road.id)
        extras[row.road.id] = {
            "points": got[0] if got else 0,
            "reason": got[1] if got else None,
            "formula_rank": formula_rank[row.road.id],
        }
    return ordered, extras


def _prompt(engine: Engine, rows: list[RankedRoad]) -> str:
    lines = []
    for row in rows:
        road = engine.road(row.road.id) or {}
        counts = road.get("counts") or {}
        lines.append(
            f"id={row.road.id} poradi={row.rank} skore={row.score} stav={row.road.stav} "
            f"silnice={row.road.sil} trida={row.road.trida} okres={row.road.okres} "
            f"skoly={int(counts.get('school') or 0)} nemocnice={int(counts.get('hospital') or 0)} "
            f"zzs={int(counts.get('zzs') or 0)}"
        )
    return "\n".join(lines)


def _points_from_model(raw: str | None) -> dict[int, tuple[int, str]]:
    data = _extract_json(raw or "")
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        items = _extract_list(raw or "")
    found: dict[int, tuple[int, str]] = {}
    for item in items or []:
        if not isinstance(item, dict):
            continue
        try:
            road_id = int(item.get("id"))
            points = int(round(float(item.get("points"))))
        except (TypeError, ValueError):
            continue
        points = min(100, max(0, points))
        reason = str(item.get("reason") or "").replace("\n", " ").strip()[:240]
        found[road_id] = (points, reason)
    return found


def _extract_list(text: str) -> list:
    start = text.find("[")
    end = text.rfind("]")
    if start < 0 or end <= start:
        return []
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []
