"""Download local streets in the Královéhradecký kraj from OSM.

These are the map layer next to kraj roads (II. and III. class) and the
I. class roads already in osm_roads.json. They are not part of the detour
graph. Private, service and track roads are left out.

Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).

Run: uv run --project backend python scripts/fetch_osm_other.py
Output: public/data/osm_other.json
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

SERVERS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
BBOX = (49.90, 15.00, 50.90, 16.80)
OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "osm_other.json"

QUERY = f"""
[out:json][timeout:180];
way["highway"~"^(residential|unclassified|living_street)$"]["access"!~"^(private|no)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
out tags geom;
"""


def main() -> None:
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    raw = None
    last_error: Exception | None = None
    for server in SERVERS:
        req = urllib.request.Request(server, data=body, headers={"User-Agent": "cesty-khk-hackathon/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                raw = json.load(resp)
            break
        except Exception as exc:
            last_error = exc
            print(f"{server} failed: {exc}")
    if raw is None:
        raise SystemExit(f"Overpass nevrátil data: {last_error}")

    roads = []
    for el in raw.get("elements", []):
        tags = el.get("tags") or {}
        highway = tags.get("highway", "")
        if highway in {"track", "service", "private"}:
            continue
        if tags.get("access") in {"private", "no"}:
            continue
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        roads.append(
            {
                "osm_id": el["id"],
                "highway": highway,
                "ref": tags.get("ref", ""),
                "name": tags.get("name", ""),
                "access": tags.get("access", ""),
                "g": [(round(p["lon"], 5), round(p["lat"], 5)) for p in geom],
            }
        )

    OUT.write_text(
        json.dumps(
            {"source": "© OpenStreetMap contributors, ODbL 1.0", "bbox": BBOX, "roads": roads},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"wrote {len(roads)} local roads to {OUT}")


if __name__ == "__main__":
    main()
