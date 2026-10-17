import { join, dirname } from "node:path";
import { ulid } from "ulid";
import { ensureDir, writeJson, type BootstrapConnector, type ConnectorRunResult } from "@polaris/connector-sdk";
import type { LicenseSpdx } from "@polaris/domain";
import { resolveCityBoundary } from "../boundary/resolve-city.js";
import { DATASET_REGISTRY, type DatasetLayerKey } from "../registry/dataset-registry.js";
import { osmConnector } from "../connectors/osm.js";
import { geoboundariesConnector } from "../connectors/geoboundaries.js";
import { ourairportsConnector } from "../connectors/ourairports.js";
import { openMeteoConnector } from "../connectors/open-meteo.js";
import { gdacsConnector } from "../connectors/gdacs.js";
import {
  copernicusConnector,
  worldpopConnector,
  esaWorldCoverConnector,
  gtfsConnector,
  overtureConnector,
  sentinelConnector,
} from "../connectors/gated.js";
import {
  normalizeOsmFile,
  normalizeAirportsGeoJson,
  normalizeBoundary,
  writeCanonicalTwin,
  type CanonicalEntity,
} from "../normalize/normalize.js";
import { validateEntities, validateEdges } from "../validate/validate.js";
import { inferGraphEdges } from "../graph/infer-edges.js";
import { computeCityDNA, writeCityDNA } from "../dna/city-dna.js";
import {
  scoreReadiness,
  writeBootstrapReport,
  type BootstrapReport,
  type LayerStatus,
} from "../report/report.js";
import { persistTwin } from "../storage/persist.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // fallback: services/bootstrap/src/pipeline -> repo root
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "..");
}

export interface BootstrapOptions {
  readonly cityName: string;
  readonly workRoot?: string;
  readonly skipConnectors?: readonly string[];
}

function connectors(): BootstrapConnector[] {
  return [
    geoboundariesConnector,
    osmConnector,
    ourairportsConnector,
    openMeteoConnector,
    gdacsConnector,
    copernicusConnector,
    worldpopConnector,
    esaWorldCoverConnector,
    gtfsConnector,
    overtureConnector,
    sentinelConnector,
  ];
}

function layerEntityCount(key: DatasetLayerKey, entities: CanonicalEntity[]): number {
  const entry = DATASET_REGISTRY.find((d) => d.key === key)!;
  const kinds = new Set(entry.entityKinds);
  return entities.filter((e) => kinds.has(e.entityKind)).length;
}

