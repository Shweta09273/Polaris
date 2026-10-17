import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection, Position } from "geojson";
import { resolveBoundary } from "./boundary.js";
import { fetchOsmSceneLayers } from "./osm-layers.js";
import { buildTerrariumHeightmap } from "./terrarium.js";
import {
  DEMO_CITIES,
  centerCropBbox,
  resolveDemoCity,
  type TwinSceneManifest,
  type SceneLayerStatus,
} from "./types.js";
import { TWIN_PERF } from "./perf-budget.js";

export type Twin3dPhase =
  | "queued"
  | "boundary"
  | "datasets"
  | "terrain"
  | "geometry"
  | "scene"
  | "complete"
  | "failed";

export interface Twin3dProgressEvent {
  readonly jobId: string;
  readonly cityName: string;
  readonly phase: Twin3dPhase;
  readonly percent: number;
  readonly message: string;
  readonly at: string;
  readonly error?: string;
}

export interface Twin3dJob {
  readonly jobId: string;
  readonly cityName: string;
  phase: Twin3dPhase;
  percent: number;
  message: string;
  events: Twin3dProgressEvent[];
  result?: Twin3dResult;
  error?: string;
  readonly startedAt: string;
  finishedAt?: string;
}

export interface Twin3dResult {
  readonly citySlug: string;
  readonly outDir: string;
  readonly scenePath: string;
  readonly manifest: TwinSceneManifest;
}

const jobs = new Map<string, Twin3dJob>();

export function getTwin3dJob(jobId: string): Twin3dJob | undefined {
  return jobs.get(jobId);
}

