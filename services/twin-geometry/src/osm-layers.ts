import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { BoundingBox } from "@polaris/domain";
import { withRetry } from "@polaris/connector-sdk";
import type { Feature, FeatureCollection } from "geojson";
import { TWIN_PERF, budgetFeatures } from "./perf-budget.js";

const OVERPASS_ENDPOINTS = [
  process.env.POLARIS_OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter((url, i, all) => all.indexOf(url) === i);

function bboxClause(b: BoundingBox): string {
  return `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
}

async function overpassOnce(endpoint: string, query: string): Promise<{ elements: OsmEl[] }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "POLARIS-Twin3D/0.4 (research; respectful Overpass use)",
    },
    body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 429 || res.status === 504) throw new Error(`Overpass ${res.status}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Overpass HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json() as Promise<{ elements: OsmEl[] }>;
}

async function overpass(query: string): Promise<{ elements: OsmEl[] }> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await withRetry(`overpass-twin3d:${new URL(endpoint).host}`, () => overpassOnce(endpoint, query), {
        maxAttempts: 3,
        baseDelayMs: 2000,
        maxDelayMs: 12_000,
      });
    } catch (err) {
      lastError = err;
      console.warn(`[overpass] ${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface OsmEl {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  center?: { lat: number; lon: number };
}

function ringFromGeom(geom: Array<{ lat: number; lon: number }>): [number, number][] {
  const coords = geom.map((g) => [g.lon, g.lat] as [number, number]);
  if (coords.length < 3) return coords;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first]);
  return coords;
}

function buildingHeight(tags: Record<string, string>): { height: number; source: "osm-height" | "osm-levels" | "estimated" } {
  const h = tags.height ? parseFloat(tags.height) : NaN;
  if (Number.isFinite(h) && h > 1 && h < 800) return { height: h, source: "osm-height" };
  const levels = tags["building:levels"] ? parseFloat(tags["building:levels"]) : NaN;
  if (Number.isFinite(levels) && levels > 0) return { height: Math.min(levels * 3.2, 400), source: "osm-levels" };
  if (tags.building === "roof") return { height: 3, source: "estimated" };
  return { height: 10, source: "estimated" }; // documented low-rise when OSM has building=* but no height
}

function featureCollection(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

export interface OsmLayerResult {
  buildings: FeatureCollection;
  roads: FeatureCollection;
  water: FeatureCollection;
  vegetation: FeatureCollection;
  pois: FeatureCollection;
  warnings: string[];
  missing: string[];
}

export async function fetchOsmSceneLayers(
  bbox: BoundingBox,
  outDir: string,
  center?: { lon: number; lat: number },
): Promise<OsmLayerResult> {
  mkdirSync(outDir, { recursive: true });
  const warnings: string[] = [];
  const missing: string[] = [];
  const bb = bboxClause(bbox);

  const buildingsQ = `
[out:json][timeout:180];
(
  way["building"](${bb});
  relation["building"](${bb});
);
out geom;
`.trim();

  const roadsQ = `
[out:json][timeout:180];
(
  way["highway"](${bb});
);
out geom;
`.trim();

  const waterQ = `
[out:json][timeout:180];
(
  way["natural"="water"](${bb});
  relation["natural"="water"](${bb});
  way["waterway"~"river|canal|stream"](${bb});
);
out geom;
`.trim();

  const vegQ = `
[out:json][timeout:180];
(
  way["leisure"="park"](${bb});
  relation["leisure"="park"](${bb});
  way["landuse"~"forest|meadow|grass"](${bb});
  way["natural"~"wood|scrub"](${bb});
);
out geom;
`.trim();

  const poiQ = `
[out:json][timeout:120];
(
  nwr["amenity"~"hospital|school|college|university|police|fire_station"](${bb});
  nwr["tourism"="hotel"](${bb});
  nwr["aeroway"~"aerodrome|terminal"](${bb});
  nwr["railway"="station"](${bb});
  nwr["public_transport"="station"](${bb});
  nwr["place"~"suburb|neighbourhood|quarter"](${bb});
);
out center tags;
`.trim();

  let buildingsEl: OsmEl[] = [];
  let roadsEl: OsmEl[] = [];
  let waterEl: OsmEl[] = [];
  let vegEl: OsmEl[] = [];
  let poiEl: OsmEl[] = [];

  try {
    buildingsEl = (await overpass(buildingsQ)).elements ?? [];
  } catch (e) {
    warnings.push(`Buildings Overpass failed: ${e instanceof Error ? e.message : String(e)}`);
    missing.push("buildings");
  }
  await new Promise((r) => setTimeout(r, 800));
  try {
    roadsEl = (await overpass(roadsQ)).elements ?? [];
  } catch (e) {
    warnings.push(`Roads Overpass failed: ${e instanceof Error ? e.message : String(e)}`);
    missing.push("roads");
  }
  await new Promise((r) => setTimeout(r, 800));
  try {
    waterEl = (await overpass(waterQ)).elements ?? [];
  } catch (e) {
    warnings.push(`Water Overpass failed: ${e instanceof Error ? e.message : String(e)}`);
    missing.push("water");
  }
  await new Promise((r) => setTimeout(r, 800));
  try {
    vegEl = (await overpass(vegQ)).elements ?? [];
  } catch (e) {
    warnings.push(`Vegetation Overpass failed: ${e instanceof Error ? e.message : String(e)}`);
    missing.push("vegetation");
  }
  await new Promise((r) => setTimeout(r, 800));
  try {
    poiEl = (await overpass(poiQ)).elements ?? [];
  } catch (e) {
    warnings.push(`POI Overpass failed: ${e instanceof Error ? e.message : String(e)}`);
    missing.push("pois");
  }

  const buildings: Feature[] = [];
  for (const el of buildingsEl) {
    if (!el.geometry || el.geometry.length < 3) continue;
    const ring = ringFromGeom(el.geometry);
    if (ring.length < 4) continue;
    const tags = el.tags ?? {};
    const heightInfo = buildingHeight(tags);
    buildings.push({
      type: "Feature",
      id: `osm-building-${el.id}`,
      properties: {
        id: `osm-building-${el.id}`,
        name: tags.name ?? tags["addr:housename"] ?? `Building ${el.id}`,
        kind: "building",
        height: heightInfo.height,
        heightSource: heightInfo.source,
        levels: tags["building:levels"] ? Number(tags["building:levels"]) : null,
        building: tags.building,
        amenity: tags.amenity ?? null,
        tourism: tags.tourism ?? null,
        office: tags.office ?? null,
        searchText: `${tags.name ?? ""} building`.toLowerCase(),
        provenance: "OpenStreetMap",
        license: "ODbL-1.0",
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  const roads: Feature[] = [];
  for (const el of roadsEl) {
    if (!el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    const coords = el.geometry.map((g) => [g.lon, g.lat] as [number, number]);
    roads.push({
      type: "Feature",
      id: `osm-road-${el.id}`,
      properties: {
        id: `osm-road-${el.id}`,
        name: tags.name ?? tags.ref ?? tags.highway ?? `Road ${el.id}`,
        kind: "road",
        highway: tags.highway,
        searchText: `${tags.name ?? ""} ${tags.ref ?? ""} road ${tags.highway ?? ""}`.toLowerCase(),
        provenance: "OpenStreetMap",
        license: "ODbL-1.0",
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }

  const water: Feature[] = [];
  for (const el of waterEl) {
    if (!el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    const coords = el.geometry.map((g) => [g.lon, g.lat] as [number, number]);
    const isPoly = tags.natural === "water" || Boolean(tags.water);
    if (isPoly && coords.length >= 3) {
      const ring = ringFromGeom(el.geometry);
      if (ring.length >= 4) {
        water.push({
          type: "Feature",
          id: `osm-water-${el.id}`,
          properties: {
            id: `osm-water-${el.id}`,
            name: tags.name ?? "Water",
            kind: "water",
            searchText: `${tags.name ?? ""} water`.toLowerCase(),
            provenance: "OpenStreetMap",
            license: "ODbL-1.0",
          },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      }
    } else {
      water.push({
        type: "Feature",
        id: `osm-waterway-${el.id}`,
        properties: {
          id: `osm-waterway-${el.id}`,
          name: tags.name ?? tags.waterway ?? "Waterway",
          kind: "waterway",
          searchText: `${tags.name ?? ""} waterway`.toLowerCase(),
          provenance: "OpenStreetMap",
          license: "ODbL-1.0",
        },
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  }

  const vegetation: Feature[] = [];
  for (const el of vegEl) {
    if (!el.geometry || el.geometry.length < 3) continue;
    const ring = ringFromGeom(el.geometry);
    if (ring.length < 4) continue;
    const tags = el.tags ?? {};
    vegetation.push({
      type: "Feature",
      id: `osm-veg-${el.id}`,
      properties: {
        id: `osm-veg-${el.id}`,
        name: tags.name ?? tags.leisure ?? tags.landuse ?? tags.natural ?? "Vegetation",
        kind: "vegetation",
        searchText: `${tags.name ?? ""} park vegetation forest`.toLowerCase(),
        provenance: "OpenStreetMap",
        license: "ODbL-1.0",
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  const pois: Feature[] = [];
  for (const el of poiEl) {
    const tags = el.tags ?? {};
    let lon: number | undefined;
    let lat: number | undefined;
    if (el.type === "node" && el.lon != null && el.lat != null) {
      lon = el.lon;
      lat = el.lat;
    } else if (el.center) {
      lon = el.center.lon;
      lat = el.center.lat;
    }
    if (lon == null || lat == null) continue;

    let kind = "poi";
    if (tags.amenity === "hospital" || tags.healthcare === "hospital") kind = "hospital";
    else if (tags.amenity === "university") kind = "university";
    else if (tags.amenity === "school" || tags.amenity === "college") kind = "school";
    else if (tags.amenity === "police") kind = "police";
    else if (tags.amenity === "fire_station") kind = "fire_station";
    else if (tags.tourism === "hotel" || tags.amenity === "hotel") kind = "hotel";
    else if (tags.aeroway) kind = "airport";
    else if (tags.railway === "station" || tags.public_transport === "station") kind = "railway_station";
    else if (tags.place) kind = "neighbourhood";

    const name = tags.name ?? tags["name:en"] ?? `${kind} ${el.id}`;
    pois.push({
      type: "Feature",
      id: `osm-poi-${el.id}`,
      properties: {
        id: `osm-poi-${el.id}`,
        name,
        kind,
        searchText: `${name} ${kind}`.toLowerCase(),
        amenity: tags.amenity,
        place: tags.place,
        provenance: "OpenStreetMap",
        license: "ODbL-1.0",
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }

  const ctr = center ?? {
    lon: (bbox.minLon + bbox.maxLon) / 2,
    lat: (bbox.minLat + bbox.maxLat) / 2,
  };

  const bBudget = budgetFeatures(buildings, TWIN_PERF.maxBuildings, ctr);
  const rBudget = budgetFeatures(roads, TWIN_PERF.maxRoads, ctr);
  const wBudget = budgetFeatures(water, TWIN_PERF.maxWater, ctr);
  const vBudget = budgetFeatures(vegetation, TWIN_PERF.maxVegetation, ctr);
  const pBudget = budgetFeatures(pois, TWIN_PERF.maxPois, ctr);

  if (bBudget.truncated) {
    warnings.push(
      `Buildings truncated ${bBudget.truncated} → ${bBudget.kept.length} (centroid budget ${TWIN_PERF.maxBuildings}) for Cesium stability.`,
    );
  }
  if (rBudget.truncated) {
    warnings.push(
      `Roads truncated ${rBudget.truncated} → ${rBudget.kept.length} (budget ${TWIN_PERF.maxRoads}).`,
    );
  }
  if (wBudget.truncated) warnings.push(`Water truncated ${wBudget.truncated} → ${wBudget.kept.length}.`);
  if (vBudget.truncated) warnings.push(`Vegetation truncated ${vBudget.truncated} → ${vBudget.kept.length}.`);
  if (pBudget.truncated) warnings.push(`POIs truncated ${pBudget.truncated} → ${pBudget.kept.length}.`);

  const result: OsmLayerResult = {
    buildings: featureCollection(bBudget.kept),
    roads: featureCollection(rBudget.kept),
    water: featureCollection(wBudget.kept),
    vegetation: featureCollection(vBudget.kept),
    pois: featureCollection(pBudget.kept),
    warnings,
    missing,
  };

  writeFileSync(join(outDir, "buildings.geojson"), JSON.stringify(result.buildings));
  writeFileSync(join(outDir, "roads.geojson"), JSON.stringify(result.roads));
  writeFileSync(join(outDir, "water.geojson"), JSON.stringify(result.water));
  writeFileSync(join(outDir, "vegetation.geojson"), JSON.stringify(result.vegetation));
  writeFileSync(join(outDir, "pois.geojson"), JSON.stringify(result.pois));
  writeFileSync(
    join(outDir, "osm-raw-meta.json"),
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        overpass: OVERPASS_ENDPOINTS,
        countsRaw: {
          buildings: buildings.length,
          roads: roads.length,
          water: water.length,
          vegetation: vegetation.length,
          pois: pois.length,
        },
        countsBudgeted: {
          buildings: bBudget.kept.length,
          roads: rBudget.kept.length,
          water: wBudget.kept.length,
          vegetation: vBudget.kept.length,
          pois: pBudget.kept.length,
        },
        perfBudget: TWIN_PERF,
      },
      null,
      2,
    ),
  );

  return result;
}
