"""Current road works and closures from ŘSD / NDIC SRTI (T8).

Source: Národní dopravní informační centrum, SRTI (Safety Related Traffic
Information) as linked open data, CC BY 4.0. NKOD:
https://data.gov.cz/datová-sada?iri=https://data.gov.cz/zdroj/datové-sady/65993390/1087749998
Snapshot (RDF Turtle): https://lod.tamtamresearch.com/srti/snapshot/

One situation has several records (ConstructionWorks, RoadOrCarriagewayOrLaneManagement,
...) with the same id before "_". They are merged into one item. Each record has
one point, a validity period and optionally a road number ("I-16", "D11").
Only points within KRAJ_M metres of a road in the kraj are kept.

Run: uv run --project backend --with rdflib python scripts/fetch_srti.py
Output: public/data/srti.json
"""

from __future__ import annotations

import json
import re
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from rdflib import BNode, Graph, Namespace
from rdflib.namespace import DCTERMS, RDF

URL = "https://lod.tamtamresearch.com/srti/snapshot/"
DATA = Path(__file__).resolve().parents[1] / "public" / "data"
OUT = DATA / "srti.json"
KX, KY = 111_320.0 * 0.6388, 110_540.0
KRAJ_M = 250.0
"""A point counts as in the kraj when a kraj road (Data KHK) is within ~KRAJ_M (grid cells, up to 2x)."""

SRTI = Namespace("http://cef.uv.es/lodroadtran18/def/transporte/dtx_srti#")
GEO = Namespace("http://www.opengis.net/ont/geosparql#")
TIME = Namespace("http://www.w3.org/2006/time#")

KIND_CS = {
    "ConstructionWorks": "stavební práce",
    "MaintenanceWorks": "údržba",
    "RoadOrCarriagewayOrLaneManagement": "omezení provozu",
    "GeneralObstruction": "překážka",
    "EnvironmentalObstruction": "překážka (počasí, sesuv)",
    "PublicEvent": "akce",
    "AbnormalTraffic": "dopravní situace",
}
MANAGEMENT_CS = {
    "roadClosed": "uzavřená silnice",
    "roadBlocked": "neprůjezdná silnice",
    "laneClosures": "uzavřený jízdní pruh",
    "singleAlternateLineTraffic": "kyvadlový provoz",
    "narrowLanes": "zúžené pruhy",
    "contraflow": "převedení do protisměru",
    "intermittentShortTermClosures": "krátkodobé uzavírky",
    "other": "jiné omezení",
}
FULL = {"roadClosed", "roadBlocked"}


def download() -> bytes:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(URL, timeout=180) as res:
                return res.read()
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Download failed: {URL}")


def local(term) -> str:
    return re.split(r"[#/]", str(term))[-1]


def first(g: Graph, s, *path):
    """Follow a property path, return the first value or None."""
    nodes = [s]
    for p in path:
        nodes = [o for n in nodes for o in g.objects(n, p)]
        if not nodes:
            return None
    return nodes[0]


def main() -> None:
    g = Graph()
    g.parse(data=download().decode("utf-8"), format="turtle")
    roads = json.loads((DATA / "roads.json").read_text(encoding="utf-8"))["roads"]
    cell = KRAJ_M
    grid: set[tuple[int, int]] = set()
    for r in roads:
        for lon, lat in r["g"]:
            grid.add((int(lon * KX // cell), int(lat * KY // cell)))

    def in_kraj(lon: float, lat: float) -> bool:
        cx, cy = int(lon * KX // cell), int(lat * KY // cell)
        return any((cx + dx, cy + dy) in grid for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    items: dict[str, dict] = {}
    types: dict[str, set[str]] = defaultdict(set)
    total = 0
    for rec in set(g.subjects(DCTERMS.isVersionOf, None)):
        total += 1
        wkt = str(first(g, rec, GEO.hasGeometry, GEO.asWKT) or "")
        m = re.search(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)", wkt)
        if not m:
            continue
        lon, lat = float(m.group(1)), float(m.group(2))
        if not in_kraj(lon, lat):
            continue
        sid = local(first(g, rec, DCTERMS.isVersionOf)).split("_")[0]
        period = first(g, rec, SRTI.hasValidity, SRTI.validityTimeSpecification)
        start = first(g, period, TIME.hasBeginning, TIME.inXSDDateTime) if period else None
        end = first(g, period, TIME.hasEnd, TIME.inXSDDateTime) if period else None
        road_names = [
            str(o)
            for loc in g.objects(rec, SRTI.hasLocationReference)
            for o in _deep_values(g, loc, SRTI.roadName)
        ]
        road = road_names[0] if road_names else None
        cap = first(g, rec, SRTI.impact, SRTI.capacityRemaining)
        it = items.setdefault(
            sid,
            {"id": sid, "lon": round(lon, 5), "lat": round(lat, 5), "start": None, "end": None,
             "road": None, "capacity_remaining": None, "kinds": [], "management": []},
        )
        if start and (it["start"] is None or str(start) < it["start"]):
            it["start"] = str(start)
        if end and (it["end"] is None or str(end) > it["end"]):
            it["end"] = str(end)
        it["road"] = it["road"] or road
        if cap is not None:
            c = float(cap)
            it["capacity_remaining"] = c if it["capacity_remaining"] is None else min(c, it["capacity_remaining"])
        for t in g.objects(rec, RDF.type):
            types[sid].add(local(t))
        for mt in g.objects(rec, SRTI.hasRoadOrCarriagewayOrLaneManagementType):
            if local(mt) not in it["management"]:
                it["management"].append(local(mt))

    out = []
    for sid, it in items.items():
        kinds = sorted(types[sid])
        it["kinds"] = kinds
        it["full_closure"] = bool(FULL & set(it["management"])) or it["capacity_remaining"] == 0.0
        labels = [KIND_CS.get(k, k) for k in kinds] + [MANAGEMENT_CS.get(m, m) for m in it["management"]]
        it["label"] = ", ".join(dict.fromkeys(labels))
        out.append(it)
    out.sort(key=lambda x: (not x["full_closure"], x["start"] or ""))

    result = {
        "source": "ŘSD / NDIC, SRTI (bezpečnostní dopravní informace), linked open data",
        "url": "https://data.gov.cz/datová-sada?iri=https://data.gov.cz/zdroj/datové-sady/65993390/1087749998",
        "license": "CC BY 4.0",
        "snapshot": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "items": out,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    full = sum(1 for x in out if x["full_closure"])
    print(f"Saved {OUT.name}: {len(out)} situací v kraji ({full} úplných uzavírek) z {total} záznamů v ČR")


def _deep_values(g: Graph, node, pred, depth: int = 6):
    """All values of `pred` anywhere below `node` (blank-node trees)."""
    if depth == 0:
        return
    for o in g.objects(node, pred):
        yield o
    for p, o in g.predicate_objects(node):
        if p != pred and isinstance(o, BNode):
            yield from _deep_values(g, o, pred, depth - 1)


if __name__ == "__main__":
    main()
