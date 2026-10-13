"""Load the data snapshot produced by scripts/fetch-data.mjs (public/data/*.json)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .schemas import RoadSummary

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[3] / "public" / "data"


@dataclass
class Dataset:
    roads: list[dict[str, Any]]
    stats: dict[str, Any]
    pois: list[dict[str, Any]]
    doctors: list[dict[str, Any]]
    threatened: dict[str, str]
    lines: list[dict[str, Any]]
    stops: list[dict[str, Any]]
    connections: list[dict[str, Any]]
    point_repairs: list[dict[str, Any]]
    repairs: list[dict[str, Any]]

    def __post_init__(self) -> None:
        self.by_id: dict[int, dict[str, Any]] = {r["id"]: r for r in self.roads}


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_dataset(data_dir: Path | str | None = None) -> Dataset:
    d = Path(data_dir) if data_dir else DEFAULT_DATA_DIR
    roads = _read(d / "roads.json")
    pois = _read(d / "pois.json")
    transit = _read(d / "transit.json")
    repairs = _read(d / "repairs.json")
    return Dataset(
        roads=roads["roads"],
        stats=roads["stats"],
        pois=pois["pois"],
        doctors=pois.get("doctors", []),
        threatened=pois.get("threatened", {}),
        lines=transit["lines"],
        stops=transit["stops"],
        connections=transit["connections"],
        point_repairs=transit.get("pointRepairs", []),
        repairs=repairs["repairs"],
    )


def summary(road: dict[str, Any]) -> RoadSummary:
    return RoadSummary(
        id=road["id"],
        usek=road["usek"],
        sil=road["sil"],
        trida=road["trida"],
        okres=road["okres"],
        stav=road["stav"],
        rok=road["rok"],
        delka_m=road["delka"],
        last_repair=road.get("lastRepair"),
        obce=road.get("obce", []),
        lines=[line["linka"] for line in road.get("lines", [])],
    )
