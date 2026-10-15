"""Filters, search, weight presets and rank diff for the annual repair list.

The formula stays in scoring.py. This module only selects and compares rows
the engine already ranked.
"""

from __future__ import annotations

from dataclasses import dataclass

from .schemas import RankedRoad, Weights

# Query aliases from the plan (II, III) onto the Data KHK labels.
_TRIDA = {
    "ii": "2. třída",
    "2": "2. třída",
    "2. třída": "2. třída",
    "iii": "3. třída",
    "3": "3. třída",
    "3. třída": "3. třída",
}

HAVARIJNI = {"havarijní", "superhavarijní"}

SORTS = {"score", "intensity", "students", "detour", "km"}


@dataclass
class RoadQuery:
    sort: str = "score"
    order: str = "desc"
    trida: tuple[str, ...] = ()
    orp: str = ""
    stav: tuple[str, ...] = ()
    min_score: float | None = None
    havarijni: bool = False
    q: str = ""


def weight_schema() -> list[dict]:
    """All slider keys for the panel. The frontend must not hard-code them."""
    defaults = Weights()
    rows = [
        ("stav", "Stav povrchu", "Stav", "Jak špatný je povrch podle Data KHK.", "třída stavu"),
        ("worse", "Zhoršování", "Stav", "Úsek se mezi snímky zhoršil.", "body"),
        ("age", "Roky od opravy", "Stav", "Jak dlouho se úsek neopravoval.", "roky"),
        ("trida", "Třída silnice", "Síť", "II. třída má přednost před III.", "třída"),
        ("intensity", "Intenzita dopravy", "Síť", "Auta za den ze sčítání ŘSD 2025, jinak odhad.", "vozidel/den"),
        ("detour", "Délka objížďky", "Síť", "Minuty navíc, když se úsek zavře. Bez objížďky maximum.", "min"),
        ("schools", "Školy", "Lidé", "Školy u úseku.", "počet"),
        ("students", "Středoškoláci denně", "Lidé", "Studenti, jejichž cesta do školy vede po úseku.", "studentů/den"),
        ("hospitals", "Zdravotnictví", "Lidé", "Nemocnice a ordinace u úseku.", "počet"),
        ("rescue", "IZS", "Lidé", "Záchranka, hasiči a policie u úseku.", "počet"),
        ("social", "Ohrožené oblasti", "Lidé", "Úsek v území HSOO.", "body"),
        ("transit", "Veřejná doprava", "Doprava a práce", "Zastávky a linky na úseku.", "počet"),
        ("industry", "Průmysl", "Doprava a práce", "Průmysl u úseku.", "počet"),
        ("votes", "Hlasy občanů", "Hlasy", "Slabý hlas, se stropem. Nula znamená vypnuto.", "hlasy"),
    ]
    return [
        {
            "key": key,
            "label": label,
            "group": group,
            "default": getattr(defaults, key),
            "help": help_,
            "unit": unit,
        }
        for key, label, group, help_, unit in rows
    ]


def weight_presets() -> list[dict]:
    """Named weight sets for the repair list. Values are the slider scale 0–100."""
    base = Weights().model_dump()

    def one(preset_id: str, nazev: str, popis: str, **over: float) -> dict:
        return {"id": preset_id, "nazev": nazev, "popis": popis, "weights": {**base, **over}}

    return [
        one("vzorec", "Výchozí vzorec", "Váhy modelu. Intenzita, objížďka a studenti jsou vypnuté."),
        one(
            "skoly",
            "Školní trasy",
            "Výš jdou úseky, kudy jezdí středoškoláci a u kterých je škola.",
            students=100,
            schools=100,
        ),
        one("provoz", "Provoz", "Výš jdou úseky s větším počtem aut za den.", intensity=100),
        one(
            "objizdka",
            "Dopad uzavírky",
            "Výš jdou úseky s dlouhou objížďkou a ty, které síť přeruší.",
            detour=100,
        ),
        one(
            "zachranka",
            "Záchranka a nemocnice",
            "Výš jdou úseky u nemocnice a složek IZS.",
            rescue=100,
            hospitals=100,
        ),
    ]


