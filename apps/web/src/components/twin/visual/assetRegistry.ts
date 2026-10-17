/**
 * Reusable visual asset registry.
 *
 * Procedural canvases are generated in materials.ts / poiMarkers.ts.
 * Optional GLB slots exist for a small landmark set — none are bundled
 * (licensing: procedural-only unless an approved open-license asset is registered).
 *
 * Future ADD_BUILDING operations should call resolveLandmarkAsset(kind)
 * rather than inventing geography.
 */

import type { BuildingArchetype } from "./archetypes";

export interface VisualAssetRecord {
  id: string;
  kind: "facade" | "poi-icon" | "landmark-glb";
  archetype?: BuildingArchetype;
  license: "procedural" | "ODbL-1.0" | "CC0" | "other";
  source: string;
  glbUrl?: string;
}

const LANDMARK_GLB = new Map<string, VisualAssetRecord>();

export function resolveLandmarkAsset(entityId: string): VisualAssetRecord | undefined {
  return LANDMARK_GLB.get(entityId);
}

export function registerLandmarkAsset(record: VisualAssetRecord): void {
  if (record.kind !== "landmark-glb" || !record.glbUrl) return;
  LANDMARK_GLB.set(record.id, record);
}

export const PROCEDURAL_LIBRARY_NOTE =
  "POLARIS visual library: procedural canvases, reused by archetype+variant. No copyrighted photographs.";
