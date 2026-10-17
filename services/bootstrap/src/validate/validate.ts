import type { CanonicalEntity, CanonicalEdge } from "../normalize/normalize.js";
import type { LicenseSpdx } from "@polaris/domain";
import * as turf from "@turf/turf";

export interface ValidationIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly entityId?: string;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly qualityScore: number; // 0..100
  readonly issues: ValidationIssue[];
  readonly duplicateExternalIds: number;
  readonly invalidGeometries: number;
  readonly missingMetadata: number;
}

export function validateEntities(
  entities: CanonicalEntity[],
  opts: { requireLicenseOnProvenance?: boolean; licensesSeen: LicenseSpdx[] },
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const seenExt = new Map<string, string>();
  let invalidGeometries = 0;
  let missingMetadata = 0;
  let duplicateExternalIds = 0;

  for (const e of entities) {
    if (!e.entityKind) {
      issues.push({ severity: "error", code: "MISSING_KIND", message: "entityKind required", entityId: e.id });
      missingMetadata++;
    }
    if (!e.datasetVersionId) {
      issues.push({ severity: "error", code: "MISSING_DATASET_VERSION", message: "datasetVersionId required", entityId: e.id });
      missingMetadata++;
    }
    if (e.confidence < 0 || e.confidence > 1) {
      issues.push({ severity: "error", code: "BAD_CONFIDENCE", message: `confidence ${e.confidence}`, entityId: e.id });
    }
    for (const [ns, val] of Object.entries(e.externalIds)) {
      const key = `${ns}:${val}`;
      if (val && seenExt.has(key)) {
        duplicateExternalIds++;
        issues.push({
          severity: "warning",
          code: "DUPLICATE_EXTERNAL_ID",
          message: `Duplicate ${key}`,
          entityId: e.id,
        });
      } else if (val) {
        seenExt.set(key, e.id);
      }
    }
    if (e.geometry) {
      try {
        const f = { type: "Feature" as const, properties: {}, geometry: e.geometry };
        if (!turf.booleanValid(f as GeoJSON.Feature)) {
          invalidGeometries++;
          issues.push({ severity: "error", code: "INVALID_GEOMETRY", message: "geometry invalid", entityId: e.id });
        }
        // CRS assumption: GeoJSON is EPSG:4326
        if (e.geometry.type === "Point") {
          const [lon, lat] = e.geometry.coordinates as [number, number];
          if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
            invalidGeometries++;
            issues.push({ severity: "error", code: "OUT_OF_WGS84", message: "coordinates out of range", entityId: e.id });
          }
        }
      } catch (err) {
        invalidGeometries++;
        issues.push({
          severity: "error",
          code: "GEOMETRY_EXCEPTION",
          message: err instanceof Error ? err.message : String(err),
          entityId: e.id,
        });
      }
    }
  }

  if (!opts.licensesSeen.length) {
    issues.push({ severity: "error", code: "NO_LICENSE", message: "No dataset licenses recorded for bootstrap run" });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;
  const qualityScore = Math.max(
    0,
    100 - errorCount * 8 - warnCount * 2 - invalidGeometries * 3 - duplicateExternalIds,
  );

  return {
    ok: errorCount === 0,
    qualityScore,
    issues,
    duplicateExternalIds,
    invalidGeometries,
    missingMetadata,
  };
}

export function validateEdges(edges: CanonicalEdge[], entityIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const e of edges) {
    if (!entityIds.has(e.fromId) || !entityIds.has(e.toId)) {
      issues.push({
        severity: "error",
        code: "DANGLING_EDGE",
        message: `Edge ${e.type} references missing entity`,
      });
    }
  }
  return issues;
}
