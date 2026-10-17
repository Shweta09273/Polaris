import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchJson } from "@polaris/connector-sdk";
import type { BoundingBox } from "@polaris/domain";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export interface ResolvedBoundary {
  readonly query: string;
  readonly displayName: string;
  readonly bbox: BoundingBox;
  readonly centroid: { lon: number; lat: number };
  readonly boundary: Feature;
  readonly provenance: {
    readonly sourceId: string;
    readonly sourceName: string;
    readonly license: string;
    readonly attribution: string;
    readonly sourceUrl: string;
    readonly fetchedAt: string;
  };
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
  geojson?: Polygon | MultiPolygon;
  class?: string;
  type?: string;
  importance?: number;
  licence?: string;
}

export async function resolveBoundary(cityName: string, outDir: string): Promise<ResolvedBoundary> {
  mkdirSync(outDir, { recursive: true });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", cityName.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "5");

  await new Promise((r) => setTimeout(r, 1100));
  const results = await fetchJson<NominatimResult[]>(url.toString(), {
    headers: {
      "User-Agent": "POLARIS-Twin3D/0.4 (Digital Twin; contact: polaris-dev@localhost)",
    },
  });
  if (!results.length) throw new Error(`No geocoding results for "${cityName}"`);

  const ranked = [...results].sort((a, b) => {
    const score = (r: NominatimResult) =>
      (r.importance ?? 0) + (r.geojson ? 2 : 0) + (r.class === "boundary" || r.class === "place" ? 1 : 0);
    return score(b) - score(a);
  });
  const hit = ranked[0]!;
  const south = Number(hit.boundingbox[0]);
  const north = Number(hit.boundingbox[1]);
  const west = Number(hit.boundingbox[2]);
  const east = Number(hit.boundingbox[3]);
  const bbox: BoundingBox = {
    minLon: west,
    minLat: south,
    maxLon: east,
    maxLat: north,
    crs: "EPSG:4326",
  };

  const geometry =
    hit.geojson ??
    ({
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    } satisfies Polygon);

  const boundary: Feature = {
    type: "Feature",
    properties: {
      name: hit.display_name,
      kind: "boundary",
      provenance: "Nominatim/OSM",
      license: hit.licence ?? "ODbL-1.0",
    },
    geometry,
  };

  writeFileSync(join(outDir, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [boundary] }));
  writeFileSync(
    join(outDir, "boundary-meta.json"),
    JSON.stringify({ displayName: hit.display_name, bbox, nominatim: hit }, null, 2),
  );

  return {
    query: cityName.trim(),
    displayName: hit.display_name.split(",")[0]?.trim() || hit.display_name,
    bbox,
    centroid: { lon: Number(hit.lon), lat: Number(hit.lat) },
    boundary,
    provenance: {
      sourceId: "nominatim",
      sourceName: "OpenStreetMap Nominatim",
      license: "ODbL-1.0",
      attribution: "© OpenStreetMap contributors",
      sourceUrl: "https://nominatim.openstreetmap.org/",
      fetchedAt: new Date().toISOString(),
    },
  };
}
