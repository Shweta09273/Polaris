/**
 * Demo-ready performance budgets for twin geometry.
 * Evidence (2026-07-26 artifacts under data/twin3d/):
 * - Monaco: 5.4k buildings / ~4 MB GeoJSON → Cesium OK (~10k entities)
 * - Amsterdam: 307k buildings / 143 MB → multi-minute parse + Entity explosion
 * - Singapore: 66k buildings + 112k roads / ~78 MB → browser OOM risk
 */
import type { Feature, Position } from "geojson";

export const TWIN_PERF = {
  maxBuildings: 12_000,
  maxRoads: 15_000,
  maxWater: 4_000,
  maxVegetation: 3_000,
  maxPois: 2_000,
  maxSearchRoads: 800,
  maxSearchPois: 2_000,
  clientChunkSize: 1_500,
  outlineBuildingLimit: 4_000,
} as const;

export function featureCentroid(f: Feature): { lon: number; lat: number } | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Point") return { lon: g.coordinates[0]!, lat: g.coordinates[1]! };
  let coords: Position[] = [];
  if (g.type === "Polygon") coords = g.coordinates[0] ?? [];
  else if (g.type === "LineString") coords = g.coordinates;
  else if (g.type === "MultiPolygon") coords = g.coordinates[0]?.[0] ?? [];
  if (!coords.length) return null;
  let lon = 0;
  let lat = 0;
  for (const c of coords) {
    lon += c[0] ?? 0;
    lat += c[1] ?? 0;
  }
  return { lon: lon / coords.length, lat: lat / coords.length };
}

/** Keep features closest to AOI center — preserves downtown visual quality under budget. */
export function budgetFeatures<T extends Feature>(
  features: T[],
  max: number,
  center: { lon: number; lat: number },
): { kept: T[]; truncated: number } {
  if (features.length <= max) return { kept: features, truncated: 0 };
  const scored = features.map((f) => {
    const c = featureCentroid(f);
    const d = c
      ? (c.lon - center.lon) ** 2 + (c.lat - center.lat) ** 2
      : Number.POSITIVE_INFINITY;
    return { f, d };
  });
  scored.sort((a, b) => a.d - b.d);
  return {
    kept: scored.slice(0, max).map((s) => s.f),
    truncated: features.length - max,
  };
}
