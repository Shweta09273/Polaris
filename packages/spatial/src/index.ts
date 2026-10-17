import type { BoundingBox } from "@polaris/domain";

export function assertValidBbox(bbox: BoundingBox): void {
  if (bbox.crs !== "EPSG:4326") {
    throw new Error(`Unsupported CRS: ${bbox.crs}. Canonical CRS is EPSG:4326.`);
  }
  if (!(bbox.minLon < bbox.maxLon && bbox.minLat < bbox.maxLat)) {
    throw new Error("Invalid bounding box: min must be strictly less than max.");
  }
  if (bbox.minLon < -180 || bbox.maxLon > 180 || bbox.minLat < -90 || bbox.maxLat > 90) {
    throw new Error("Bounding box exceeds WGS84 bounds.");
  }
}

export function bboxAreaDeg2(bbox: BoundingBox): number {
  assertValidBbox(bbox);
  return (bbox.maxLon - bbox.minLon) * (bbox.maxLat - bbox.minLat);
}

/** Guardrail: refuse absurdly large AOIs that would melt public APIs. */
export function assertAoiSizeLimit(bbox: BoundingBox, maxDeg2 = 4): void {
  const area = bboxAreaDeg2(bbox);
  if (area > maxDeg2) {
    throw new Error(
      `AOI area ${area.toFixed(3)} deg² exceeds safety limit ${maxDeg2}. Split AOI or use bulk extract pipelines.`,
    );
  }
}
