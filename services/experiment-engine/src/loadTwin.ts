import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Feature, FeatureCollection } from "geojson";
import { twin3dCityDir, readTwinScene } from "@polaris/twin-geometry";
import type { TwinFeatureIndex } from "./types.js";

function readLayer(dir: string, id: string): Feature[] {
  const path = join(dir, "layers", `${id}.geojson`);
  if (!existsSync(path)) return [];
  try {
    const fc = JSON.parse(readFileSync(path, "utf8")) as FeatureCollection;
    return fc.features ?? [];
  } catch {
    return [];
  }
}

function readHeightmap(dir: string, terrainPath?: string): TwinFeatureIndex["heightmap"] {
  if (!terrainPath) return null;
  const path = join(dir, terrainPath);
  if (!existsSync(path)) return null;
  try {
    const hm = JSON.parse(readFileSync(path, "utf8")) as TwinFeatureIndex["heightmap"];
    if (!hm?.heights?.length) return null;
    return hm;
  } catch {
    return null;
  }
}

export function loadTwinFeatures(citySlug: string): TwinFeatureIndex {
  const scene = readTwinScene(citySlug);
  if (!scene) {
    throw new Error(`Twin scene not found for city '${citySlug}'. Open/compile the Digital Twin first.`);
  }
  const dir = twin3dCityDir(citySlug);
  return {
    scene: {
      citySlug: scene.citySlug,
      cityDisplayName: scene.cityDisplayName,
      camera: scene.camera,
      layers: scene.layers.map((l) => ({
        id: l.id,
        status: l.status,
        featureCount: l.featureCount,
        ...(l.note ? { note: l.note } : {}),
      })),
      missing: scene.missing ?? [],
    },
    buildings: readLayer(dir, "buildings"),
    roads: readLayer(dir, "roads"),
    pois: readLayer(dir, "pois"),
    vegetation: readLayer(dir, "vegetation"),
    water: readLayer(dir, "water"),
    heightmap: readHeightmap(dir, scene.terrain?.path),
  };
}
