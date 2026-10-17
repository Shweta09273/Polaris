/**
 * Semantic POI visual markers.
 * Positions come from OSM; this module only supplies icons / LOD graphics.
 */

import type { Entity } from "cesium";
import { POI_BILLBOARD_MAX_M, POI_LABEL_MAX_M, POI_MARKER_3D_MAX_M, POI_POINT_MAX_M } from "./lod";

export type PoiKind =
  | "hospital"
  | "school"
  | "university"
  | "airport"
  | "railway_station"
  | "police"
  | "fire_station"
  | "hotel"
  | "neighbourhood"
  | "poi";

interface PoiStyle {
  fill: string;
  glyph: string;
  label: string;
}

const POI_STYLES: Record<string, PoiStyle> = {
  hospital: { fill: "#c45c5c", glyph: "H", label: "Hospital" },
  school: { fill: "#3d7ab5", glyph: "S", label: "School" },
  university: { fill: "#2f6f8f", glyph: "U", label: "University" },
  airport: { fill: "#6b5ce7", glyph: "A", label: "Airport" },
  railway_station: { fill: "#d4893a", glyph: "R", label: "Station" },
  police: { fill: "#2c4a6e", glyph: "P", label: "Police" },
  fire_station: { fill: "#c45c32", glyph: "F", label: "Fire" },
  hotel: { fill: "#8a6bb5", glyph: "+", label: "Hotel" },
  neighbourhood: { fill: "#c4a35a", glyph: "•", label: "Neighbourhood" },
  poi: { fill: "#c4a35a", glyph: "•", label: "POI" },
};

const iconCache = new Map<string, HTMLCanvasElement>();

function poiCanvas(kind: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const hit = iconCache.get(kind);
  if (hit) return hit;
  const style = POI_STYLES[kind] ?? POI_STYLES.poi!;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 64, 64);
  ctx.beginPath();
  ctx.arc(32, 28, 20, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(10,12,16,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(32, 48);
  ctx.lineTo(22, 36);
  ctx.lineTo(42, 36);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 18px IBM Plex Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.glyph, 32, 27);
  iconCache.set(kind, c);
  return c;
}

export function normalizePoiKind(raw: string): PoiKind {
  if (raw in POI_STYLES) return raw as PoiKind;
  return "poi";
}

export function poiStyle(kind: string): PoiStyle {
  return POI_STYLES[kind] ?? POI_STYLES.poi!;
}

export function applyPoiVisual(
  Cesium: typeof import("cesium"),
  entity: Entity,
  kindRaw: string,
  labelText: string,
) {
  const kind = normalizePoiKind(kindRaw);
  const style = poiStyle(kind);
  const color = Cesium.Color.fromCssColorString(style.fill);
  const icon = poiCanvas(kind);

  entity.point = new Cesium.PointGraphics({
    pixelSize: 8,
    color,
    outlineColor: Cesium.Color.fromCssColorString("#0b0e14"),
    outlineWidth: 1,
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    scaleByDistance: new Cesium.NearFarScalar(400, 1.15, 20_000, 0.35),
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(POI_BILLBOARD_MAX_M, POI_POINT_MAX_M),
  });

  if (icon) {
    entity.billboard = new Cesium.BillboardGraphics({
      image: icon,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(200, 1.0, POI_BILLBOARD_MAX_M, 0.35),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, POI_BILLBOARD_MAX_M),
    });
  } else {
    entity.billboard = undefined;
  }

  entity.label = new Cesium.LabelGraphics({
    text: labelText,
    font: "600 12px IBM Plex Sans, sans-serif",
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString("#0b0e14").withAlpha(0.72),
    pixelOffset: new Cesium.Cartesian2(0, -36),
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, POI_LABEL_MAX_M),
    scaleByDistance: new Cesium.NearFarScalar(150, 1.0, POI_LABEL_MAX_M, 0.4),
  });

  const semantic = kind !== "poi" && kind !== "neighbourhood";
  if (semantic) {
    entity.ellipse = new Cesium.EllipseGraphics({
      semiMajorAxis: 4.5,
      semiMinorAxis: 4.5,
      height: 0,
      extrudedHeight: 12,
      material: new Cesium.ColorMaterialProperty(color),
      outline: false,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, POI_MARKER_3D_MAX_M),
      shadows: new Cesium.ConstantProperty(Cesium.ShadowMode.DISABLED),
    });
  }
}
