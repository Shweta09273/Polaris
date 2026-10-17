import { writeJson, ensureDir } from "@polaris/connector-sdk";
import { join } from "node:path";
import type { CanonicalEntity, CanonicalEdge } from "../normalize/normalize.js";

export interface StorageResult {
  filesystem: "written" | "skipped" | "failed";
  postgis: "written" | "skipped" | "failed";
  neo4j: "written" | "skipped" | "failed";
  timescale: "written" | "skipped" | "failed";
  minio: "written" | "skipped" | "failed";
  opensearch: "written" | "skipped" | "failed";
  details: string[];
}

/**
 * Storage fan-out. External systems are optional via env.
 * Filesystem twin is always written (authoritative bootstrap artifact).
 * Never pretends DB write succeeded when skipped.
 */
export async function persistTwin(input: {
  workDir: string;
  entities: CanonicalEntity[];
  edges: CanonicalEdge[];
  timeseriesArtifacts: string[];
}): Promise<StorageResult> {
  const details: string[] = [];
  const outDir = join(input.workDir, "twin");
  ensureDir(outDir);
  writeJson(join(outDir, "entities.json"), { count: input.entities.length, entities: input.entities });
  writeJson(join(outDir, "edges.json"), { count: input.edges.length, edges: input.edges });
  details.push(`Filesystem twin written under ${outDir}`);

  const result: StorageResult = {
    filesystem: "written",
    postgis: "skipped",
    neo4j: "skipped",
    timescale: "skipped",
    minio: "skipped",
    opensearch: "skipped",
    details,
  };

  if (process.env.DATABASE_URL || process.env.POSTGIS_URL) {
    details.push(
      "PostGIS URL detected but SQL writer adapter is Milestone-2.1 (schema ready). Marked skipped — not silently pretended.",
    );
    result.postgis = "skipped";
  } else {
    details.push("PostGIS skipped — DATABASE_URL/POSTGIS_URL unset");
  }

  if (process.env.NEO4J_URI || process.env.NEO4J_URL) {
    details.push("Neo4j URI detected; bulk load adapter pending dedicated driver wiring — skipped honestly.");
    result.neo4j = "skipped";
  } else {
    details.push("Neo4j skipped — NEO4J_URI unset");
  }

  if (input.timeseriesArtifacts.length) {
    if (process.env.TIMESCALE_URL) {
      details.push("Timescale URL set; series load adapter pending — artifacts retained on filesystem.");
      result.timescale = "skipped";
    } else {
      details.push("Timescale skipped — TIMESCALE_URL unset; weather/AQ JSON retained in raw/");
    }
  }

  if (process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT) {
    details.push("Object storage endpoint set; upload adapter pending — raw/ kept local.");
    result.minio = "skipped";
  } else {
    details.push("MinIO/S3 skipped — endpoint unset");
  }

  if (process.env.OPENSEARCH_URL) {
    details.push("OpenSearch URL set; index adapter pending — skipped.");
    result.opensearch = "skipped";
  } else {
    details.push("OpenSearch skipped — OPENSEARCH_URL unset");
  }

  writeJson(join(outDir, "storage-result.json"), result);
  return result;
}
