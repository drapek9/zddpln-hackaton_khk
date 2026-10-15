"""Closure impacts: port of `impactAlerts` from src/lib/priority.ts plus detour alerts.

`impact_alerts` must stay identical to the frontend (texts, order, levels).
tests/fixtures/ts_alerts.json checks it. `detour_alerts` is new and backend-only.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from .schemas import Alert, DetourResult


def _overlaps(date_from: str, date_to: str, start: str, end: str) -> bool:
    return date_from <= end and date_to >= start


def _years(date_from: str, date_to: str) -> tuple[int, int] | None:
    try:
        y1 = int(date_from[:4])
        y2 = max(y1, int(date_to[:4]))
    except ValueError:
        return None
    return y1, y2


def in_school_year(date_from: str | None, date_to: str | None) -> bool:
    """Does the term touch the school year (Sep-Jun)? Same as geo.ts inSchoolYear."""
    if not date_from or not date_to:
        return True
    years = _years(date_from, date_to)
    if years is None:
        return False
    for y in range(years[0], years[1] + 1):
        if _overlaps(date_from, date_to, f"{y}-01-01", f"{y}-06-30") or _overlaps(
            date_from, date_to, f"{y}-09-01", f"{y}-12-31"
        ):
            return True
    return False


def in_winter(date_from: str | None, date_to: str | None) -> bool:
    """Does the term touch winter maintenance (Nov-Mar)? Same as geo.ts inWinter."""
    if not date_from or not date_to:
        return False
    years = _years(date_from, date_to)
    if years is None:
        return False
    for y in range(years[0] - 1, years[1] + 1):
        if _overlaps(date_from, date_to, f"{y}-11-01", f"{y + 1}-03-31"):
            return True
    return False


def _plural(n: int, one: str, few: str, many: str) -> str:
    if n == 1:
        return f"{n} {one}"
    if 2 <= n <= 4:
        return f"{n} {few}"
    return f"{n} {many}"


def _norm_stop(s: str) -> str:
    s = re.sub(r",+", ",", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def _same_norm(na: str, nb: str) -> bool:
    return na == nb or (len(na) > 8 and na in nb) or (len(nb) > 8 and nb in na)


# Stop matching is pairwise substring search, so cache it per connections list and stop name.
# The cache keeps a reference to the list and checks identity, so a new list never reuses stale entries.
_stop_cache: tuple[list[dict[str, Any]] | None, list[str], dict[str, frozenset[int]]] = (None, [], {})


def _matching_connections(stop_names: list[str], connections: list[dict[str, Any]]) -> list[int]:
    """Indices of connections whose stop matches any of `stop_names` (TS sameStop), in order."""
    global _stop_cache
    if _stop_cache[0] is not connections or len(_stop_cache[1]) != len(connections):
        _stop_cache = (connections, [_norm_stop(cn["stop"]) for cn in connections], {})
    _, normed, by_name = _stop_cache
    hits: set[int] = set()
    for name in stop_names:
        na = _norm_stop(name)
        if na not in by_name:
            by_name[na] = frozenset(i for i, nb in enumerate(normed) if _same_norm(na, nb))
        hits |= by_name[na]
    return sorted(hits)


def is_full_closure(restriction: str | None) -> bool:
    return bool(restriction) and "uzavírka" in restriction


def impact_alerts(
    road: dict[str, Any],
    date_from: str | None,
    date_to: str | None,
    restriction: str | None,
    connections: list[dict[str, Any]],
    has_repair: bool = True,
) -> list[Alert]:
    """Alerts for a closure of `road`. `has_repair=False` = no term chosen (TS: repair null)."""
    alerts: list[Alert] = []
    c = road.get("counts") or {}
    full = has_repair and is_full_closure(restriction)

    if (c.get("hospital") or 0) > 0:
        tail = (
            "Úplná uzavírka může zkomplikovat dojezd sanitky a návštěvníky."
            if full
            else "Ověřte průjezd vozidel IZS."
        )
        alerts.append(
            Alert(level="critical", title="Nemocnice v okolí úseku", detail=f"{c['hospital']} zařízení do 450 m. {tail}")
        )
    if (c.get("zzs") or 0) + (c.get("hzs") or 0) > 0:
        parts = [
            _plural(c["zzs"], "základna ZZS", "základny ZZS", "základen ZZS") if c.get("zzs") else "",
            _plural(c["hzs"], "stanice HZS", "stanice HZS", "stanic HZS") if c.get("hzs") else "",
        ]
        alerts.append(
            Alert(
                level="critical",
                title="Výjezd IZS na úseku",
                detail=f"V dosahu: {' a '.join(p for p in parts if p)}. Objednejte objízdnou trasu dřív, než začnou práce.",
            )
        )
    if (c.get("school") or 0) > 0:
        school_time = in_school_year(date_from, date_to) if has_repair else True
        alerts.append(
            Alert(
                level="warning" if school_time else "info",
                title=f"{c['school']} školských zařízení v okolí",
                detail=(
                    "Termín zasahuje do školního roku. Zvažte prázdniny nebo kyvadlový provoz ráno a odpoledne."
                    if school_time
                    else "Termín vychází mimo školní rok — nižší dopad na svozy dětí."
                ),
            )
        )
    lines = road.get("lines") or []
    if lines:
        alerts.append(
            Alert(
                level="critical" if full else "warning",
                title=f"{len(lines)} autobusových linek na úseku",
                detail=", ".join(line["linka"] for line in lines),
            )
        )

    stop_names = [s["name"] for s in (road.get("samples") or {}).get("stop") or []]
    broken = [connections[i] for i in _matching_connections(stop_names, connections)[:8]]
    if broken:
        alerts.append(
            Alert(
                level="critical",
                title=f"{len(broken)} zaručených přípojů může odpadnout",
                detail=" · ".join(
                    f"{cn['line']} → {cn['toLine']} v {cn['stop']} (čeká {cn['wait']} min)" for cn in broken[:3]
                ),
            )
        )

    if has_repair and road.get("winter") and in_winter(date_from, date_to):
        alerts.append(
            Alert(
                level="warning",
                title="Kolize se zimní údržbou",
                detail=f"Úsek se v zimě udržuje ({road['winter']}). Práce od listopadu do března prodlužují výluky.",
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

    if (c.get("industry") or 0) > 0:
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


def _km(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def detour_alerts(
    road: dict[str, Any],
    detour: DetourResult,
    via_roads: Iterable[dict[str, Any]],
    school_time: bool,
) -> list[Alert]:
    """Alerts about the detour of a full closure (backend-only, not in the TS version)."""
    if not detour.found:
        if detour.closed_km == 0 or "stejném uzlu" in detour.note:
            # Road is not in the graph or is a loop: we cannot judge the detour, say so honestly.
            return [Alert(level="info", title="Objížďku nelze spočítat", detail=detour.note)]
        return [
            Alert(
                level="critical",
                title="Objížďka nenalezena",
                detail=(
                    "V síti silnic II. a III. třídy a silnic I. třídy není jiná cesta mezi konci úseku. "
                    "Úplná uzavírka může odříznout obsluhu, zvažte částečné omezení nebo etapy."
                ),
            )
        ]

    alerts: list[Alert] = []
    extra_min = detour.extra_min or 0
    alerts.append(
        Alert(
            level="warning" if extra_min >= 15 else "info",
            title=f"Objížďka +{_km(detour.extra_km or 0)} km, +{round(extra_min)} min",
            detail=f"Objízdná trasa měří {_km(detour.detour_km or 0)} km místo {_km(detour.closed_km)} km uzavřeného úseku.",
        )
    )
    lines = road.get("lines") or []
    if lines:
        alerts.append(
            Alert(
                level="warning",
                title="Autobusy pojedou objížďkou",
                detail=(
                    f"Linky {', '.join(line['linka'] for line in lines)} se prodlouží asi o {round(extra_min)} min. "
                    "Zkontrolujte návaznosti a zastávky mimo trasu."
                ),
            )
        )
    if detour.havarijni_km >= 0.5:
        alerts.append(
            Alert(
                level="warning",
                title="Objížďka vede po havarijních úsecích",
                detail=f"{_km(detour.havarijni_km)} km objížďky je v havarijním stavu. Zvažte opravu objízdné trasy předem.",
            )
        )
    if detour.class1_km >= 0.5:
        alerts.append(
            Alert(
                level="info",
                title="Objížďka po silnici I. třídy",
                detail=f"{_km(detour.class1_km)} km vede po silnicích I. třídy nebo dálnici (správce ŘSD). Objížďku projednejte s ŘSD.",
            )
        )
    inten = road.get("intensity") or {}
    if inten.get("sv"):
        label = "sčítání ŘSD 2025" if inten.get("src") == "csd2025" else "odhad"
        vehicles = int(inten["sv"])
        alerts.append(
            Alert(
                level="warning" if vehicles >= 3000 else "info",
                title=f"Objížďkou pojede ~{vehicles:,} vozidel denně".replace(",", " "),
                detail=(
                    f"Intenzita úseku ({label}). Navíc ujedou asi {round(vehicles * (detour.extra_km or 0)):,} km denně."
                ).replace(",", " "),
            )
        )
    schools = sum((r.get("counts") or {}).get("school") or 0 for r in via_roads)
    if schools and school_time:
        alerts.append(
            Alert(
                level="warning",
                title=f"Objížďka vede kolem {schools} školských zařízení",
                detail="Víc aut kolem škol ve školním roce. Zvažte dopravní značení a dohled u přechodů.",
            )
        )
    return alerts
