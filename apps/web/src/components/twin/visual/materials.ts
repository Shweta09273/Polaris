/**
 * Procedural façade library — finite canvases, reused by archetype+variant.
 * Opaque (alpha=false) so Cesium does not sort extrusions as translucent (dark walls).
 * No custom GLSL. Uses Cesium ImageMaterialProperty / ColorMaterialProperty only.
 */

import type { ImageMaterialProperty, ColorMaterialProperty } from "cesium";
import type { BuildingVisual, VisualMaterialId } from "./archetypes";

interface Palette {
  wall: string;
  wallAlt: string;
  glass: string;
  frame: string;
  cornice: string;
  ground: string;
  accent?: string;
}

const PALETTES: Record<VisualMaterialId, Palette[]> = {
  CONCRETE: [
    { wall: "#E4DDD2", wallAlt: "#D8D0C4", glass: "#3D4A55", frame: "#C9C1B5", cornice: "#D0C8BC", ground: "#C4B8A8" },
    { wall: "#E8E2D8", wallAlt: "#DAD3C8", glass: "#42505C", frame: "#C4BDB2", cornice: "#D4CDC2", ground: "#B7AFA3" },
    { wall: "#DED7CC", wallAlt: "#D2CBBF", glass: "#38444E", frame: "#B8B1A6", cornice: "#C8C0B4", ground: "#AFA597" },
    { wall: "#E6DFD4", wallAlt: "#D5CEC3", glass: "#41515F", frame: "#C6BFB4", cornice: "#D2CABE", ground: "#C0B6A8" },
  ],
  STONE: [
    { wall: "#E9DFD0", wallAlt: "#DDD2C2", glass: "#3A4550", frame: "#CDBFAE", cornice: "#D8CCBB", ground: "#C4B6A4" },
    { wall: "#E4D6C4", wallAlt: "#D8CABC", glass: "#343F48", frame: "#C4B6A4", cornice: "#D2C4B2", ground: "#B8A892" },
    { wall: "#EDE4D6", wallAlt: "#E0D6C8", glass: "#3E4A54", frame: "#D0C4B4", cornice: "#E0D4C4", ground: "#C8BCAA" },
    { wall: "#E2D4C2", wallAlt: "#D6C8B6", glass: "#39454F", frame: "#C0B2A0", cornice: "#D4C6B4", ground: "#B4A690" },
  ],
  BRICK: [
    { wall: "#C9A690", wallAlt: "#BE9C86", glass: "#2E3A44", frame: "#B08E78", cornice: "#D4B49C", ground: "#A88870" },
    { wall: "#D2B09A", wallAlt: "#C4A28C", glass: "#33404A", frame: "#B89880", cornice: "#DCBAA4", ground: "#B09078" },
    { wall: "#C4A088", wallAlt: "#B89480", glass: "#2A3640", frame: "#A88870", cornice: "#C8A890", ground: "#9C7C64" },
    { wall: "#C8A894", wallAlt: "#BC9C88", glass: "#313C46", frame: "#B0907C", cornice: "#D0B09C", ground: "#A88874" },
  ],
  PAINTED: [
    { wall: "#E8E0D4", wallAlt: "#DCD4C8", glass: "#3C4C5C", frame: "#D0C8BC", cornice: "#F0E8DC", ground: "#C8C0B4" },
    { wall: "#E4E8E0", wallAlt: "#D6DAD2", glass: "#3A4A52", frame: "#C8CCC4", cornice: "#EEF0E8", ground: "#C0C4BC" },
    { wall: "#EDE4DC", wallAlt: "#E0D6CE", glass: "#414E58", frame: "#D4C8C0", cornice: "#F4EBE4", ground: "#C8BCB4" },
    { wall: "#E0D8E4", wallAlt: "#D4CCD8", glass: "#3A4450", frame: "#C8C0CC", cornice: "#ECE4F0", ground: "#BCB4C0" },
  ],
  GLASS: [
    { wall: "#C5D4DC", wallAlt: "#B8C8D0", glass: "#5A7384", frame: "#A8B8C0", cornice: "#D4E0E6", ground: "#98A8B0" },
    { wall: "#C8D8E0", wallAlt: "#B4C8D0", glass: "#4E6A7A", frame: "#A4B4BC", cornice: "#D8E4EA", ground: "#98A8B0" },
    { wall: "#B8CCD6", wallAlt: "#A8BCC6", glass: "#486272", frame: "#98A8B0", cornice: "#C8D8E0", ground: "#8A9AA2" },
    { wall: "#D0DCE2", wallAlt: "#C0D0D8", glass: "#547080", frame: "#B0C0C8", cornice: "#E0E8EC", ground: "#A0B0B8" },
  ],
  MODERN_GLASS: [
    { wall: "#B9CDD6", wallAlt: "#A8BFC8", glass: "#4A6574", frame: "#9BB0BA", cornice: "#D0DEE4", ground: "#8FA3AC" },
    { wall: "#C2D4DC", wallAlt: "#B0C6CE", glass: "#425E6C", frame: "#A2B6BE", cornice: "#D8E4EA", ground: "#96A8B0" },
    { wall: "#AEC4CE", wallAlt: "#9CB4BE", glass: "#3E5866", frame: "#92A6B0", cornice: "#C4D4DC", ground: "#8498A0" },
    { wall: "#C8D8E0", wallAlt: "#B6CCD4", glass: "#506878", frame: "#A8BCC4", cornice: "#DCE8EE", ground: "#9AAEB6" },
  ],
  METAL: [
    { wall: "#C8CCD0", wallAlt: "#B8BCC0", glass: "#3A444C", frame: "#A8ACB0", cornice: "#D4D8DC", ground: "#9AA0A6" },
    { wall: "#D0D2D4", wallAlt: "#C0C2C4", glass: "#404850", frame: "#B0B2B4", cornice: "#DCDEE0", ground: "#A4A8AC" },
    { wall: "#BEC2C6", wallAlt: "#B0B4B8", glass: "#343C44", frame: "#9CA0A4", cornice: "#C8CCD0", ground: "#8E949A" },
    { wall: "#D4D6D8", wallAlt: "#C4C6C8", glass: "#3E464E", frame: "#B4B6B8", cornice: "#E0E2E4", ground: "#A8ACB0" },
  ],
  INDUSTRIAL: [
    { wall: "#C4BDB4", wallAlt: "#B8B0A8", glass: "#3A4038", frame: "#A8A098", cornice: "#D0C8C0", ground: "#9A9288" },
    { wall: "#CCC4BA", wallAlt: "#C0B8AE", glass: "#40463E", frame: "#B0A89E", cornice: "#D8D0C6", ground: "#A49C92" },
    { wall: "#BAB2A8", wallAlt: "#AEA69C", glass: "#363C34", frame: "#9E968C", cornice: "#C6BEB4", ground: "#8E867C" },
    { wall: "#D0C8BE", wallAlt: "#C4BCB2", glass: "#3E443C", frame: "#B4ACA2", cornice: "#DCD4CA", ground: "#A8A094" },
  ],
  ROOFTOP: [
    { wall: "#A89080", wallAlt: "#9C8474", glass: "#3A3430", frame: "#8C7464", cornice: "#B49C8C", ground: "#7C6454" },
    { wall: "#9A9A96", wallAlt: "#8E8E8A", glass: "#3A3A38", frame: "#7E7E7A", cornice: "#A8A8A4", ground: "#6E6E6A" },
    { wall: "#B09880", wallAlt: "#A48C74", glass: "#3C342C", frame: "#907860", cornice: "#C0A890", ground: "#806848" },
    { wall: "#8A8E92", wallAlt: "#7E8286", glass: "#32363A", frame: "#6E7276", cornice: "#9AA0A4", ground: "#5E6468" },
  ],
};

