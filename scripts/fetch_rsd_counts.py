"""Traffic volumes (vehicles per day) per road from the ŘSD census 2025 (T7).

Source: ŘSD, Celostátní sčítání dopravy 2025 (preliminary), CC BY-SA 4.0.
https://www.rsd.cz/silnice-a-dalnice/scitani-dopravy

The census table has no coordinates. Census sections and our úseky (Data KHK
"Stav povrchu") both follow the official chainage of a road, so we match them
by position along the road:
1. Order our úseky of road N by úsek number (N.1, N.2, ...) and place each one
   at the middle of its cumulative length.
2. Lay the census sections of road N end to end in table order and scale them
   to the same total length.
3. The úsek takes the SV (all vehicles / 24 h) of the section under its middle.
Check: the share of úseky whose obec appears in the section description
(start/end) is printed as a sanity check.

Check result 15 Oct: the obec matches in 518 of 822 úseky (63 %). With the
order reversed only 298 (36 %), so the direction along the road is right.

Roads not in the census get an estimate: the lower quartile of SV of census
sections of the same class in the kraj (the census covers the busier roads,
so the median would overstate quiet roads). They are labelled "odhad".

Run: uv run --project backend --with openpyxl python scripts/fetch_rsd_counts.py
Output: public/data/intensity.json
"""

from __future__ import annotations

import bisect
import http.client
import io
import json
import statistics
import time
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

import openpyxl

URL = (
    "https://www.rsd.cz/documents/38144/3734982/V2_CSD_2025_20260826.xlsx/"
    "5a2163ce-1bcc-6264-8251-98e4dd34a9ec?t=1788264442427"
)
DATA = Path(__file__).resolve().parents[1] / "public" / "data"
OUT = DATA / "intensity.json"
KRAJ = "CZ052"


def load_census() -> list[dict]:
    raw = b""
    for attempt in range(4):  # rsd.cz sometimes cuts the download
        try:
            with urllib.request.urlopen(URL, timeout=120) as res:
                raw = res.read()
            break
        except (OSError, http.client.IncompleteRead):
            time.sleep(2 * (attempt + 1))
    if not raw:
        raise RuntimeError(f"Download failed: {URL}")
    ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[1]
    return [dict(zip(header, r)) for r in rows[2:] if r[1] == KRAJ]


def usek_order(usek: str) -> tuple[int, ...]:
    tail = usek.split(".", 1)[1] if "." in usek else "0"
    return tuple(int(p) if p.isdigit() else 0 for p in tail.split("."))


def road_class(sil: str) -> str:
    n = len(sil.lstrip("0"))
    return "2" if n == 3 else "3" if n >= 4 else "1"


def main() -> None:
    census = load_census()
    roads = json.loads((DATA / "roads.json").read_text(encoding="utf-8"))["roads"]

    sections: dict[str, list[dict]] = defaultdict(list)
    for row in census:
        if isinstance(row.get("SV"), (int, float)) and isinstance(row.get("DÉLKA"), (int, float)):
            sections[str(row["SIL"]).lstrip("0")].append(row)
    for rows in sections.values():
        rows.sort(key=lambda r: r["PČ"])

    by_class: dict[str, list[int]] = defaultdict(list)
    for sil, rows in sections.items():
        by_class[road_class(sil)] += [int(r["SV"]) for r in rows]
    class_median = {k: int(statistics.median(v)) for k, v in by_class.items()}
    class_estimate = {k: int(statistics.quantiles(v, n=4)[0]) for k, v in by_class.items()}

    # Group our road pieces by road number and úsek.
    pieces: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for r in roads:
        pieces[r["sil"].lstrip("0")][r["usek"]].append(r)

    out: dict[str, dict] = {}
    name_hits = name_checks = 0
    for sil, useky in pieces.items():
        rows = sections.get(sil)
        if not rows:
            sv = class_estimate[road_class(sil)]
            for parts in useky.values():
                for r in parts:
                    out[str(r["id"])] = {"sv": sv, "src": "odhad"}
            continue

        order = sorted(useky, key=usek_order)
        lengths = [sum(p["delka"] for p in useky[u]) for u in order]
        total_ours = sum(lengths) or 1
        ends, acc = [], 0.0
        for row in rows:
            acc += float(row["DÉLKA"])
            ends.append(acc)
        scale = ends[-1] / total_ours

        pos = 0.0
        for usek, length in zip(order, lengths):
            mid = (pos + length / 2) * scale
            pos += length
            i = min(bisect.bisect_left(ends, mid), len(rows) - 1)
            row = rows[i]
            text = " ".join(str(row.get(k) or "") for k in ("ZAČÁTEK ÚSEKU", "KONEC ÚSEKU", "STANOVIŠTĚ SČÍTAČE"))
            near = " ".join(
                str(rows[j].get(k) or "")
                for j in (i - 1, i + 1)
                if 0 <= j < len(rows)
                for k in ("ZAČÁTEK ÚSEKU", "KONEC ÚSEKU")
            )
            obce = {o for p in useky[usek] for o in p.get("obce", [])}
            if obce:
                name_checks += 1
                name_hits += any(o.split(" nad ")[0].split(" pod ")[0] in text + " " + near for o in obce)
            for p in useky[usek]:
                out[str(p["id"])] = {"sv": int(row["SV"]), "src": "csd2025", "usek": row["ÚSEK"]}

    measured_km = sum(r["delka"] for r in roads if out[str(r["id"])]["src"] == "csd2025") / 1000
    total_km = sum(r["delka"] for r in roads) / 1000
    result = {
        "source": "ŘSD, Celostátní sčítání dopravy 2025 (předběžné výsledky)",
        "url": "https://www.rsd.cz/silnice-a-dalnice/scitani-dopravy",
        "license": "CC BY-SA 4.0",
        "generated": date.today().isoformat(),
        "method": (
            "Sčítací úseky ŘSD spárované s úseky Data KHK podle čísla silnice a polohy podél silnice. "
            "Silnice bez sčítání mají odhad: dolní kvartil sčítaných úseků stejné třídy v kraji "
            "(sčítá se hlavně na frekventovanějších silnicích)."
        ),
        "class_median": class_median,
        "class_estimate": class_estimate,
        "check": {"obec_in_section_text": name_hits, "useky_with_obec": name_checks},
        "roads": out,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"Saved {OUT.name}: {len(out)} kusů úseků, měřeno {measured_km:.0f} z {total_km:.0f} km, "
        f"medián tříd {class_median}, odhad {class_estimate}, shoda názvu obce {name_hits}/{name_checks}"
    )


if __name__ == "__main__":
    main()