def apply_query(
    rows: list[RankedRoad],
    by_id: dict[int, dict],
    filters: RoadQuery,
) -> list[RankedRoad]:
    """Filter, then optionally re-sort. `sort=score` keeps the priority order (pins stay first)."""
    wanted_trida = {_TRIDA.get(item.strip().lower(), item.strip().lower()) for item in filters.trida if item.strip()}
    wanted_stav = {item.strip().lower() for item in filters.stav if item.strip()}
    needle = _norm(filters.q)
    place = filters.orp.strip().lower()
    kept: list[RankedRoad] = []
    for row in rows:
        road = by_id.get(row.road.id)
        if road is None:
            continue
        if wanted_trida and road.get("trida", "").strip().lower() not in wanted_trida:
            continue
        if wanted_stav and str(road.get("stav", "")).strip().lower() not in wanted_stav:
            continue
        if filters.havarijni and str(road.get("stav", "")).strip().lower() not in HAVARIJNI:
            continue
        if filters.min_score is not None and row.score < filters.min_score:
            continue
        if place and not _place_hit(road, place):
            continue
        if needle and needle not in _norm(_road_blob(road)):
            continue
        kept.append(row)
    if filters.sort != "score":
        reverse = filters.order != "asc"
        kept.sort(key=lambda row: (_sort_value(by_id[row.road.id], filters.sort), -row.road.id), reverse=reverse)
    elif filters.order == "asc":
        kept.reverse()
    return kept


def search_items(roads: list[dict], obce: list[dict], q: str, limit: int = 20) -> list[dict]:
    needle = _norm(q)
    if not needle:
        return []
    found: list[dict] = []
    for road in roads:
        if needle not in _norm(_road_blob(road)):
            continue
        found.append(
            {
                "type": "road",
                "id": road["id"],
                "label": _label(road),
                "bbox": road.get("b"),
            }
        )
        if len(found) >= limit:
            return found
    for obec in obce:
        if needle not in _norm(obec.get("nazev", "")):
            continue
        found.append(
            {
                "type": "obec",
                "id": obec.get("kod"),
                "label": obec.get("nazev", ""),
                "bbox": obec.get("bbox"),
            }
        )
        if len(found) >= limit:
            return found
    return found


def rank_diff(before: list[RankedRoad], after: list[RankedRoad], top: int) -> dict:
    """What moved in the top N when weights change. `shift` > 0 means the road moved up."""
    head_before = {row.road.id: row for row in before[:top]}
    head_after = {row.road.id: row for row in after[:top]}
    ids_before, ids_after = set(head_before), set(head_after)

    def brief(row: RankedRoad) -> dict:
        return {
            "id": row.road.id,
            "usek": row.road.usek,
            "sil": row.road.sil,
            "rank": row.rank,
            "score": row.score,
        }

    entered = [brief(head_after[rid]) for rid in ids_after - ids_before]
    left = [brief(head_before[rid]) for rid in ids_before - ids_after]
    shifts = []
    for rid in ids_before & ids_after:
        delta = head_before[rid].rank - head_after[rid].rank
        if delta == 0:
            continue
        item = brief(head_after[rid])
        item["from_rank"] = head_before[rid].rank
        item["shift"] = delta
        shifts.append(item)
    shifts.sort(key=lambda item: (-item["shift"], item["id"]))
    entered.sort(key=lambda item: item["rank"])
    left.sort(key=lambda item: item["rank"])
    return {"top": top, "entered": entered, "left": left, "shifts": shifts}


def _sort_value(road: dict, sort: str) -> float:
    if sort == "intensity":
        return float((road.get("intensity") or {}).get("sv") or 0)
    factors = road.get("factors") or {}
    if sort == "students":
        return float(factors.get("students") or 0)
    if sort == "detour":
        if factors.get("cut_off"):
            return 100_000.0
        return float(factors.get("detour_min") or 0)
    if sort == "km":
        return float(road.get("delka") or 0) / 1000.0
    return 0.0


def _place_hit(road: dict, place: str) -> bool:
    if place in str(road.get("okres", "")).lower():
        return True
    return any(place in str(name).lower() for name in road.get("obce") or [])


def _road_blob(road: dict) -> str:
    obce = " ".join(road.get("obce") or [])
    return f"{road.get('sil', '')} {road.get('usek', '')} {_label(road)} {obce}"


def _label(road: dict) -> str:
    trida = {"2": "II", "3": "III"}.get(str(road.get("trida", ""))[:1], "")
    number = str(road.get("sil", "")).lstrip("0")
    return f"{trida}/{number}" if trida else number


def _norm(text: str) -> str:
    return "".join(str(text).lower().split())
