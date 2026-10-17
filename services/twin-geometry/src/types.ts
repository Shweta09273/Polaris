import type { BoundingBox } from "@polaris/domain";

/** Supported interactive demo cities — validated against public Overpass-friendly AOIs. */
export const DEMO_CITIES = [
  {
    slug: "monaco",
    displayName: "Monaco",
    query: "Monaco",
    /** Principality is small; Nominatim bbox ~0.029 deg². */
    maxFetchDeg2: 0.03,
  },
  {
    slug: "singapore",
    displayName: "Singapore",
    query: "Singapore",
    /** Dense CBD crop — area alone is not the risk; building density is. */
    maxFetchDeg2: 0.02,
  },
  {
    slug: "amsterdam",
    displayName: "Amsterdam",
    query: "Amsterdam, Netherlands",
    /** Canal-ring scale; previous 0.1 allowed full city (307k buildings). */
    maxFetchDeg2: 0.015,
  },
] as const;

export type DemoCitySlug = (typeof DEMO_CITIES)[number]["slug"];

export function resolveDemoCity(input: string): (typeof DEMO_CITIES)[number] | undefined {
  const q = input.trim().toLowerCase();
  return DEMO_CITIES.find(
    (c) => c.slug === q || c.displayName.toLowerCase() === q || c.query.toLowerCase() === q,
  );
}

export function centerCropBbox(bbox: BoundingBox, maxDeg2: number): {
  fetchBbox: BoundingBox;
  cropped: boolean;
  fullAreaDeg2: number;
  fetchAreaDeg2: number;
} {
  const w = bbox.maxLon - bbox.minLon;
  const h = bbox.maxLat - bbox.minLat;
  const fullAreaDeg2 = w * h;
  if (fullAreaDeg2 <= maxDeg2) {
    return { fetchBbox: bbox, cropped: false, fullAreaDeg2, fetchAreaDeg2: fullAreaDeg2 };
  }
  const aspect = w / h;
  let nh = Math.sqrt(maxDeg2 / aspect);
  let nw = aspect * nh;
  const cx = (bbox.minLon + bbox.maxLon) / 2;
  const cy = (bbox.minLat + bbox.maxLat) / 2;
  const fetchBbox: BoundingBox = {
    minLon: cx - nw / 2,
    maxLon: cx + nw / 2,
    minLat: cy - nh / 2,
    maxLat: cy + nh / 2,
    crs: "EPSG:4326",
  };
  return { fetchBbox, cropped: true, fullAreaDeg2, fetchAreaDeg2: nw * nh };
}

export interface LayerProvenance {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly license: string;
  readonly attribution: string;
  readonly sourceUrl: string;
  readonly fetchedAt: string;
}

export interface SceneLayerStatus {
  readonly id: string;
  readonly label: string;
  readonly status: "ready" | "partial" | "missing";
  readonly featureCount: number;
  readonly note?: string;
  readonly provenance?: LayerProvenance;
}

export interface TwinSceneManifest {
  readonly format: "polaris.twin3d.scene/1";
  readonly citySlug: string;
  readonly cityDisplayName: string;
  readonly query: string;
  readonly builtAt: string;
  readonly bbox: BoundingBox;
  readonly fetchBbox: BoundingBox;
  readonly camera: {
    readonly lon: number;
    readonly lat: number;
    readonly height: number;
    readonly heading: number;
    readonly pitch: number;
  };
  readonly layers: SceneLayerStatus[];
  readonly missing: string[];
  readonly warnings: string[];
  readonly searchIndexPath: string;
  readonly terrain: {
    readonly status: "ready" | "missing";
    readonly provider: "terrarium-heightmap" | "none";
    readonly path?: string;
    readonly note?: string;
  };
}
