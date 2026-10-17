/**
 * Re-apply performance budgets to an already-compiled twin without re-fetching Overpass.
 * Used to recover Amsterdam/Singapore artifacts that OOM the browser.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeatureCollection } from "geojson";
import { TWIN_PERF, budgetFeatures } from "./perf-budget.js";
import { twin3dCityDir, readTwinScene } from "./pipeline.js";
import type { TwinSceneManifest } from "./types.js";

function loadFc(path: string): FeatureCollection {
  if (!existsSync(path)) return { type: "FeatureCollection", features: [] };
  return JSON.parse(readFileSync(path, "utf8")) as FeatureCollection;
}

export function rebudgetTwinCity(citySlug: string): TwinSceneManifest {
  const dir = twin3dCityDir(citySlug);
  const scene = readTwinScene(citySlug);
  if (!scene) throw new Error(`No scene for ${citySlug}`);

  const center = { lon: scene.camera.lon, lat: scene.camera.lat };
  const layersDir = join(dir, "layers");
  const warnings = [...scene.warnings];

  const apply = (name: string, max: number) => {
    const path = join(layersDir, `${name}.geojson`);
    const fc = loadFc(path);
    const { kept, truncated } = budgetFeatures(fc.features, max, center);
    writeFileSync(path, JSON.stringify({ type: "FeatureCollection", features: kept }));
    if (truncated) {
      warnings.push(
        `Rebudget ${name}: kept ${kept.length}, truncated ${truncated} (cap ${max}).`,
      );
    }
    return kept.length;
  };

  const counts = {
    buildings: apply("buildings", TWIN_PERF.maxBuildings),
    roads: apply("roads", TWIN_PERF.maxRoads),
    water: apply("water", TWIN_PERF.maxWater),
    vegetation: apply("vegetation", TWIN_PERF.maxVegetation),
    pois: apply("pois", TWIN_PERF.maxPois),
  };

  // Slim search index: POIs + named roads only
  const pois = loadFc(join(layersDir, "pois.geojson"));
  const roads = loadFc(join(layersDir, "roads.geojson"));
  const search: Array<Record<string, unknown>> = [];
  for (const f of pois.features.slice(0, TWIN_PERF.maxSearchPois)) {
    const p = f.properties ?? {};
    if (f.geometry?.type !== "Point") continue;
    search.push({
      id: p.id ?? f.id,
      name: p.name,
      kind: p.kind,
      layerId: "pois",
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      searchText: String(p.searchText ?? p.name ?? "").toLowerCase(),
      provenance: p.provenance,
      license: p.license,
    });
  }
  let roadsIndexed = 0;
  for (const f of roads.features) {
    if (roadsIndexed >= TWIN_PERF.maxSearchRoads) break;
    const p = f.properties ?? {};
    const name = String(p.name ?? "");
    if (!name || /^Road\s+\d+$/i.test(name)) continue;
    if (f.geometry?.type !== "LineString") continue;
    const mid = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
    if (!mid) continue;
    search.push({
      id: p.id ?? f.id,
      name,
      kind: "road",
      layerId: "roads",
      lon: mid[0],
      lat: mid[1],
      searchText: String(p.searchText ?? name).toLowerCase(),
      provenance: p.provenance,
      license: p.license,
    });
    roadsIndexed++;
  }
  writeFileSync(join(dir, "search-index.json"), JSON.stringify(search));

  const layers = scene.layers.map((l) => {
    if (l.id in counts) {
      const n = counts[l.id as keyof typeof counts];
      return {
        ...l,
        featureCount: n,
        status: n > 0 ? ("ready" as const) : ("missing" as const),
        note: l.note,
      };
    }
    return l;
  });

  const next: TwinSceneManifest = {
    ...scene,
    layers,
    warnings: [...new Set(warnings)],
    builtAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, "scene.json"), JSON.stringify(next, null, 2));
  writeFileSync(
    join(layersDir, "osm-raw-meta.json"),
    JSON.stringify({ rebudgetAt: next.builtAt, countsBudgeted: counts, perfBudget: TWIN_PERF }, null, 2),
  );
  return next;
}
