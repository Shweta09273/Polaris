import { writeFileSync } from "node:fs";
import { writeJson } from "@polaris/connector-sdk";
import { join } from "node:path";
import type { DatasetLayerKey } from "../registry/dataset-registry.js";
import type { CityDNA } from "../dna/city-dna.js";
import type { ValidationReport } from "../validate/validate.js";
import type { ConnectorRunResult } from "@polaris/connector-sdk";

export interface LayerStatus {
  readonly key: DatasetLayerKey;
  readonly displayName: string;
  readonly required: boolean;
  readonly status: "present" | "partial" | "missing" | "planned";
  readonly connectorIds: readonly string[];
  readonly entityCount: number;
  readonly confidence: number | null;
  readonly license?: string;
  readonly notes: string[];
}

export interface BootstrapReport {
  readonly cityQuery: string;
  readonly cityDisplayName: string;
  readonly aoiId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly datasetsUsed: LayerStatus[];
  readonly missingData: LayerStatus[];
  readonly connectorResults: Array<{
    connectorId: string;
    status: ConnectorRunResult["status"];
    entityCount?: number;
    warnings: string[];
    errors: string[];
    missingReason?: string;
  }>;
  readonly validation: ValidationReport;
  readonly cityDna: CityDNA;
  readonly coverage: {
    readonly requiredPresent: number;
    readonly requiredTotal: number;
    readonly optionalPresent: number;
    readonly optionalTotal: number;
  };
  readonly licensing: string[];
  readonly warnings: string[];
  readonly errors: string[];
  readonly cityReadinessScore: number;
  readonly twinReadinessScore: number;
  readonly storage: {
    readonly filesystem: string;
    readonly postgis: "written" | "skipped" | "failed";
    readonly neo4j: "written" | "skipped" | "failed";
    readonly timescale: "written" | "skipped" | "failed";
    readonly minio: "written" | "skipped" | "failed";
    readonly opensearch: "written" | "skipped" | "failed";
  };
}

export function scoreReadiness(
  report: Omit<BootstrapReport, "cityReadinessScore" | "twinReadinessScore">,
): { cityReadinessScore: number; twinReadinessScore: number } {
  const req = report.coverage.requiredTotal || 1;
  const reqRatio = report.coverage.requiredPresent / req;
  const quality = report.validation.qualityScore / 100;
  const connectorFail = report.connectorResults.filter((c) => c.status === "failed").length;
  const cityReadinessScore = Math.round(
    Math.max(0, Math.min(100, reqRatio * 70 + quality * 25 - connectorFail * 5)),
  );
  const hasEntities = report.datasetsUsed.some((d) => d.entityCount > 0);
  const twinReadinessScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (hasEntities ? 40 : 0) +
          reqRatio * 40 +
          quality * 20 -
          report.missingData.filter((m) => m.required).length * 8,
      ),
    ),
  );
  return { cityReadinessScore, twinReadinessScore };
}

export function writeBootstrapReport(workDir: string, report: BootstrapReport): string {
  const path = join(workDir, "bootstrap-report.json");
  writeJson(path, report);
  const md = join(workDir, "bootstrap-report.md");
  const lines = [
    `# POLARIS Bootstrap Report`,
    ``,
    `**City:** ${report.cityDisplayName}`,
    `**Query:** ${report.cityQuery}`,
    `**AOI:** ${report.aoiId}`,
    `**Duration:** ${report.durationMs} ms`,
    ``,
    `## Scores`,
    ``,
    `- City Readiness: **${report.cityReadinessScore}/100**`,
    `- Twin Readiness: **${report.twinReadinessScore}/100**`,
    `- Validation quality: **${report.validation.qualityScore}/100**`,
    ``,
    `## Coverage`,
    ``,
    `- Required layers: ${report.coverage.requiredPresent}/${report.coverage.requiredTotal}`,
    `- Optional layers: ${report.coverage.optionalPresent}/${report.coverage.optionalTotal}`,
    ``,
    `## Missing data`,
    ``,
    ...(report.missingData.length
      ? report.missingData.map(
          (m) => `- **${m.displayName}** (${m.key}): ${m.notes.join("; ") || m.status}`,
        )
      : ["- None reported"]),
    ``,
    `## Connector errors / gaps`,
    ``,
    ...report.connectorResults
      .filter((c) => c.errors.length || c.status === "failed" || c.status === "unavailable")
      .map(
        (c) =>
          `- **${c.connectorId}** [${c.status}]: ${c.errors.join("; ") || c.missingReason || "see warnings"}`,
      ),
    ``,
    `## Licensing`,
    ``,
    ...report.licensing.map((l) => `- ${l}`),
    ``,
    `## Storage`,
    ``,
    `- Filesystem: \`${report.storage.filesystem}\``,
    `- PostGIS: ${report.storage.postgis}`,
    `- Neo4j: ${report.storage.neo4j}`,
    `- TimescaleDB: ${report.storage.timescale}`,
    `- MinIO: ${report.storage.minio}`,
    `- OpenSearch: ${report.storage.opensearch}`,
    ``,
    `_No datasets were fabricated. Null DNA metrics mean data was unavailable._`,
  ];
  writeFileSync(md, lines.join("\n"), "utf8");
  return path;
}
