"""Download extra Data KHK layers for closure impacts (T13, PLAN_FINAL.md kap. 13).

Layers (all from the Data KHK ArcGIS org, same as scripts/fetch-data.mjs):
- Obce: population per obec, used to report cut-off obce.
- Dojížďka do středních škol: obec of residence -> school, number of students.
- Záplavová území Q5 / Q20 / Q100: flood polygons for the flood scenario.
- Plánované opravy silniční infrastruktury na rok 2022 (liniové): real past closures for the demo.

Flood polygons are large (~570k vertices for Q100), so the script intersects
them with the roads here and stores only the flooded metres per road id plus
simplified polygons for the map.

Run: uv run --project backend --with shapely python scripts/fetch_khk_extra.py
Output: public/data/khk_extra.json
"""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

from shapely import STRtree, make_valid, prepare
from shapely.geometry import LinearRing, LineString, Polygon, mapping
from shapely.ops import unary_union

BASE = "https://services6.arcgis.com/ogJAiK65nXL1mXAW/arcgis/rest/services"
DATA = Path(__file__).resolve().parents[1] / "public" / "data"
OUT = DATA / "khk_extra.json"
KX, KY = 111_320.0 * 0.6388, 110_540.0  # metres per degree at ~50.3° N (cos 50.3° = 0.6388)
SIMPLIFY_DEG = 0.0002  # ~15-20 m, only for the map polygons
PAGE = 2000
# Raw downloads are cached for one run day, so a failed run does not refetch everything.
CACHE = Path(tempfile.gettempdir()) / f"cesty_khk_cache_{date.today().isoformat()}"

LAYERS = {
    "obce": "Obce",
    "students": "Dojížďka_do_středních_škol",
    "q5": "Záplavové_území_pětileté_vody",
    "q20": "Záplavové_území_dvacetileté_vody",
    "q100": "Záplavové_území_stoleté_vody",
    "planned2022": "Plánované_opravy_silniční_infrastruktury_na_rok_2022_liniové",
}


def _get(url: str) -> dict:
    last: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=180) as res:
                data = json.load(res)
            if "error" in data:
                raise RuntimeError(data["error"])
            return data
        except Exception as err:  # ArcGIS sometimes drops the connection
            last = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def layer_url(service: str) -> str:
    return f"{BASE}/{urllib.parse.quote(service)}/FeatureServer/0"


def item_id(service: str) -> str:
    return _get(f"{BASE}/{urllib.parse.quote(service)}/FeatureServer?f=json").get("serviceItemId", "")


def fetch_all(
    service: str, geometry: bool = True, offset_m: float | None = None, page: int = PAGE, out_fields: str = "*"
) -> list[dict]:
    tag = hashlib.sha1(repr((geometry, offset_m, page, out_fields)).encode()).hexdigest()[:8]
    cache = CACHE / f"{service}_{tag}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    features: list[dict] = []
    offset = 0
    # Stable order for paging, else ArcGIS may skip or repeat features.
    order_by = _get(f"{layer_url(service)}?f=json").get("objectIdField") or ""
    while True:
        params = {
            "where": "1=1",
            "outFields": out_fields,
            "returnGeometry": "true" if geometry else "false",
            "outSR": "4326",
            "geometryPrecision": "5",
            "resultOffset": str(offset),
            "resultRecordCount": str(page),
            "orderByFields": order_by,
            "f": "json",
        }
        if offset_m:
            params["maxAllowableOffset"] = str(offset_m / 111_000)
        data = _get(f"{layer_url(service)}/query?{urllib.parse.urlencode(params)}")
        batch = data.get("features", [])
        features += batch
        print(f"  {service}: {len(features)}", end="\r")
        if not batch or (not data.get("exceededTransferLimit") and len(batch) < page):
            break
        offset += len(batch)
    print()
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(features, ensure_ascii=False), encoding="utf-8")
    return features


def ring_centroid(rings: list[list[list[float]]]) -> tuple[float, float]:
    """Area-weighted centroid of the largest ring (good enough for an obec)."""
    best, best_area = None, -1.0
    for ring in rings:
        a = cx = cy = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            cross = x1 * y2 - x2 * y1
            a += cross
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        if abs(a) > best_area and a != 0:
            best_area, best = abs(a), (cx / (3 * a), cy / (3 * a))
    if best is None:
        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        best = (sum(xs) / len(xs), sum(ys) / len(ys))
    return round(best[0], 5), round(best[1], 5)


def _polygonal(geom):
    """Keep only the area parts (make_valid may also return lines or points)."""
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    parts = [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]
    return unary_union(parts) if parts else Polygon()


def esri_polygon(rings: list[list[list[float]]]):
    """ESRI rings: clockwise = outer ring, counter-clockwise = hole."""
    outer = [r for r in rings if len(r) >= 4 and not LinearRing(r).is_ccw]
    holes = [r for r in rings if len(r) >= 4 and LinearRing(r).is_ccw]
    shell = unary_union([_polygonal(make_valid(Polygon(r))) for r in outer])
    if holes:
        shell = shell.difference(unary_union([_polygonal(make_valid(Polygon(r))) for r in holes]))
    return _polygonal(shell)


def _length_m(geom) -> float:
    """Length in metres of a (multi)line in lon/lat."""
    if geom.is_empty:
        return 0.0
    if hasattr(geom, "geoms"):
        return sum(_length_m(g) for g in geom.geoms)
    if geom.geom_type != "LineString":
        return 0.0
    c = list(geom.coords)
    return sum(math.hypot((x2 - x1) * KX, (y2 - y1) * KY) for (x1, y1), (x2, y2) in zip(c, c[1:]))


