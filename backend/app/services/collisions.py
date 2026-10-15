"""Warn when a detour runs through another closure in the same dates.

Ambulance and fire travel time is T18. The contract in PLAN_FINAL chapter 17
is `Engine.rescue_impact(road_id)`, or the same facts on `PeopleImpact`:
which obec, how many extra minutes, whether ZZS exceeds 20 minutes, ZZS and HZS
separately. Engine has neither yet. `PeopleImpact` only has students and
cut-off obce. `rescue` stays None until that arrives. Minutes are not invented.
"""

from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from app.core.engine import Engine
from app.core.schemas import Alert
from app.db.models import Closure

# Same forward statuses as services.closures.ACTIVE_STATUSES. Imported there would cycle.
_ACTIVE = ("schvaleno", "naplanovano", "probiha")


def collision_alerts(
    session: Session,
    engine: Engine,
    *,
    via_road_ids: list[int],
    date_from: str,
    date_to: str,
    ignore_id: int | None = None,
) -> list[Alert]:
    via = set(via_road_ids)
    if not via:
        return []
    hits = _from_db(session, via, date_from, date_to, ignore_id)
    hits.extend(_from_srti(engine, via, date_from, date_to))
    if not hits:
        return []
    shown = hits[:5]
    extra = len(hits) - len(shown)
    detail = "; ".join(shown)
    if extra > 0:
        detail = f"{detail}; a další ({extra})"
    return [
        Alert(
            level="warning",
            title="Objížďka vede přes jinou uzavírku",
            detail=detail,
        )
    ]


def rescue_for_closure(engine: Engine, road_id: int) -> tuple[dict[str, Any] | None, list[Alert]]:
    """T18 facts plus alerts for the closure card.

    Returns `(None, [])` while Engine has no rescue travel time.
    """
    raw = _rescue_raw(engine, road_id)
    if raw is None:
        return None, []
    if isinstance(raw, list) and raw and _is_alert(raw[0]):
        alerts = _coerce_alerts(raw)
        return {"items": [alert.model_dump() for alert in alerts], "label": "estimate"}, alerts
    data = raw.model_dump() if hasattr(raw, "model_dump") else raw
    if not isinstance(data, dict):
        return None, []
    items = _rescue_items(data)
    if isinstance(data.get("alerts"), list):
        # Engine.rescue_impact (T18) already sums the obce into a few alerts.
        alerts = _coerce_alerts(data["alerts"])
    else:
        alerts = [_rescue_alert(item) for item in items]
        alerts = [alert for alert in alerts if alert is not None]
    payload = {
        "items": items,
        "label": "estimate",
        "note": "Dojezd je odhad z grafu silnic, ne skutečná jízda sanitky.",
    }
    return payload, alerts


def rescue_impact_of(engine: Engine, road_id: int) -> dict[str, Any] | None:
    payload, _alerts = rescue_for_closure(engine, road_id)
    return payload


def _rescue_raw(engine: Engine, road_id: int) -> Any:
    method = getattr(engine, "rescue_impact", None)
    if callable(method):
        try:
            return method(road_id)
        except TypeError:
            try:
                return method([road_id])
            except (TypeError, KeyError, ValueError):
                return None
        except (KeyError, ValueError):
            return None
    # Tomáš may hang the same facts on PeopleImpact instead of a new method.
    people = getattr(engine, "people_impact", None)
    if not callable(people):
        return None
    try:
        impact = people([road_id])
    except (TypeError, KeyError, ValueError):
        return None
    for name in ("rescue", "rescue_impact", "dojezd"):
        value = getattr(impact, name, None)
        if value:
            return value
    return None


