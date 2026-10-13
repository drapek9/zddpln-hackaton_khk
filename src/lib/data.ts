import type { Dataset, Repair } from "./types";

export async function loadDataset(): Promise<{ data: Dataset; repairs: Repair[] }> {
  const [roadsRes, poisRes, transitRes, repairsRes] = await Promise.all([
    fetch("/data/roads.json"),
    fetch("/data/pois.json"),
    fetch("/data/transit.json"),
    fetch("/data/repairs.json"),
  ]);
  if (!roadsRes.ok) {
    throw new Error("Data se nepodařilo načíst. Spusťte npm run fetch-data.");
  }
  const roadsJson = await roadsRes.json();
  const poisJson = await poisRes.json();
  const transitJson = await transitRes.json();
  const repairsJson = await repairsRes.json();
  return {
    data: {
      roads: roadsJson.roads,
      stats: roadsJson.stats,
      pois: poisJson.pois,
      doctors: poisJson.doctors,
      threatened: poisJson.threatened,
      lines: transitJson.lines,
      stops: transitJson.stops,
      connections: transitJson.connections,
      pointRepairs: transitJson.pointRepairs,
    },
    repairs: repairsJson.repairs,
  };
}
