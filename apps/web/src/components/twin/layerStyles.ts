import type { Entity, Color } from "cesium";
import {
  classifyBuildingVisual,
  type HeightSource,
} from "./visual/archetypes";
import { getBuildingMaterial, getSelectionOutlineColor } from "./visual/materials";
import { applyPoiVisual } from "./visual/poiMarkers";
import { ROAD_LABEL_MAX_M } from "./visual/lod";

/** Documented fallback when OSM height / building:levels absent. */
export const BUILDING_HEIGHT_FALLBACK_M = 10;
export const BUILDING_HEIGHT_FALLBACK_NOTE =
  "Height fallback 10 m — OSM height and building:levels absent (documented default).";
export const BUILDING_ROOF_FALLBACK_M = 3;
export const BUILDING_ROOF_FALLBACK_NOTE =
  "Height fallback 3 m — OSM building=roof with no height/levels (documented default).";

function readProp(entity: Entity, key: string): unknown {
  try {
    return entity.properties?.[key]?.getValue?.();
  } catch {
    return undefined;
  }
}

function stash(entity: Entity, key: string, value: unknown) {
  if (!entity.properties) return;
  try {
    if (entity.properties.hasProperty?.(key)) {
      entity.properties[key] = value as never;
      return;
    }
    entity.properties.addProperty(key, value);
  } catch {
    try {
      entity.properties[key] = value as never;
    } catch {
      /* */
    }
  }
}

export function resolveBuildingHeight(entity: Entity): {
  height: number;
  fromOsm: boolean;
  source: HeightSource;
  note?: string;
  crossCheck?: string;
} {
  const declaredSource = String(readProp(entity, "heightSource") ?? "") as HeightSource | "";
  const levelsRaw = readProp(entity, "levels");
  const levels = Number(levelsRaw);
  const hasLevels = levelsRaw != null && levelsRaw !== "" && Number.isFinite(levels) && levels > 0;
  const h = Number(readProp(entity, "height"));
  const hasHeight = Number.isFinite(h) && h > 1 && h < 800;
  const building = String(readProp(entity, "building") ?? "");
  const estimatedFallback = building === "roof" ? BUILDING_ROOF_FALLBACK_M : BUILDING_HEIGHT_FALLBACK_M;
  const estimatedNote = building === "roof" ? BUILDING_ROOF_FALLBACK_NOTE : BUILDING_HEIGHT_FALLBACK_NOTE;

  if (declaredSource === "estimated") {
    return { height: hasHeight ? h : estimatedFallback, fromOsm: false, source: "estimated", note: estimatedNote };
  }

  if (hasHeight && hasLevels) {
    const fromLevels = Math.min(levels * 3.2, 400);
    const disagree = Math.abs(h - fromLevels) / Math.max(h, fromLevels) > 0.5;
    return {
      height: Math.min(h, 800),
      fromOsm: true,
      source: "osm-height",
      crossCheck: disagree
        ? `OSM height ${h.toFixed(1)} m vs levels×3.2=${fromLevels.toFixed(1)} m — using tagged height`
        : `OSM height ${h.toFixed(1)} m consistent with ${levels} levels`,
    };
  }

  if (declaredSource === "osm-height" && hasHeight) {
    return { height: Math.min(h, 800), fromOsm: true, source: "osm-height" };
  }
  if (declaredSource === "osm-levels" && hasLevels) {
    return { height: Math.min(levels * 3.2, 400), fromOsm: true, source: "osm-levels" };
  }
  if (hasLevels) {
    return { height: Math.min(levels * 3.2, 400), fromOsm: true, source: "osm-levels" };
  }
  if (hasHeight) {
    if (h === 10 && !hasLevels) {
      return { height: estimatedFallback, fromOsm: false, source: "estimated", note: estimatedNote };
    }
    return { height: h, fromOsm: true, source: "osm-height" };
  }
  return { height: estimatedFallback, fromOsm: false, source: "estimated", note: estimatedNote };
}

