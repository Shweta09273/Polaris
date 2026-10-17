import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { AffectedEntity, Severity } from "./types.js";

const R = 6371000;

export function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function featureCentroid(f: Feature): { lon: number; lat: number } | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Point") {
    return { lon: g.coordinates[0]!, lat: g.coordinates[1]! };
  }
  const coords: Position[] = [];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      coords.push(c as Position);
      return;
    }
    for (const x of c) walk(x);
  };
  walk((g as Geometry & { coordinates: unknown }).coordinates);
  if (!coords.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of coords) {
    sx += x!;
    sy += y!;
  }
  return { lon: sx / coords.length, lat: sy / coords.length };
}

export function sampleHeight(
  hm: {
    cols: number;
    rows: number;
    west: number;
    south: number;
    east: number;
    north: number;
    heights: number[];
  },
  lon: number,
  lat: number,
): number | null {
  if (lon < hm.west || lon > hm.east || lat < hm.south || lat > hm.north) return null;
  const u = (lon - hm.west) / (hm.east - hm.west);
  const v = (hm.north - lat) / (hm.north - hm.south);
  const col = Math.min(hm.cols - 1, Math.max(0, Math.floor(u * hm.cols)));
  const row = Math.min(hm.rows - 1, Math.max(0, Math.floor(v * hm.rows)));
  const h = hm.heights[row * hm.cols + col];
  return Number.isFinite(h) ? (h as number) : null;
}

export function circlePolygon(lon: number, lat: number, radiusM: number, steps = 48): FeatureCollection {
  const coords: Position[] = [];
  const dLat = radiusM / R;
  const dLon = radiusM / (R * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([
      lon + ((dLon * 180) / Math.PI) * Math.cos(a),
      lat + ((dLat * 180) / Math.PI) * Math.sin(a),
    ]);
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "impact_zone", radius_m: radiusM },
        geometry: { type: "Polygon", coordinates: [coords] },
      },
    ],
  };
}

export function prop(f: Feature, key: string): unknown {
  return f.properties?.[key];
}

export function featureId(f: Feature, fallbackPrefix: string, i: number): string {
  const id = f.id ?? prop(f, "id");
  if (id != null) return String(id);
  return `${fallbackPrefix}-${i}`;
}

export function featureName(f: Feature, fallback: string): string {
  const n = prop(f, "name");
  return typeof n === "string" && n.trim() ? n : fallback;
}

export function toAffected(
  f: Feature,
  layer: string,
  kind: string,
  severity: Severity,
  reason: string,
  i: number,
): AffectedEntity | null {
  const c = featureCentroid(f);
  if (!c) return null;
  return {
    id: featureId(f, layer, i),
    name: featureName(f, `${kind} ${i}`),
    kind,
    layer,
    lon: c.lon,
    lat: c.lat,
    severity,
    reason,
  };
}

export function featuresToCollection(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

/** Documented V1 population proxy — NOT census. */
export const POPULATION_PER_BUILDING = 2.4;
export const POPULATION_ASSUMPTION =
  `Population proxy = affected_buildings × ${POPULATION_PER_BUILDING} (documented urban occupancy factor). Not census data.`;

/** Documented V1 unit costs (EUR) — planning estimates only. */
export const COST_PER_BUILDING_EUR = 850;
export const COST_PER_ROAD_EUR = 1200;
export const COST_PER_CRITICAL_POI_EUR = 5000;
export const COST_ASSUMPTION =
  `Economic impact EUR = buildings×${COST_PER_BUILDING_EUR} + roads×${COST_PER_ROAD_EUR} + critical_pois×${COST_PER_CRITICAL_POI_EUR} (documented V1 unit costs, not actuarial).`;

export function populationProxy(buildingsAffected: number): number {
  return Math.round(buildingsAffected * POPULATION_PER_BUILDING);
}

export function economicImpactEur(opts: {
  buildings?: number;
  roads?: number;
  criticalPois?: number;
}): number {
  return (
    (opts.buildings ?? 0) * COST_PER_BUILDING_EUR +
    (opts.roads ?? 0) * COST_PER_ROAD_EUR +
    (opts.criticalPois ?? 0) * COST_PER_CRITICAL_POI_EUR
  );
}

export function withinRadius(
  features: Feature[],
  lon: number,
  lat: number,
  radiusM: number,
): Array<{ feature: Feature; dist: number; index: number }> {
  const out: Array<{ feature: Feature; dist: number; index: number }> = [];
  features.forEach((feature, index) => {
    const c = featureCentroid(feature);
    if (!c) return;
    const dist = haversineM(lon, lat, c.lon, c.lat);
    if (dist <= radiusM) out.push({ feature, dist, index });
  });
  return out;
}