def _round_geojson(g):
    if isinstance(g, (list, tuple)):
        if g and isinstance(g[0], (int, float)):
            return [round(g[0], 5), round(g[1], 5)]
        return [_round_geojson(x) for x in g]
    if isinstance(g, dict):
        return {k: _round_geojson(v) for k, v in g.items()}
    return g


def bbox(rings: list[list[list[float]]]) -> list[float]:
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    return [min(xs), min(ys), max(xs), max(ys)]


def main() -> None:
    out: dict = {"generated": date.today().isoformat(), "sources": {}}
    for key, service in LAYERS.items():
        out["sources"][key] = {"name": service.replace("_", " "), "itemId": item_id(service), "layer": 0}

    print("Obce")
    obce = []
    for f in fetch_all(LAYERS["obce"], offset_m=50):
        a, rings = f["attributes"], f["geometry"]["rings"]
        obce.append(
            {
                "kod": str(a["kod_obce"]),
                "nazev": a["nazev_obce"],
                "obyvatel": a.get("pocet_obyv") or 0,
                "deti": a.get("pocet_0_14") or 0,
                "senioru": a.get("pocet_65") or 0,
                "c": ring_centroid(rings),
                "b": bbox(rings),
            }
        )
    out["obce"] = obce
    known = {o["kod"] for o in obce}

    print("Dojížďka do středních škol")
    flows: dict[tuple[str, str], dict] = {}
    skipped = defaultdict(int)
    for f in fetch_all(LAYERS["students"], geometry=False):
        a = f["attributes"]
        n = a.get("pocet_zaku") or 0
        if a.get("forma_vzdelavani") != "denní":
            skipped["not_daily"] += n
            continue
        home = str(a.get("kod_obce_bydliste_studenta") or "")
        if home not in known:
            skipped["home_outside_kraj"] += n
            continue
        if a.get("x") is None or a.get("y") is None or not (11 < a["x"] < 19 and 48 < a["y"] < 52):
            skipped["no_school_point"] += n
            continue
        school = str(a.get("red_izo") or a.get("izo"))
        k = (home, school)
        if k not in flows:
            flows[k] = {
                "home": home,
                "school": school,
                "name": (a.get("nazev_skoly") or "").strip(),
                "school_obec": a.get("nazev_obce"),
                "p": [round(a["x"], 5), round(a["y"], 5)],
                "n": 0,
            }
        flows[k]["n"] += n
    out["students"] = sorted(flows.values(), key=lambda fl: -fl["n"])
    out["students_skipped"] = dict(skipped)

    roads = [(r["id"], r["g"]) for r in json.loads((DATA / "roads.json").read_text(encoding="utf-8"))["roads"]]
    osm_path = DATA / "osm_roads.json"
    if osm_path.exists():
        # OSM roads are keyed as "osm:<osm_id>" because core numbers them by file order.
        roads += [(f"osm:{r['osm_id']}", r["g"]) for r in json.loads(osm_path.read_text(encoding="utf-8"))["roads"]]
    lines = [(rid, LineString(g)) for rid, g in roads if len(g) >= 2]
    out["flood"] = {}
    for level in ("q5", "q20", "q100"):
        print(f"Záplavové území {level}")
        polys = []
        for f in fetch_all(LAYERS[level], page=100, out_fields="OBJECTID", offset_m=20):  # server-side generalisation, else 504
            rings = (f.get("geometry") or {}).get("rings") or []
            if rings:
                polys.append(esri_polygon(rings))
        polys = [g for g in polys if not g.is_empty]
        for g in polys:
            prepare(g)
        tree = STRtree(polys)
        flooded: dict[str, int] = {}
        for rid, ln in lines:
            hit = tree.query(ln, predicate="intersects")
            if len(hit) == 0:
                continue
            area = polys[hit[0]] if len(hit) == 1 else unary_union([polys[i] for i in hit])
            metres = _length_m(ln.intersection(area))
            if metres >= 1:
                flooded[str(rid)] = round(metres)
        zone = unary_union(polys)
        simple = zone.simplify(SIMPLIFY_DEG, preserve_topology=True)
        out["flood"][level] = {
            "flooded_m": flooded,
            "geojson": _round_geojson(mapping(simple)),
        }
        print(f"  {len(polys)} polygonů, {len(flooded)} úseků zasahuje do zóny")

    print("Plánované opravy 2022")
    planned = []
    for f in fetch_all(LAYERS["planned2022"]):
        a = f["attributes"]
        planned.append(
            {
                "nazev": a.get("nazev"),
                "silnice": a.get("oznaceni_silnice"),
                "staniceni": a.get("oznaceni_staniceni"),
                "typ_uzavirky": a.get("typ_uzavirky"),
                "od": a.get("zac_omez_provozu"),
                "do": a.get("kon_omez_provozu"),
                "obec": a.get("nazev_obce"),
                "okres": a.get("nazev_okresu"),
                "zdroj_financi": a.get("zdroj_financi"),
                "paths": f["geometry"]["paths"] if f.get("geometry") else [],
            }
        )
    out["planned2022"] = planned

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(fl["n"] for fl in out["students"])
    print(f"Saved {OUT.name}: {len(obce)} obcí, {len(out['students'])} toků ({total} žáků), "
          f"Q100 {len(out['flood']['q100']['flooded_m'])} zasažených úseků, {len(planned)} plánů 2022, skipped {dict(skipped)}")


if __name__ == "__main__":
    main()
