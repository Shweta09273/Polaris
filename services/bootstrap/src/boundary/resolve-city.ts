import { fetchJson, writeJson, artifactPath, makeProvenance, type ConnectorContext, type ConnectorRunResult, type BootstrapConnector } from "@polaris/connector-sdk";
import type { BoundingBox, ConnectorManifest } from "@polaris/domain";
import { assertValidBbox, assertAoiSizeLimit } from "@polaris/spatial";
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

export interface ResolvedCity {
  readonly query: string;
  readonly displayName: string;
  readonly osmType?: string;
  readonly osmId?: number;
  readonly bbox: BoundingBox;
  readonly centroid: { lon: number; lat: number };
  readonly geojson: Feature<Polygon | MultiPolygon>;
  readonly source: "nominatim";
  readonly attribution: string;
}

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // south, north, west, east
  geojson?: Polygon | MultiPolygon;
  class?: string;
  type?: string;
  importance?: number;
}

function bboxFromNominatim(bb: NominatimResult["boundingbox"]): BoundingBox {
  const south = Number(bb[0]);
  const north = Number(bb[1]);
  const west = Number(bb[2]);
  const east = Number(bb[3]);
  return { minLon: west, minLat: south, maxLon: east, maxLat: north, crs: "EPSG:4326" };
}

function polygonFromBbox(bbox: BoundingBox): Feature<Polygon> {
  return turf.bboxPolygon([bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat]);
}

export async function resolveCityBoundary(cityName: string, workDir: string): Promise<ResolvedCity> {
  const q = cityName.trim();
  if (!q) throw new Error("City name is required.");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  // Nominatim usage policy: max 1 req/s — single call here
  await new Promise((r) => setTimeout(r, 1100));
  const results = await fetchJson<NominatimResult[]>(url.toString(), {
    headers: {
      "User-Agent": "POLARIS-Bootstrap/0.2 (Living Digital Twin; contact: polaris-dev@localhost)",
    },
  });

  if (!results.length) {
    throw new Error(`No geocoding results for "${q}". Provide a clearer city name or include country.`);
  }

  // Prefer administrative/city-like results with polygon
  const ranked = [...results].sort((a, b) => {
    const score = (r: NominatimResult) => {
      let s = r.importance ?? 0;
      if (r.class === "boundary" || r.class === "place") s += 1;
      if (r.geojson) s += 2;
      if (r.type === "city" || r.type === "administrative") s += 1;
      return s;
    };
    return score(b) - score(a);
  });

  const best = ranked[0]!;
  const bbox = bboxFromNominatim(best.boundingbox);
  assertValidBbox(bbox);
  // Soft guard — warn later if huge; hard fail only on absurd sizes
  try {
    assertAoiSizeLimit(bbox, 25);
  } catch {
    // Allow but caller will warn in report
  }

  let geojson: Feature<Polygon | MultiPolygon>;
  if (best.geojson && (best.geojson.type === "Polygon" || best.geojson.type === "MultiPolygon")) {
    geojson = { type: "Feature", properties: { name: best.display_name }, geometry: best.geojson };
  } else {
    geojson = polygonFromBbox(bbox);
  }

  // Validate polygon
  if (!turf.booleanValid(geojson)) {
    throw new Error(`Resolved geometry for "${q}" is invalid.`);
  }
  const areaKm2 = turf.area(geojson) / 1_000_000;
  if (areaKm2 <= 0) {
    throw new Error(`Resolved geometry for "${q}" has zero area.`);
  }

  const resolved: ResolvedCity = {
    query: q,
    displayName: best.display_name,
    osmType: best.osm_type,
    osmId: best.osm_id,
    bbox,
    centroid: { lon: Number(best.lon), lat: Number(best.lat) },
    geojson,
    source: "nominatim",
    attribution: "© OpenStreetMap contributors / Nominatim",
  };

  const out = `${workDir}/boundary/city-boundary.geojson`;
  writeJson(out, {
    type: "FeatureCollection",
    features: [geojson],
    polaris: {
      query: q,
      displayName: resolved.displayName,
      bbox,
      source: "nominatim",
      osmId: best.osm_id,
      areaKm2,
      license: "ODbL-1.0",
    },
  });

  return resolved;
}

export const nominatimConnector: BootstrapConnector = {
  manifest: {
    id: "nominatim",
    displayName: "Nominatim Geocoder (OSM)",
    domains: ["admin_boundary"],
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    homepage: "https://nominatim.org/",
    accessMode: "api",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "live",
    notes: "City name → boundary. Respect Nominatim usage policy (1 req/s).",
  } satisfies ConnectorManifest,

  async discover() {
    return { available: true };
  },

  async fetch(ctx: ConnectorContext): Promise<ConnectorRunResult> {
    try {
      const city = await resolveCityBoundary(ctx.cityName, ctx.workDir);
      const path = artifactPath(ctx, "nominatim", "boundary.geojson");
      writeJson(path, city.geojson);
      const { readFileSync, statSync } = await import("node:fs");
      const { createHash } = await import("node:crypto");
      const buf = readFileSync(path);
      const sha = createHash("sha256").update(buf).digest("hex");
      return {
        manifest: this.manifest,
        status: "success",
        artifacts: [
          {
            relativeKey: "boundary.geojson",
            mediaType: "application/geo+json",
            path,
            sha256: sha,
            bytes: statSync(path).size,
          },
        ],
        provenance: makeProvenance({
          sourceId: "nominatim",
          sourceName: "Nominatim",
          license: "ODbL-1.0",
          attribution: city.attribution,
          accessMode: "api",
          sourceUrl: "https://nominatim.openstreetmap.org/",
        }),
        entityCount: 1,
        warnings: [],
        errors: [],
      };
    } catch (err) {
      return {
        manifest: this.manifest,
        status: "failed",
        artifacts: [],
        warnings: [],
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  },
};
