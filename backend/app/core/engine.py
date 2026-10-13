"""Engine: the only entry point the API layer uses from core.

The engine is stateless towards the database. The API passes in pins, votes,
weights and closures; the engine computes. Load it once at startup.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from . import scoring
from .data import Dataset, load_dataset, summary
from .graph import RoadGraph
from .schemas import DetourResult, LonLat, Pin, RankedRoad, RoadSummary, RouteResult, ScorePart, Weights


class Engine:
    def __init__(self, dataset: Dataset):
        self.data = dataset
        self.graph = RoadGraph.build(dataset.roads, dataset.osm_roads)

    @classmethod
    def load(cls, data_dir: Path | str | None = None) -> "Engine":
        return cls(load_dataset(data_dir))

    # ---- roads ----------------------------------------------------------

    def roads(self) -> list[RoadSummary]:
        return [summary(r) for r in self.data.roads]

    def road(self, road_id: int) -> dict[str, Any] | None:
        """Full raw road record (geometry, counts, samples, lines)."""
        return self.data.by_id.get(road_id)

    # ---- priority -------------------------------------------------------

    def score(self, road_id: int, weights: Weights | None = None, votes: int = 0) -> int:
        return scoring.score(self._require(road_id), weights or Weights(), votes)

    def breakdown(self, road_id: int, weights: Weights | None = None, votes: int = 0) -> list[ScorePart]:
        return scoring.score_parts(self._require(road_id), weights or Weights(), votes)

    def ranking(
        self,
        weights: Weights | None = None,
        pins: Iterable[Pin] = (),
        votes: dict[int, int] | None = None,
    ) -> list[RankedRoad]:
        return scoring.ranking(self.data.roads, weights or Weights(), pins, votes)

    # ---- closures and routes -------------------------------------------

    def detour(self, road_id: int) -> DetourResult:
        self._require(road_id)
        return self.graph.detour(road_id)

    def route(self, home: LonLat, work: LonLat, closed: Iterable[int] = ()) -> RouteResult:
        """Fastest route between two points. `closed` = road ids to avoid."""
        return self.graph.route(home, work, closed)

    def _require(self, road_id: int) -> dict[str, Any]:
        road = self.data.by_id.get(road_id)
        if road is None:
            raise KeyError(f"Unknown road id {road_id}")
        return road