export async function bootstrapCity(options: BootstrapOptions): Promise<BootstrapReport> {
  const startedAt = new Date();
  const aoiId = ulid();
  const slug = options.cityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const workDir = join(
    options.workRoot ?? join(findRepoRoot(), "data", "bootstrap"),
    `${slug}-${aoiId.slice(0, 8)}`,
  );
  ensureDir(workDir);
  writeJson(join(workDir, "job.json"), {
    aoiId,
    cityName: options.cityName,
    startedAt: startedAt.toISOString(),
    ontologyVersion: "1.0.0",
  });

  const warnings: string[] = [];
  const errors: string[] = [];

  // Step 1 — boundary
  console.log(`[1/10] Resolving boundary for "${options.cityName}"…`);
  const city = await resolveCityBoundary(options.cityName, workDir);
  const ctx = {
    workDir,
    bbox: city.bbox,
    cityName: city.displayName,
    aoiId,
  };

  // Step 2 — registry already defines required datasets
  console.log(`[2/10] Dataset registry loaded (${DATASET_REGISTRY.length} layers).`);

  // Step 3 — connector orchestration (independent, sequential for polite rate limits)
  console.log(`[3/10] Running connectors…`);
  const skip = new Set(options.skipConnectors ?? []);
  const connectorResults: ConnectorRunResult[] = [];
  for (const c of connectors()) {
    if (skip.has(c.manifest.id)) {
      connectorResults.push({
        manifest: c.manifest,
        status: "unavailable",
        artifacts: [],
        warnings: [],
        errors: [],
        missingReason: "Skipped by operator flag",
      });
      continue;
    }
    console.log(`  → ${c.manifest.id}`);
    try {
      const discovery = await c.discover(ctx);
      if (!discovery.available) {
        connectorResults.push({
          manifest: c.manifest,
          status: "unavailable",
          artifacts: [],
          warnings: [],
          errors: [],
          missingReason: discovery.reason ?? "discover=false",
        });
        continue;
      }
      const result = await c.fetch(ctx);
      connectorResults.push(result);
      warnings.push(...result.warnings.map((w) => `[${c.manifest.id}] ${w}`));
      errors.push(...result.errors.map((e) => `[${c.manifest.id}] ${e}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${c.manifest.id}] ${msg}`);
      connectorResults.push({
        manifest: c.manifest,
        status: "failed",
        artifacts: [],
        warnings: [],
        errors: [msg],
      });
    }
  }

  // Step 4 — normalize
  console.log(`[4/10] Normalizing to ontology…`);
  const datasetVersionId = ulid();
  const entities: CanonicalEntity[] = [];
  const boundaryPath = join(workDir, "boundary", "city-boundary.geojson");
  if (existsSync(boundaryPath)) {
    entities.push(...normalizeBoundary(boundaryPath, aoiId, datasetVersionId, city.displayName));
  }
  const osmDirProfiles = [
    "roads",
    "buildings",
    "hospitals",
    "schools",
    "police",
    "fire",
    "water",
    "railway",
    "metro",
    "landuse",
    "airports_osm",
  ];
  for (const profile of osmDirProfiles) {
    const p = join(workDir, "raw", "osm", `${profile}.osm.json`);
    if (existsSync(p)) entities.push(...normalizeOsmFile(p, aoiId, datasetVersionId));
  }
  const airportsPath = join(workDir, "raw", "ourairports", "airports.geojson");
  if (existsSync(airportsPath)) {
    entities.push(...normalizeAirportsGeoJson(airportsPath, aoiId, datasetVersionId));
  }
  writeCanonicalTwin(workDir, entities, []);

  // Step 5 — validate
  console.log(`[5/10] Validating…`);
  const licensesSeen = [
    ...new Set(
      connectorResults
        .map((r) => r.provenance?.license)
        .filter((x): x is LicenseSpdx => Boolean(x)),
    ),
  ];
  const validationBase = validateEntities(entities, { licensesSeen });

  // Step 7 — graph inference (ontology-driven)
  console.log(`[7/10] Inferring knowledge graph edges…`);
  const edges = inferGraphEdges(entities, datasetVersionId);
  const edgeIssues = validateEdges(edges, new Set(entities.map((e) => e.id)));
  const mergedIssues = [...validationBase.issues, ...edgeIssues];
  const errorCount = mergedIssues.filter((i) => i.severity === "error").length;
  const validation = {
    ...validationBase,
    issues: mergedIssues,
    ok: errorCount === 0,
    qualityScore: Math.max(0, validationBase.qualityScore - edgeIssues.length * 2),
  };
  writeCanonicalTwin(workDir, entities, edges);

  // Step 6 — storage
  console.log(`[6/10] Persisting twin artifacts…`);
  const tsArtifacts = ["forecast.json", "historical_rainfall.json", "aqi.json", "flood_discharge.json"]
    .map((f) => join(workDir, "raw", "open-meteo", f))
    .filter((p) => existsSync(p));
  const storage = await persistTwin({
    workDir,
    entities,
    edges,
    timeseriesArtifacts: tsArtifacts,
  });

  // Step 8 — City DNA
  console.log(`[8/10] Computing City DNA…`);
  const openMeteo = connectorResults.find((c) => c.manifest.id === "open-meteo");
  const worldpop = connectorResults.find((c) => c.manifest.id === "worldpop");
  const dna = computeCityDNA({
    cityName: city.displayName,
    aoiId,
    bbox: city.bbox,
    entities,
    hasWeather: openMeteo?.status === "success" || openMeteo?.status === "partial",
    hasFloodDischarge: existsSync(join(workDir, "raw", "open-meteo", "flood_discharge.json")),
    hasPopulationRaster: worldpop?.status === "success",
    hasUtilities: false,
  });
  writeCityDNA(workDir, dna);

  // Step 9 — report
  console.log(`[9/10] Generating bootstrap report…`);
  const datasetsUsed: LayerStatus[] = [];
  const missingData: LayerStatus[] = [];
  for (const entry of DATASET_REGISTRY) {
    const count = layerEntityCount(entry.key, entities);
    const related = connectorResults.filter((c) => entry.connectorIds.includes(c.manifest.id));
    const anySuccess = related.some((c) => c.status === "success" || c.status === "partial");
    const status: LayerStatus["status"] =
      count > 0 ? "present" : anySuccess ? "partial" : entry.connectorIds.length ? "missing" : "planned";
    const notes: string[] = [];
    if (count === 0 && entry.required) notes.push("Required layer missing or empty after connectors.");
    for (const r of related) {
      if (r.missingReason) notes.push(r.missingReason);
      notes.push(...r.warnings);
    }
    const layer: LayerStatus = {
      key: entry.key,
      displayName: entry.displayName,
      required: entry.required,
      status,
      connectorIds: entry.connectorIds,
      entityCount: count,
      confidence: count ? 0.7 : null,
      license: related.find((r) => r.provenance)?.provenance?.license,
      notes,
    };
    if (status === "present" || status === "partial") datasetsUsed.push(layer);
    if (status === "missing" || status === "planned" || (status === "partial" && entry.required && count === 0)) {
      missingData.push(layer);
    }
  }

  const requiredTotal = DATASET_REGISTRY.filter((d) => d.required).length;
  const requiredPresent = DATASET_REGISTRY.filter(
    (d) => d.required && layerEntityCount(d.key, entities) > 0,
  ).length;
  const optionalTotal = DATASET_REGISTRY.filter((d) => !d.required).length;
  const optionalPresent = DATASET_REGISTRY.filter(
    (d) => !d.required && layerEntityCount(d.key, entities) > 0,
  ).length;

  const finishedAt = new Date();
  const baseReport = {
    cityQuery: options.cityName,
    cityDisplayName: city.displayName,
    aoiId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    datasetsUsed,
    missingData,
    connectorResults: connectorResults.map((c) => ({
      connectorId: c.manifest.id,
      status: c.status,
      entityCount: c.entityCount,
      warnings: [...c.warnings],
      errors: [...c.errors],
      missingReason: c.missingReason,
    })),
    validation,
    cityDna: dna,
    coverage: { requiredPresent, requiredTotal, optionalPresent, optionalTotal },
    licensing: licensesSeen.map(String),
    warnings,
    errors,
    storage: {
      filesystem: workDir,
      postgis: storage.postgis,
      neo4j: storage.neo4j,
      timescale: storage.timescale,
      minio: storage.minio,
      opensearch: storage.opensearch,
    },
  };
  const scores = scoreReadiness(baseReport);
  const report: BootstrapReport = { ...baseReport, ...scores };
  writeBootstrapReport(workDir, report);

  // Step 10 — CLI prints path
  console.log(`[10/10] Done.`);
  console.log(`Work dir: ${workDir}`);
  console.log(`City readiness: ${report.cityReadinessScore}/100`);
  console.log(`Twin readiness: ${report.twinReadinessScore}/100`);
  console.log(`Entities: ${entities.length} · Edges: ${edges.length}`);
  console.log(`Missing layers: ${missingData.length}`);

  return report;
}
