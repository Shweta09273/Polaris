/**
 * Cesium visual bootstrap — SAFE / STABLE path first.
 *
 * Regression note (2026-07): applyPremiumSceneSettings enabled HDR, MSAA×4,
 * FXAA, soft shadows, and aggressive atmosphere. On some Windows GPU/drivers
 * this caused Fragment shader compile failure during / right after Viewer init.
 *
 * Policy: boot with Cesium defaults + ellipsoid terrain + OSM imagery.
 * Optional aerial upgrade AFTER viewer is alive. No HDR / MSAA / FXAA / shadows.
 */

import type { Viewer, ImageryProvider, TerrainProvider } from "cesium";

export type ImageryChoice = {
  id: string;
  label: string;
  provider: ImageryProvider;
  kind: "aerial" | "carto";
};

/** Always-safe carto imagery for Viewer construction. */
export function createOsmImagery(Cesium: typeof import("cesium")): ImageryChoice {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "© OpenStreetMap contributors",
    maximumLevel: 19,
  });
  return {
    id: "osm-raster",
    label: "OpenStreetMap raster",
    provider,
    kind: "carto",
  };
}

/** Best public aerial — call AFTER Viewer is constructed. */
export async function selectBestImagery(Cesium: typeof import("cesium")): Promise<ImageryChoice> {
  const ion = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim();
  if (ion) {
    Cesium.Ion.defaultAccessToken = ion;
    try {
      const provider = await Cesium.createWorldImageryAsync({
        style: Cesium.IonWorldImageryStyle.AERIAL,
      });
      return {
        id: "ion-world-imagery",
        label: "Cesium Ion World Imagery (aerial)",
        provider,
        kind: "aerial",
      };
    } catch {
      /* fall through */
    }
  }

  try {
    const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
      { enablePickFeatures: false },
    );
    return {
      id: "esri-world-imagery",
      label: "Esri World Imagery (aerial)",
      provider,
      kind: "aerial",
    };
  } catch {
    /* fall through */
  }

  return createOsmImagery(Cesium);
}

export async function selectBestTerrain(
  Cesium: typeof import("cesium"),
): Promise<{ provider: TerrainProvider; label: string }> {
  const ion = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim();
  if (ion) {
    Cesium.Ion.defaultAccessToken = ion;
    try {
      // No water mask / vertex normals — simpler globe shaders
      const provider = await Cesium.createWorldTerrainAsync({
        requestVertexNormals: false,
        requestWaterMask: false,
      });
      return { provider, label: "Cesium World Terrain (simple)" };
    } catch {
      /* fall through */
    }
  }
  return {
    provider: new Cesium.EllipsoidTerrainProvider(),
    label: "Ellipsoid terrain",
  };
}

/**
 * Safe scene defaults only. No HDR, MSAA, FXAA, soft shadows, or custom GLSL.
 */
export function applySafeSceneSettings(viewer: Viewer) {
  const scene = viewer.scene;
  const globe = scene.globe;

  viewer.resolutionScale = 1;
  viewer.shadows = false;
  viewer.clock.shouldAnimate = false;
  try {
    // Cesium.ShadowMode.DISABLED === 0
    (viewer as Viewer & { terrainShadows: number }).terrainShadows = 0;
  } catch {
    /* */
  }

  try {
    scene.postProcessStages.fxaa.enabled = false;
  } catch {
    /* */
  }
  scene.msaaSamples = 1;
  scene.highDynamicRange = false;
  scene.fog.enabled = true;
  scene.fog.density = 0.0002;

  globe.enableLighting = false;
  globe.depthTestAgainstTerrain = false;
  globe.maximumScreenSpaceError = 2;
  globe.tileCacheSize = 500;
  globe.showGroundAtmosphere = true;

  if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
  if (scene.sun) scene.sun.show = true;
  if (scene.moon) scene.moon.show = true;
  if (scene.skyBox) scene.skyBox.show = true;

  const controller = scene.screenSpaceCameraController;
  controller.minimumZoomDistance = 20;
  controller.maximumZoomDistance = 40_000_000;
  controller.inertiaSpin = 0.9;
  controller.inertiaTranslate = 0.9;
  controller.inertiaZoom = 0.8;
}

/** @deprecated Use applySafeSceneSettings — premium path disabled due to shader regressions. */
export function applyPremiumSceneSettings(
  _Cesium: typeof import("cesium"),
  viewer: Viewer,
  _opts?: { enableShadows?: boolean },
) {
  applySafeSceneSettings(viewer);
}

export function tuneImageryLayer(
  Cesium: typeof import("cesium"),
  viewer: Viewer,
) {
  const layer = viewer.imageryLayers.get(0);
  if (!layer) return;
  // ImageryLayer only allows NEAREST or LINEAR (no mipmap filters)
  layer.minificationFilter = Cesium.TextureMinificationFilter.LINEAR;
  layer.magnificationFilter = Cesium.TextureMagnificationFilter.LINEAR;
}

/**
 * Create Viewer with progressive WebGL fallbacks.
 * Never applies HDR / MSAA / FXAA / soft shadows at construction time.
 */
