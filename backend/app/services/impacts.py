"""Closure warnings.

Tomáš owns Engine.closure_impact. Until that method exists, the API builds
the same warnings the frontend already shows, from the road record and the
detour the engine returned. When the method appears, this module uses it.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.engine import Engine
from app.core.schemas import Alert, DetourResult


def alerts_for_closure(
    engine: Engine,
    road_id: int,
    date_from: str,
    date_to: str,
    restriction: str,
    detour: DetourResult | None = None,
) -> list[Alert]:
    method = getattr(engine, "closure_impact", None)
    if callable(method):
        parsed = _from_engine(method, road_id, date_from, date_to, restriction)
        if parsed is not None:
            return parsed
    road = engine.road(road_id) or {}
    connections = list(getattr(engine.data, "connections", []) or [])
    alerts = _local_alerts(road, date_from, date_to, restriction, connections)
    alerts.extend(_detour_alerts(detour))
    return alerts


def _from_engine(method, road_id: int, date_from: str, date_to: str, restriction: str) -> list[Alert] | None:
    try:
        result = method(road_id, date_from, date_to, restriction)
    except TypeError:
        return None
    except Exception:
        return None
    if isinstance(result, list):
        return _coerce_list(result)
    nested = getattr(result, "alerts", None)
    if nested is not None:
        return _coerce_list(list(nested))
    return None


def _coerce_list(items: list) -> list[Alert] | None:
    alerts: list[Alert] = []
    for item in items:
        if isinstance(item, Alert):
            alerts.append(item)
            continue
        if isinstance(item, dict) and {"level", "title", "detail"} <= set(item):
            alerts.append(Alert(level=item["level"], title=item["title"], detail=item["detail"]))
            continue
        level = getattr(item, "level", None)
        title = getattr(item, "title", None)
        detail = getattr(item, "detail", None)
        if level and title and detail:
            alerts.append(Alert(level=level, title=title, detail=detail))
            continue
        return None
    return alerts


def _local_alerts(
    road: dict[str, Any],
    date_from: str,
    date_to: str,
    restriction: str,
    connections: list[dict[str, Any]],
) -> list[Alert]:
    alerts: list[Alert] = []
    counts = road.get("counts") or {}
    full = "uzavírka" in (restriction or "")
    lines = road.get("lines") or []

    hospitals = int(counts.get("hospital") or 0)
    if hospitals > 0:
        extra = (
            "Úplná uzavírka může zkomplikovat dojezd sanitky a návštěvníky."
            if full
            else "Ověřte průjezd vozidel IZS."
        )
        alerts.append(
            Alert(
                level="critical",
                title="Nemocnice v okolí úseku",
                detail=f"{hospitals} zařízení do 450 m. {extra}",
            )
        )

    zzs = int(counts.get("zzs") or 0)
    hzs = int(counts.get("hzs") or 0)
    if zzs + hzs > 0:
        parts = []
        if zzs:
            parts.append(_plural(zzs, "základna ZZS", "základny ZZS", "základen ZZS"))
        if hzs:
            parts.append(_plural(hzs, "stanice HZS", "stanice HZS", "stanic HZS"))
        alerts.append(
            Alert(
                level="critical",
                title="Výjezd IZS na úseku",
                detail=f"V dosahu: {' a '.join(parts)}. Objednejte objízdnou trasu dřív, než začnou práce.",
            )
        )

    schools = int(counts.get("school") or 0)
    if schools > 0:
        school_time = _in_school_year(date_from, date_to)
        alerts.append(
            Alert(
                level="warning" if school_time else "info",
                title=f"{schools} školských zařízení v okolí",
                detail=(
                    "Termín zasahuje do školního roku. Zvažte prázdniny nebo kyvadlový provoz ráno a odpoledne."
                    if school_time
                    else "Termín vychází mimo školní rok — nižší dopad na svozy dětí."
                ),
            )
        )

    if lines:
        alerts.append(
            Alert(
                level="critical" if full else "warning",
                title=f"{len(lines)} autobusových linek na úseku",
                detail=", ".join(str(line.get("linka") or "") for line in lines if isinstance(line, dict)),
            )
        )

    stop_names = [item.get("name", "") for item in (road.get("samples") or {}).get("stop") or [] if isinstance(item, dict)]
    broken = []
    for connection in connections:
        stop = str(connection.get("stop") or "")
        if any(_same_stop(name, stop) for name in stop_names if name):
            broken.append(connection)
        if len(broken) >= 8:
            break
    if broken:
        preview = []
        for connection in broken[:3]:
            wait = connection.get("wait", "")
            to_line = connection.get("toLine") or connection.get("to_line") or ""
            preview.append(f"{connection.get('line', '')} → {to_line} v {connection.get('stop', '')} (čeká {wait} min)")
        alerts.append(
            Alert(
                level="critical",
                title=f"{len(broken)} zaručených přípojů může odpadnout",
                detail=" · ".join(preview),
            )
        )

    if road.get("winter") and _in_winter(date_from, date_to):
        alerts.append(
            Alert(
                level="warning",
                title="Kolize se zimní údržbou",
                detail=f"Úsek se v zimě udržuje ({road.get('winter')}). Práce od listopadu do března prodlužují výluky.",
            )
        )

    if road.get("worse"):
        alerts.append(
            Alert(
                level="warning",
                title="Úsek se zhoršuje",
                detail="Proti předchozímu hodnocení klesl stav povrchu. Odklad zvýší náklady na opravu.",
            )
        )

    if int(counts.get("industry") or 0) > 0:
        alerts.append(
            Alert(
                level="info",
                title="Nákladní obsluha průmyslu",
                detail="V okolí je průmyslová zóna. Počítejte s objížďkou kamionů.",
            )
        )

    if not road.get("lastRepair"):
        alerts.append(
            Alert(
                level="info",
                title="Bez evidované opravy od roku 2016",
                detail="V otevřených datech kraje k tomuto úseku není liniová oprava.",
            )
        )
    return alerts


def _detour_alerts(detour: DetourResult | None) -> list[Alert]:
    if detour is None:
        return []
    if not detour.found:
        return [Alert(level="warning", title="Objížďka nenalezena", detail=detour.note or "Graf silnic objížďku nenašel.")]
    alerts = [
        Alert(
            level="info",
            title="Prodloužení trasy",
            detail=f"Objížďka je delší o {detour.extra_km} km a {detour.extra_min} min. {detour.note}".strip(),
        )
    ]
    if detour.havarijni_km > 0:
        alerts.append(
            Alert(
                level="warning",
                title="Objížďka vede po havarijním úseku",
                detail=f"{detour.havarijni_km} km objížďky je ve stavu havarijní nebo SUPERhavarijní.",
            )
        )
    if detour.class1_km > 0:
        alerts.append(
            Alert(
                level="info",
                title="Objížďka vede po silnici I. třídy",
                detail=f"{detour.class1_km} km objížďky jede po silnici I. třídy nebo dálnici (OpenStreetMap).",
            )
        )
    return alerts


def _plural(count: int, one: str, few: str, many: str) -> str:
    if count == 1:
        return f"{count} {one}"
    if 2 <= count <= 4:
        return f"{count} {few}"
    return f"{count} {many}"


def _norm_stop(value: str) -> str:
    text = re.sub(r",+", ",", value.lower())
    return re.sub(r"\s+", " ", text).strip()


def _same_stop(left: str, right: str) -> bool:
    a = _norm_stop(left)
    b = _norm_stop(right)
    return a == b or (len(a) > 8 and a in b) or (len(b) > 8 and b in a)


def _overlaps(date_from: str, date_to: str, start: str, end: str) -> bool:
    return bool(date_from) and bool(date_to) and date_from <= end and date_to >= start


def _in_school_year(date_from: str, date_to: str) -> bool:
    if not date_from or not date_to:
        return True
    year_from = int(date_from[:4])
    year_to = max(year_from, int(date_to[:4]))
    for year in range(year_from, year_to + 1):
        if _overlaps(date_from, date_to, f"{year}-01-01", f"{year}-06-30"):
            return True
        if _overlaps(date_from, date_to, f"{year}-09-01", f"{year}-12-31"):
            return True
    return False


def _in_winter(date_from: str, date_to: str) -> bool:
    if not date_from or not date_to:
        return False
    year_from = int(date_from[:4])
    year_to = max(year_from, int(date_to[:4]))
    for year in range(year_from - 1, year_to + 1):
        if _overlaps(date_from, date_to, f"{year}-11-01", f"{year + 1}-03-31"):
            return True
    return False