export function listTwin3dJobs(): Twin3dJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function twin3dRoot(): string {
  return join(findRepoRoot(), "data", "twin3d");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function emit(job: Twin3dJob, phase: Twin3dPhase, percent: number, message: string, error?: string) {
  job.phase = phase;
  job.percent = percent;
  job.message = message;
  if (error) job.error = error;
  const event: Twin3dProgressEvent = {
    jobId: job.jobId,
    cityName: job.cityName,
    phase,
    percent,
    message,
    at: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  job.events.push(event);
  return event;
}

function buildSearchIndex(
  layers: Record<string, FeatureCollection>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let roadCount = 0;
  let poiCount = 0;

  const push = (layerId: string, f: FeatureCollection["features"][number], kind: string) => {
    const p = f.properties ?? {};
    let lon: number | undefined;
    let lat: number | undefined;
    if (f.geometry?.type === "Point") {
      lon = f.geometry.coordinates[0];
      lat = f.geometry.coordinates[1];
    } else if (f.geometry?.type === "Polygon") {
      const ring = f.geometry.coordinates[0] ?? [];
      if (ring.length) {
        lon = ring.reduce((s: number, c: Position) => s + (c[0] ?? 0), 0) / ring.length;
        lat = ring.reduce((s: number, c: Position) => s + (c[1] ?? 0), 0) / ring.length;
      }
    } else if (f.geometry?.type === "LineString") {
      const mid = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
      if (mid) {
        lon = mid[0];
        lat = mid[1];
      }
    }
    if (lon == null || lat == null) return;
    const name = String(p.name ?? kind);
    // Skip anonymous auto-names like "Building 123" / "Road 456"
    if (/^(Building|Road|Water|Vegetation)\s+\d+$/i.test(name)) return;
    out.push({
      id: p.id ?? f.id,
      name,
      kind,
      layerId,
      lon,
      lat,
      searchText: String(p.searchText ?? name).toLowerCase(),
      provenance: p.provenance,
      license: p.license,
    });
  };

  // POIs first (hospitals, schools, airports, stations, neighbourhoods)
  for (const f of layers.pois?.features ?? []) {
    if (poiCount >= TWIN_PERF.maxSearchPois) break;
    push("pois", f, String(f.properties?.kind ?? "poi"));
    poiCount++;
  }

  // Named roads only — never every highway segment (Amsterdam was 87 MB search-index)
  for (const f of layers.roads?.features ?? []) {
    if (roadCount >= TWIN_PERF.maxSearchRoads) break;
    const name = String(f.properties?.name ?? "");
    if (!name || /^Road\s+\d+$/i.test(name)) continue;
    push("roads", f, "road");
    roadCount++;
  }

  // Do NOT index every building — that alone made Amsterdam search-index 87 MB.
  return out;
}

/**
 * End-to-end: city name → boundary → public datasets → terrain/meshes → scene manifest.
 * Never fabricates geometry. Missing layers are reported.
 */
export async function buildDigitalTwin(options: {
  cityName: string;
  jobId?: string;
  onProgress?: (e: Twin3dProgressEvent) => void;
}): Promise<Twin3dResult> {
  const jobId =
    options.jobId ?? `t3d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job: Twin3dJob =
    jobs.get(jobId) ??
    ({
      jobId,
      cityName: options.cityName,
      phase: "queued",
      percent: 0,
      message: "Queued",
      events: [],
      startedAt: new Date().toISOString(),
    } satisfies Twin3dJob);
  jobs.set(jobId, job);

  const notify = (phase: Twin3dPhase, percent: number, message: string, error?: string) => {
    const ev = emit(job, phase, percent, message, error);
    options.onProgress?.(ev);
  };

  try {
    const demo = resolveDemoCity(options.cityName);
    const query = demo?.query ?? options.cityName;
    const citySlug = demo?.slug ?? slugify(options.cityName);
    const maxDeg2 = demo?.maxFetchDeg2 ?? 0.08;

    const outDir = join(twin3dRoot(), citySlug);
    mkdirSync(outDir, { recursive: true });
    const layersDir = join(outDir, "layers");
    mkdirSync(layersDir, { recursive: true });

    notify("boundary", 8, `Resolving administrative boundary for "${query}"…`);
    const boundary = await resolveBoundary(query, join(outDir, "boundary"));
    writeFileSync(join(layersDir, "boundary.geojson"), readFileSync(join(outDir, "boundary", "boundary.geojson")));

    const crop = centerCropBbox(boundary.bbox, maxDeg2);
    const warnings: string[] = [...crop.cropped
      ? [
          `AOI ${crop.fullAreaDeg2.toFixed(3)} deg² exceeds Overpass-safe ${maxDeg2}; center-cropped to ${crop.fetchAreaDeg2.toFixed(3)} deg². Full-city bulk extracts (Geofabrik/Overture) recommended for complete coverage.`,
        ]
      : []];

    notify("datasets", 20, "Downloading OpenStreetMap layers (buildings, roads, water, vegetation, POIs)…");
    const osm = await fetchOsmSceneLayers(crop.fetchBbox, layersDir, boundary.centroid);
    warnings.push(...osm.warnings);

    notify("terrain", 55, "Sampling public Terrarium DEM tiles (AWS Open Data)…");
    const terrain = await buildTerrariumHeightmap(crop.fetchBbox, join(outDir, "terrain"));
    warnings.push(...terrain.warnings);

    notify("geometry", 70, "Assembling scene graph and search index…");
    const layerStatus: SceneLayerStatus[] = [
      {
        id: "boundary",
        label: "Administrative boundary",
        status: "ready",
        featureCount: 1,
        provenance: boundary.provenance,
      },
      {
        id: "buildings",
        label: "Buildings",
        status: osm.buildings.features.length ? "ready" : "missing",
        featureCount: osm.buildings.features.length,
        note: osm.buildings.features.length
          ? "Extruded from OSM footprints + height/building:levels"
          : "No building polygons returned",
        provenance: {
          sourceId: "osm",
          sourceName: "OpenStreetMap",
          license: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          sourceUrl: "https://www.openstreetmap.org/copyright",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        id: "roads",
        label: "Roads / transport",
        status: osm.roads.features.length ? "ready" : "missing",
        featureCount: osm.roads.features.length,
        provenance: {
          sourceId: "osm",
          sourceName: "OpenStreetMap",
          license: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          sourceUrl: "https://www.openstreetmap.org/copyright",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        id: "water",
        label: "Water bodies",
        status: osm.water.features.length ? "ready" : "missing",
        featureCount: osm.water.features.length,
        provenance: {
          sourceId: "osm",
          sourceName: "OpenStreetMap",
          license: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          sourceUrl: "https://www.openstreetmap.org/copyright",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        id: "vegetation",
        label: "Vegetation / parks",
        status: osm.vegetation.features.length ? "ready" : "partial",
        featureCount: osm.vegetation.features.length,
        note: "OSM parks/forest only — ESA WorldCover global land cover not wired in this pipeline",
        provenance: {
          sourceId: "osm",
          sourceName: "OpenStreetMap",
          license: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          sourceUrl: "https://www.openstreetmap.org/copyright",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        id: "pois",
        label: "Points of interest",
        status: osm.pois.features.length ? "ready" : "missing",
        featureCount: osm.pois.features.length,
        provenance: {
          sourceId: "osm",
          sourceName: "OpenStreetMap",
          license: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          sourceUrl: "https://www.openstreetmap.org/copyright",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        id: "terrain",
        label: "Elevation (DEM)",
        status: terrain.status === "ready" ? "ready" : "missing",
        featureCount: terrain.status === "ready" ? terrain.heights.length : 0,
        note: terrain.status === "ready" ? "Terrarium heightmap grid" : "Terrain unavailable — ellipsoid fallback",
        provenance: terrain.provenance,
      },
      {
        id: "imagery",
        label: "Satellite / basemap imagery",
        status: "partial",
        featureCount: 0,
        note: "Streamed at runtime via Cesium OSM / Ion imagery — not packaged as raster tiles",
        provenance: {
          sourceId: "cesium-imagery",
          sourceName: "Cesium / OpenStreetMap raster",
          license: "varies",
          attribution: "© OpenStreetMap / Cesium",
          sourceUrl: "https://cesium.com/",
          fetchedAt: new Date().toISOString(),
        },
      },
    ];

    const missing = [
      ...osm.missing,
      ...(terrain.status !== "ready" ? ["terrain"] : []),
      "esa-worldcover",
      "sentinel-mosaic",
      ...(crop.cropped ? ["full-city-osm-extent"] : []),
    ];

    const searchIndex = buildSearchIndex({
      buildings: osm.buildings,
      roads: osm.roads,
      pois: osm.pois,
    });
    const searchIndexPath = join(outDir, "search-index.json");
    writeFileSync(searchIndexPath, JSON.stringify(searchIndex));

    const spanLon = crop.fetchBbox.maxLon - crop.fetchBbox.minLon;
    const spanLat = crop.fetchBbox.maxLat - crop.fetchBbox.minLat;
    // Camera height from fetch extent (not inflated admin bbox) — Monaco was ~47 km high.
    const cameraHeight = Math.max(600, Math.max(spanLon, spanLat) * 111_000 * 1.15);

    notify("scene", 90, "Writing scene manifest…");
    const manifest: TwinSceneManifest = {
      format: "polaris.twin3d.scene/1",
      citySlug,
      cityDisplayName: demo?.displayName ?? boundary.displayName,
      query,
      builtAt: new Date().toISOString(),
      bbox: boundary.bbox,
      fetchBbox: crop.fetchBbox,
      camera: {
        lon: boundary.centroid.lon,
        lat: boundary.centroid.lat,
        height: cameraHeight,
        heading: 20,
        pitch: -45,
      },
      layers: layerStatus,
      missing,
      warnings,
      searchIndexPath: "search-index.json",
      terrain: {
        status: terrain.status,
        provider: terrain.status === "ready" ? "terrarium-heightmap" : "none",
        path: terrain.status === "ready" ? "terrain/heightmap.json" : undefined,
        note: terrain.warnings[0],
      },
    };

    const scenePath = join(outDir, "scene.json");
    writeFileSync(scenePath, JSON.stringify(manifest, null, 2));
    writeFileSync(
      join(outDir, "scene-graph.json"),
      JSON.stringify(
        {
          root: citySlug,
          children: layerStatus.map((l) => ({
            id: l.id,
            type: "layer",
            status: l.status,
            featureCount: l.featureCount,
            uri: l.id === "terrain" ? manifest.terrain.path : `layers/${l.id}.geojson`,
          })),
        },
        null,
        2,
      ),
    );

    const result: Twin3dResult = { citySlug, outDir, scenePath, manifest };
    job.result = result;
    job.finishedAt = new Date().toISOString();
    notify(
      "complete",
      100,
      `Digital Twin ready: ${manifest.cityDisplayName} (${osm.buildings.features.length} buildings, ${osm.roads.features.length} roads)`,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.finishedAt = new Date().toISOString();
    notify("failed", job.percent, "Twin build failed", message);
    throw err;
  }
}

export function buildDigitalTwinAsync(options: { cityName: string }): string {
  const jobId = `t3d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job: Twin3dJob = {
    jobId,
    cityName: options.cityName,
    phase: "queued",
    percent: 0,
    message: "Queued",
    events: [],
    startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  void buildDigitalTwin({ ...options, jobId }).catch(() => undefined);
  return jobId;
}

export function listCompiledTwinCities(): Array<{
  citySlug: string;
  cityDisplayName: string;
  builtAt: string;
  layersReady: number;
}> {
  const root = twin3dRoot();
  if (!existsSync(root)) return [];
  const out: Array<{ citySlug: string; cityDisplayName: string; builtAt: string; layersReady: number }> = [];
  for (const name of readdirSync(root)) {
    const scenePath = join(root, name, "scene.json");
    if (!existsSync(scenePath)) continue;
    try {
      const m = JSON.parse(readFileSync(scenePath, "utf8")) as TwinSceneManifest;
      out.push({
        citySlug: m.citySlug,
        cityDisplayName: m.cityDisplayName,
        builtAt: m.builtAt,
        layersReady: m.layers.filter((l) => l.status === "ready").length,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function readTwinScene(citySlug: string): TwinSceneManifest | undefined {
  const scenePath = join(twin3dRoot(), citySlug, "scene.json");
  if (!existsSync(scenePath)) return undefined;
  return JSON.parse(readFileSync(scenePath, "utf8")) as TwinSceneManifest;
}

export function twin3dCityDir(citySlug: string): string {
  return join(twin3dRoot(), citySlug);
}

export { DEMO_CITIES, resolveDemoCity };