function paletteFor(materialId: VisualMaterialId, variant: number): Palette {
  const set = PALETTES[materialId] ?? PALETTES.CONCRETE;
  return set[variant % set.length] ?? set[0]!;
}

const canvasCache = new Map<string, HTMLCanvasElement>();
const materialCache = new Map<string, ImageMaterialProperty | ColorMaterialProperty>();
const colorFallbackCache = new Map<string, ColorMaterialProperty>();

function facadeKey(v: BuildingVisual): string {
  const floorBucket = v.floors <= 2 ? 2 : v.floors <= 5 ? 5 : v.floors <= 10 ? 10 : v.floors <= 18 ? 18 : 24;
  return `${v.archetype}:${v.variant}:${v.materialId}:${floorBucket}`;
}

function paintFacade(canvas: HTMLCanvasElement, visual: BuildingVisual): void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const pal = paletteFor(visual.materialId, visual.variant);
  const floors = visual.floors <= 2 ? 2 : visual.floors <= 5 ? 4 : 5;
  const cols = visual.archetype === "OFFICE_TOWER" || visual.archetype === "COMMERCIAL_HIGH" ? 6 : visual.archetype === "WAREHOUSE" || visual.archetype === "INDUSTRIAL" ? 3 : 4;

  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, 0, w, h);

  // Subtle panel variation (not a photograph)
  ctx.fillStyle = pal.wallAlt;
  for (let i = 0; i < cols; i++) {
    if ((i + visual.variant) % 3 === 0) {
      ctx.fillRect(Math.floor((i * w) / cols), 0, Math.ceil(w / cols), h);
    }
  }

  const corniceH = Math.max(5, Math.round(h * 0.07));
  ctx.fillStyle = pal.cornice;
  ctx.fillRect(0, 0, w, corniceH);

  const groundH = Math.max(10, Math.round(h * 0.16));
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, h - groundH, w, groundH);

  if (visual.archetype === "HOSPITAL") {
    ctx.fillStyle = "#C45C5C";
    ctx.fillRect(0, 0, 8, h);
    const cx = w / 2;
    const cy = corniceH + 10;
    ctx.fillRect(cx - 8, cy - 3, 16, 6);
    ctx.fillRect(cx - 3, cy - 8, 6, 16);
  } else if (visual.archetype === "SCHOOL" || visual.archetype === "UNIVERSITY") {
    ctx.fillStyle = "#3D6B9A";
    ctx.fillRect(0, 0, w, 4);
  } else if (visual.archetype === "FIRE_STATION") {
    ctx.fillStyle = "#C45C32";
    ctx.fillRect(0, h - groundH, w, 5);
  } else if (visual.archetype === "POLICE") {
    ctx.fillStyle = "#2C4A6E";
    ctx.fillRect(0, 0, w, 5);
  } else if (visual.archetype === "HOTEL") {
    ctx.fillStyle = pal.cornice;
    ctx.fillRect(2, corniceH + 2, w - 4, 3);
  } else if (visual.archetype === "RELIGIOUS" || visual.archetype === "LANDMARK") {
    ctx.fillStyle = pal.cornice;
    ctx.fillRect(0, 0, w, corniceH + 4);
  }

  const usableTop = corniceH + 4;
  const usableBot = h - groundH - 4;
  const usableH = Math.max(8, usableBot - usableTop);
  const cellH = usableH / floors;
  const cellW = w / cols;
  const glassW = cellW * (visual.archetype === "INDUSTRIAL" || visual.archetype === "WAREHOUSE" ? 0.42 : 0.58);
  const glassH = cellH * (visual.archetype === "OFFICE_TOWER" ? 0.62 : 0.48);

  for (let r = 0; r < floors; r++) {
    for (let c = 0; c < cols; c++) {
      if (visual.archetype === "WAREHOUSE" && (c + r + visual.variant) % 2 === 0) continue;
      const x = c * cellW + (cellW - glassW) / 2;
      const y = usableTop + r * cellH + (cellH - glassH) / 2;
      ctx.fillStyle = pal.frame;
      ctx.fillRect(x - 1, y - 1, glassW + 2, glassH + 2);
      ctx.fillStyle = pal.glass;
      ctx.fillRect(x, y, glassW, glassH);
      if (visual.archetype === "HOTEL" && r < floors - 1) {
        ctx.fillStyle = pal.wallAlt;
        ctx.fillRect(x - 2, y + glassH, glassW + 4, 2);
      }
    }
  }
}