export function styleBuildingEntity(
  Cesium: typeof import("cesium"),
  entity: Entity,
  opts: { useOutlines: boolean; groundHeight: number },
) {
  if (!entity.polygon) return;
  const resolved = resolveBuildingHeight(entity);
  const ground = Math.max(0, opts.groundHeight);
  const visual = classifyBuildingVisual({
    id: String(entity.id),
    name: entity.name ?? String(readProp(entity, "name") ?? ""),
    building: String(readProp(entity, "building") ?? ""),
    amenity: String(readProp(entity, "amenity") ?? ""),
    tourism: String(readProp(entity, "tourism") ?? ""),
    office: String(readProp(entity, "office") ?? ""),
    heightM: resolved.height,
    levels: Number(readProp(entity, "levels")) || null,
    heightSource: resolved.source,
  });

  entity.polygon.height = new Cesium.ConstantProperty(ground);
  entity.polygon.extrudedHeight = new Cesium.ConstantProperty(ground + resolved.height);
  entity.polygon.closeTop = new Cesium.ConstantProperty(true);
  entity.polygon.closeBottom = new Cesium.ConstantProperty(true);
  entity.polygon.shadows = new Cesium.ConstantProperty(Cesium.ShadowMode.DISABLED);
  entity.polygon.outline = new Cesium.ConstantProperty(opts.useOutlines);
  entity.polygon.outlineColor = new Cesium.ConstantProperty(
    Cesium.Color.fromCssColorString("#2a2622").withAlpha(0.35),
  );
  try {
    entity.polygon.material = getBuildingMaterial(Cesium, visual);
  } catch {
    entity.polygon.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString("#E4DDD2"),
    );
  }

  stash(entity, "heightResolved", resolved.height);
  stash(entity, "heightFromOsm", resolved.fromOsm);
  stash(entity, "heightSource", resolved.source);
  stash(entity, "visualArchetype", visual.archetype);
  stash(entity, "visualVariant", visual.variant);
  stash(entity, "visualMaterial", visual.materialId);
  stash(entity, "visualConfidence", visual.confidence);
  stash(entity, "visualClassification", visual.confidenceNote);
  if (resolved.note) stash(entity, "heightNote", resolved.note);
  if (resolved.crossCheck) stash(entity, "heightCrossCheck", resolved.crossCheck);
  if (!resolved.fromOsm) stash(entity, "heightNote", resolved.note ?? BUILDING_HEIGHT_FALLBACK_NOTE);
}

export function styleRoadEntity(Cesium: typeof import("cesium"), entity: Entity) {
  if (!entity.polyline) return;
  const highway = String(readProp(entity, "highway") ?? "");
  let width = 2.2;
  let color = Cesium.Color.fromCssColorString("#f2efe8");
  if (highway === "motorway" || highway === "trunk") {
    width = 5;
    color = Cesium.Color.fromCssColorString("#e6d08a");
  } else if (highway === "primary" || highway === "secondary") {
    width = 3.5;
    color = Cesium.Color.fromCssColorString("#f7f4ee");
  } else if (highway === "residential" || highway === "tertiary") {
    width = 2.4;
  } else if (highway === "footway" || highway === "path") {
    width = 1.2;
    color = Cesium.Color.fromCssColorString("#d4cfc4");
  }
  entity.polyline.width = new Cesium.ConstantProperty(width);
  entity.polyline.material = new Cesium.ColorMaterialProperty(color);
  entity.polyline.clampToGround = new Cesium.ConstantProperty(true);
  entity.polyline.shadows = new Cesium.ConstantProperty(Cesium.ShadowMode.DISABLED);

  const name = entity.name ?? String(readProp(entity, "name") ?? "");
  if (name && !/^Road\s+\d+$/i.test(name)) {
    entity.label = new Cesium.LabelGraphics({
      text: name,
      font: "600 11px IBM Plex Sans, sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -6),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, ROAD_LABEL_MAX_M),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(200, 1.0, ROAD_LABEL_MAX_M, 0.35),
    });
  }
}

export function styleWaterEntity(Cesium: typeof import("cesium"), entity: Entity) {
  if (entity.polygon) {
    entity.polygon.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString("#3a8fad"),
    );
    entity.polygon.outline = new Cesium.ConstantProperty(false);
    entity.polygon.height = undefined;
    entity.polygon.extrudedHeight = undefined;
    entity.polygon.classificationType = new Cesium.ConstantProperty(Cesium.ClassificationType.BOTH);
  }
  if (entity.polyline) {
    entity.polyline.width = new Cesium.ConstantProperty(2.5);
    entity.polyline.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString("#4aa3bd"),
    );
    entity.polyline.clampToGround = new Cesium.ConstantProperty(true);
  }
}

export function styleVegetationEntity(Cesium: typeof import("cesium"), entity: Entity) {
  if (!entity.polygon) return;
  entity.polygon.material = new Cesium.ColorMaterialProperty(
    Cesium.Color.fromCssColorString("#4a8a58"),
  );
  entity.polygon.outline = new Cesium.ConstantProperty(false);
}

export function styleBoundaryEntity(Cesium: typeof import("cesium"), entity: Entity) {
  if (!entity.polygon) return;
  entity.polygon.material = new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT);
  entity.polygon.outline = new Cesium.ConstantProperty(true);
  entity.polygon.outlineColor = new Cesium.ConstantProperty(
    Cesium.Color.fromCssColorString("#3de1ff").withAlpha(0.85),
  );
}

export function stylePoiEntity(Cesium: typeof import("cesium"), entity: Entity) {
  const kind = String(readProp(entity, "kind") ?? "poi");
  const label = entity.name ?? String(readProp(entity, "name") ?? kind);
  applyPoiVisual(Cesium, entity, kind, label);
  stash(entity, "visualArchetype", kind);
  stash(entity, "visualClassification", `OSM POI kind=${kind}`);
  stash(entity, "visualConfidence", kind === "poi" ? "medium" : "high");
}

export function applySelectionHighlight(Cesium: typeof import("cesium"), entity: Entity | undefined) {
  if (!entity?.polygon) return;
  entity.polygon.outline = new Cesium.ConstantProperty(true);
  entity.polygon.outlineColor = new Cesium.ConstantProperty(getSelectionOutlineColor(Cesium));
}

export type { Color };
