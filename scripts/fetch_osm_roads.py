"""Download I. class roads and motorways in the Královéhradecký kraj from OSM.

The Data KHK layers only contain II. and III. class roads. Without the
I. class roads the road graph falls apart and many detours are not found.

Data: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).

Run: uv run --project backend python scripts/fetch_osm_roads.py
Output: public/data/osm_roads.json
"""

from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

OVERPASS = "https://overpass-api.de/api/interpreter"
# Bounding box of the kraj with a small margin (south, west, north, east).
BBOX = (49.90, 15.00, 50.90, 16.80)
OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "osm_roads.json"
MAX_STEP_M = 20.0  # densify so II./III. road ends can snap onto these roads

QUERY = f"""
[out:json][timeout:180];
way["highway"~"^(motorway|trunk|primary)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
out tags geom;
"""


def densify(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    kx = 111_320.0 * math.cos(math.radians(50.3))
    ky = 110_540.0
    out = [coords[0]]
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        d = math.hypot((x2 - x1) * kx, (y2 - y1) * ky)
        steps = max(1, math.ceil(d / MAX_STEP_M))
        for s in range(1, steps + 1):
            t = s / steps
            out.append((x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
    return [(round(x, 5), round(y, 5)) for x, y in out]


def main() -> None:
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": "cesty-khk-hackathon/0.1"})
    with urllib.request.urlopen(req, timeout=240) as resp:
        raw = json.load(resp)

    roads = []
    for el in raw.get("elements", []):
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        tags = el.get("tags", {})
        roads.append(
            {
                "osm_id": el["id"],
                "highway": tags.get("highway", ""),
                "ref": tags.get("ref", ""),
                "name": tags.get("name", ""),
                "oneway": tags.get("oneway") == "yes",
                "g": densify([(p["lon"], p["lat"]) for p in geom]),
            }
        )

    OUT.write_text(
        json.dumps(
            {
                "source": "© OpenStreetMap contributors, ODbL 1.0",
                "bbox": BBOX,
                "roads": roads,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"{len(roads)} ways -> {OUT}")


if __name__ == "__main__":
    main()