function getFacadeCanvas(visual: BuildingVisual): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = facadeKey(visual);
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 160;
  paintFacade(canvas, visual);
  canvasCache.set(key, canvas);
  return canvas;
}

export function getBuildingMaterial(
  Cesium: typeof import("cesium"),
  visual: BuildingVisual,
): ImageMaterialProperty | ColorMaterialProperty {
  const key = facadeKey(visual);
  const cached = materialCache.get(key);
  if (cached) return cached;

  const canvas = getFacadeCanvas(visual);
  if (canvas) {
    const floorBucket = visual.floors <= 2 ? 2 : visual.floors <= 5 ? 5 : visual.floors <= 10 ? 10 : visual.floors <= 18 ? 18 : 24;
    const repeatY = Math.max(1, Math.round(visual.floors / Math.max(2, floorBucket / 2)));
    const mat = new Cesium.ImageMaterialProperty({
      image: canvas,
      repeat: new Cesium.Cartesian2(1 + (visual.variant % 2), Math.min(6, repeatY)),
      color: Cesium.Color.WHITE,
      transparent: false,
    });
    materialCache.set(key, mat);
    return mat;
  }
  return getFallbackColorMaterial(Cesium, visual);
}

export function getFallbackColorMaterial(
  Cesium: typeof import("cesium"),
  visual: BuildingVisual,
): ColorMaterialProperty {
  const key = `color:${visual.materialId}:${visual.variant}`;
  const hit = colorFallbackCache.get(key);
  if (hit) return hit;
  const pal = paletteFor(visual.materialId, visual.variant);
  const mat = new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(pal.wall));
  colorFallbackCache.set(key, mat);
  return mat;
}

export function getRoofColor(Cesium: typeof import("cesium"), visual: BuildingVisual): ColorMaterialProperty {
  const pal = paletteFor("ROOFTOP", visual.variant);
  const hex =
    visual.archetype === "OFFICE_TOWER" || visual.archetype === "COMMERCIAL_HIGH"
      ? pal.cornice
      : visual.archetype === "HOSPITAL"
        ? "#E8E4DC"
        : pal.wall;
  return new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(hex));
}

export function getSelectionOutlineColor(Cesium: typeof import("cesium")) {
  return Cesium.Color.fromCssColorString("#3de1ff");
}

export function archetypesInCache(): string[] {
  return [...canvasCache.keys()];
}