export async function createStableViewer(
  Cesium: typeof import("cesium"),
  container: HTMLElement,
): Promise<{ viewer: Viewer; imageryLabel: string; terrainLabel: string }> {
  const osm = createOsmImagery(Cesium);
  const ellipsoid = new Cesium.EllipsoidTerrainProvider();

  const baseOptions = {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: true,
    infoBox: false,
    selectionIndicator: true,
    baseLayer: new Cesium.ImageryLayer(osm.provider),
    terrainProvider: ellipsoid,
    msaaSamples: 1 as const,
    requestRenderMode: false,
  };

  let viewer: Viewer;
  try {
    viewer = new Cesium.Viewer(container, {
      ...baseOptions,
      contextOptions: {
        webgl: {
          alpha: false,
          depth: true,
          stencil: false,
          antialias: true,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        },
      },
    });
  } catch (first) {
    console.warn("[polaris.cesium] Viewer WebGL2/default failed, retrying WebGL1", first);
    viewer = new Cesium.Viewer(container, {
      ...baseOptions,
      contextOptions: {
        requestWebgl1: true,
        webgl: {
          alpha: false,
          depth: true,
          antialias: true,
          failIfMajorPerformanceCaveat: false,
        },
      },
    });
  }

  applySafeSceneSettings(viewer);
  tuneImageryLayer(Cesium, viewer);
  try {
    viewer.scene.light = new Cesium.SunLight({ intensity: 2.6 });
    applyCitySun(Cesium, viewer, 0);
  } catch {
    /* default sun */
  }

  // No aerial / world-terrain upgrade here — Task 5 reintroduces via upgradeVisualsOptionally.
  return {
    viewer,
    imageryLabel: osm.label,
    terrainLabel: "Ellipsoid terrain",
  };
}

/**
 * Optional visual upgrade AFTER Viewer is stable. Call one step at a time in Task 5.
 * Returns which upgrades applied; never throws (Viewer stays alive).
 */
export async function upgradeVisualsOptionally(
  Cesium: typeof import("cesium"),
  viewer: Viewer,
  opts: { imagery?: boolean; terrain?: boolean } = { imagery: true, terrain: true },
): Promise<{ imageryLabel?: string; terrainLabel?: string }> {
  const out: { imageryLabel?: string; terrainLabel?: string } = {};
  if (opts.imagery) {
    try {
      const better = await selectBestImagery(Cesium);
      if (better.kind === "aerial") {
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(better.provider);
        tuneImageryLayer(Cesium, viewer);
        out.imageryLabel = better.label;
      }
    } catch (e) {
      console.warn("[polaris.cesium] Aerial imagery upgrade skipped", e);
    }
  }
  if (opts.terrain) {
    try {
      const terrain = await selectBestTerrain(Cesium);
      viewer.terrainProvider = terrain.provider;
      out.terrainLabel = terrain.label;
    } catch (e) {
      console.warn("[polaris.cesium] Terrain upgrade skipped", e);
    }
  }
  return out;
}

/**
 * Freeze the simulation clock at local afternoon for the city longitude.
 * Entity materials are still sun-lit even when globe.enableLighting is false.
 * A live/night clock makes extruded buildings render as black silhouettes
 * on an unlit (bright) globe.
 */
export function applyCitySun(
  Cesium: typeof import("cesium"),
  viewer: Viewer,
  lon: number,
  localHour = 14,
) {
  const utcHour = ((localHour - lon / 15) % 24 + 24) % 24;
  const hour = Math.floor(utcHour);
  const minute = Math.round((utcHour - hour) * 60);
  const d = new Date(Date.UTC(2026, 5, 21, hour, minute, 0));
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(d);
  viewer.clock.shouldAnimate = false;
  try {
    viewer.scene.light = new Cesium.SunLight({ intensity: 2.6 });
  } catch {
    /* keep existing light */
  }
}

export function shouldUseAoiHeightmapForBases(viewer: Viewer, Cesium: typeof import("cesium")): boolean {
  return viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider;
}

export function sampleHeightmap(
  hm: {
    cols: number;
    rows: number;
    west: number;
    south: number;
    east: number;
    north: number;
    heights: number[];
  },
  lon: number,
  lat: number,
): number | null {
  if (lon < hm.west || lon > hm.east || lat < hm.south || lat > hm.north) return null;
  const u = (lon - hm.west) / (hm.east - hm.west);
  const v = (hm.north - lat) / (hm.north - hm.south);
  const col = Math.min(hm.cols - 1, Math.max(0, Math.floor(u * hm.cols)));
  const row = Math.min(hm.rows - 1, Math.max(0, Math.floor(v * hm.rows)));
  const h = hm.heights[row * hm.cols + col];
  return Number.isFinite(h) ? (h as number) : null;
}

export type LoadingPhase =
  | "idle"
  | "datasets"
  | "imagery"
  | "terrain"
  | "buildings"
  | "roads"
  | "water"
  | "vegetation"
  | "pois"
  | "meshes"
  | "scene"
  | "complete"
  | "error";

export const LOADING_LABELS: Record<LoadingPhase, string> = {
  idle: "Ready",
  datasets: "Loading datasets",
  imagery: "Loading imagery",
  terrain: "Loading terrain",
  buildings: "Loading buildings",
  roads: "Loading roads",
  water: "Loading water",
  vegetation: "Loading vegetation",
  pois: "Loading landmarks",
  meshes: "Generating meshes",
  scene: "Preparing scene",
  complete: "Loading complete",
  error: "Load failed",
};