def _rescue_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    raw = data.get("items") or data.get("obce") or data.get("zzs") or []
    if not isinstance(raw, list):
        return []
    items = []
    for item in raw:
        row = item.model_dump() if hasattr(item, "model_dump") else item
        if not isinstance(row, dict):
            continue
        extra = row.get("extra_min")
        if extra is None:
            extra = row.get("minuty")
        items.append(
            {
                "nazev": row.get("nazev") or row.get("obec") or "",
                "sluzba": row.get("sluzba") or row.get("service") or "zzs",
                "extra_min": extra,
                "nad_20_min": bool(row.get("nad_20_min") or row.get("over_20") or row.get("over_limit")),
                "obyvatel": row.get("obyvatel"),
                "pred_min": row.get("before_min"),
                "po_min": row.get("after_min"),
            }
        )
    hzs = data.get("hzs")
    if isinstance(hzs, list):
        for item in hzs:
            row = item if isinstance(item, dict) else {}
            items.append(
                {
                    "nazev": row.get("nazev") or row.get("obec") or "",
                    "sluzba": "hzs",
                    "extra_min": row.get("extra_min") or row.get("minuty"),
                    "nad_20_min": bool(row.get("nad_20_min") or row.get("over_20")),
                    "obyvatel": row.get("obyvatel"),
                }
            )
    return items


def _rescue_alert(item: dict[str, Any]) -> Alert | None:
    name = item.get("nazev") or "obec"
    minutes = item.get("extra_min")
    if not isinstance(minutes, (int, float)):
        return None
    service = "hasičů" if item.get("sluzba") == "hzs" else "záchranky"
    title = f"Dojezd {service} do {name} se prodlouží o {minutes:g} min"
    if item.get("nad_20_min"):
        return Alert(level="critical", title=title, detail="Odhad dojezdu přesáhne 20 minut.")
    return Alert(level="warning", title=title, detail="Odhad z grafu silnic, ne změřená jízda.")


def _is_alert(item: Any) -> bool:
    if isinstance(item, Alert):
        return True
    if isinstance(item, dict):
        return {"level", "title", "detail"} <= set(item)
    return bool(getattr(item, "level", None) and getattr(item, "title", None) and getattr(item, "detail", None))


def _coerce_alerts(items: list) -> list[Alert]:
    alerts: list[Alert] = []
    for item in items:
        if isinstance(item, Alert):
            alerts.append(item)
        elif isinstance(item, dict) and _is_alert(item):
            alerts.append(Alert(level=item["level"], title=item["title"], detail=item["detail"]))
        elif _is_alert(item):
            alerts.append(Alert(level=item.level, title=item.title, detail=item.detail))
    return alerts


def _from_db(
    session: Session,
    via: set[int],
    date_from: str,
    date_to: str,
    ignore_id: int | None,
) -> list[str]:
    rows = session.exec(select(Closure).where(Closure.confirmed.is_(True))).all()
    hits: list[str] = []
    for row in rows:
        if row.id == ignore_id or row.status not in _ACTIVE:
            continue
        if row.road_id not in via:
            continue
        if not _overlaps(date_from, date_to, row.date_from, row.date_to):
            continue
        hits.append(f"{row.title} ({row.date_from}–{row.date_to})")
    return hits


def _from_srti(engine: Engine, via: set[int], date_from: str, date_to: str) -> list[str]:
    method = getattr(engine, "srti_closures", None)
    if not callable(method):
        return []
    try:
        rows = method() or []
    except (TypeError, KeyError, ValueError):
        return []
    hits: list[str] = []
    for item in rows:
        data = item.model_dump() if hasattr(item, "model_dump") else item
        if not isinstance(data, dict):
            continue
        road_id = data.get("road_id")
        if road_id not in via:
            continue
        start = _day(data.get("start"))
        end = _day(data.get("end")) or start
        if not start or not _overlaps(date_from, date_to, start, end):
            continue
        label = data.get("label") or data.get("road_label") or "uzavírka ŘSD"
        hits.append(f"{label} ({start}–{end}, ŘSD SRTI)")
    return hits


def _day(value: object) -> str:
    text = str(value or "")
    return text[:10] if len(text) >= 10 else ""


def _overlaps(date_from: str, date_to: str, start: str, end: str) -> bool:
    return bool(date_from and date_to and start and end) and date_from <= end and date_to >= start
