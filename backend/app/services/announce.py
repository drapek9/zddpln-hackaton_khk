"""Template for a closure announcement. AI may rewrite it; this text always works."""

from __future__ import annotations

from typing import Any

from app.core.schemas import Alert, DetourResult
from app.services.access import closure_label, intensity_of


def format_sil(sil: str, trida: str | None) -> str:
    number = str(sil or "").lstrip("0") or str(sil or "")
    if trida and "2" in trida:
        return f"II/{number}"
    if trida and "3" in trida:
        return f"III/{number}"
    if len(number) <= 3:
        return f"II/{number}"
    return f"III/{number}"


def _names(road: dict[str, Any], key: str) -> list[str]:
    samples = (road.get("samples") or {}).get(key) or []
    return [str(item.get("name")) for item in samples if isinstance(item, dict) and item.get("name")]


def build_announcement(
    road: dict[str, Any],
    *,
    title: str,
    date_from: str,
    date_to: str,
    restriction: str,
    note: str | None,
    simulated: bool,
    alerts: list[Alert],
    detour: DetourResult | None,
) -> str:
    level_label = {"critical": "zásadní", "warning": "pozor", "info": "info"}
    lines = road.get("lines") or []
    line_text = (
        "\n".join(f"• {line.get('linka')}: {line.get('trasa')}" for line in lines if isinstance(line, dict))
        if lines
        else "• Na úseku není evidována krajská autobusová linka."
    )
    stops = _names(road, "stop")
    schools = _names(road, "school")
    hospitals = _names(road, "hospital")
    vehicles, quality = intensity_of(road)
    if vehicles is None:
        traffic = "Auta za den: údaj zatím není. Sčítání ŘSD ještě není napojené, proto tu číslo nevymýšlíme."
    else:
        traffic = f"Auta za den: {vehicles} (štítek: {quality})."

    if detour is None:
        detour_text = "Objížďka se teprve počítá."
    elif not detour.found:
        detour_text = f"Objížďka nenalezena. {detour.note}"
    else:
        detour_text = (
            f"Objížďka: +{detour.extra_km} km, +{detour.extra_min} min "
            f"(z toho havarijní povrch {detour.havarijni_km} km). {detour.note}"
        )

    rows = [
        "NÁVRH OZNÁMENÍ O OMEZENÍ SILNIČNÍHO PROVOZU",
        "Královéhradecký kraj / Správa silnic KHK",
        "",
        title,
        f"Silnice: {format_sil(str(road.get('sil') or ''), road.get('trida'))}  ·  úsek {road.get('usek')}",
        f"Okres: {road.get('okres')}",
        f"Termín: {date_from} — {date_to}",
        f"Omezení: {restriction}",
        f"Poznámka: {note}" if note else "",
        "",
        "OBJÍŽĎKA",
        detour_text,
        traffic,
        "",
        "DOTČENÁ VEŘEJNÁ DOPRAVA",
        line_text,
        f"Zastávky v dosahu: {', '.join(stops)}" if stops else "",
        "",
        "ŠKOLY A ZDRAVOTNICTVÍ",
        f"Školy: {'; '.join(schools)}" if schools else "Školy v okruhu 450 m: žádné.",
        f"Nemocnice: {'; '.join(hospitals)}" if hospitals else "",
        "",
        "UPOZORNĚNÍ ZE SYSTÉMU",
        *[f"• [{level_label.get(alert.level, alert.level)}] {alert.title}: {alert.detail}" for alert in alerts],
        "",
        f"Štítek dat: {closure_label(simulated)}." if simulated else "",
        "Text je návrh. Před odesláním ho ověřte a rozešlete obcím, dopravcům IREDO a složkám IZS.",
    ]
    return "\n".join(row for row in rows if row != "")
