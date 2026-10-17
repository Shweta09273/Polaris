/**
 * City Compiler — wraps the existing Bootstrap Engine.
 * Does NOT reimplement bootstrap. Pipeline:
 * City Name → bootstrapCity → packCity → registry install → mount cache
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapCity } from "@polaris/bootstrap";
import {
  packCity,
  unpackPackage,
  COMPILER_VERSION,
  type PolarisPackageManifest,
} from "@polaris/package";
import { CityRegistry, defaultRegistryPaths, type InstalledCityRecord } from "@polaris/registry";

export type CompilePhase =
  | "queued"
  | "bootstrap"
  | "packaging"
  | "installing"
  | "complete"
  | "failed";

export interface CompileProgressEvent {
  readonly jobId: string;
  readonly cityName: string;
  readonly phase: CompilePhase;
  readonly percent: number;
  readonly message: string;
  readonly at: string;
  readonly error?: string;
}

export interface CompileJob {
  readonly jobId: string;
  readonly cityName: string;
  phase: CompilePhase;
  percent: number;
  message: string;
  events: CompileProgressEvent[];
  result?: CompileResult;
  error?: string;
  readonly startedAt: string;
  finishedAt?: string;
}

export interface CompileResult {
  readonly reportPath: string;
  readonly workDir: string;
  readonly packagePath: string;
  readonly manifest: PolarisPackageManifest;
  readonly installed: InstalledCityRecord;
}

export interface CompileOptions {
  readonly cityName: string;
  readonly skipConnectors?: readonly string[];
  readonly signingSecret?: string;
  readonly cityVersion?: string;
  readonly onProgress?: (event: CompileProgressEvent) => void;
  /** Reuse an existing job shell (async API). */
  readonly jobId?: string;
}

const jobs = new Map<string, CompileJob>();

export function getCompileJob(jobId: string): CompileJob | undefined {
  return jobs.get(jobId);
}

export function listCompileJobs(): CompileJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function findBoundary(workDir: string): string | undefined {
  const candidates = [
    join(workDir, "boundary", "city-boundary.geojson"),
    join(workDir, "boundary.geojson"),
    join(workDir, "raw", "nominatim", "boundary.geojson"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

function emit(
  job: CompileJob,
  phase: CompilePhase,
  percent: number,
  message: string,
  error?: string,
): CompileProgressEvent {
  job.phase = phase;
  job.percent = percent;
  job.message = message;
  if (error) job.error = error;
  const event: CompileProgressEvent = {
    jobId: job.jobId,
    cityName: job.cityName,
    phase,
    percent,
    message,
    at: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  job.events.push(event);
  return event;
}

function ensureJob(options: CompileOptions): CompileJob {
  if (options.jobId && jobs.has(options.jobId)) {
    return jobs.get(options.jobId)!;
  }
  const jobId =
    options.jobId ?? `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job: CompileJob = {
    jobId,
    cityName: options.cityName,
    phase: "queued",
    percent: 0,
    message: "Queued",
    events: [],
    startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  return job;
}

/**
 * Compile a city: bootstrap (SSOT) → .polaris package → registry install → mount.
 */
export async function compileCity(options: CompileOptions): Promise<CompileResult> {
  const job = ensureJob(options);
  const notify = (phase: CompilePhase, percent: number, message: string, error?: string) => {
    const ev = emit(job, phase, percent, message, error);
    options.onProgress?.(ev);
  };

  try {
    notify("bootstrap", 5, `Invoking Bootstrap Engine for "${options.cityName}"…`);
    const bootstrapOpts = {
      cityName: options.cityName,
      ...(options.skipConnectors ? { skipConnectors: options.skipConnectors } : {}),
    };
    const report = await bootstrapCity(bootstrapOpts);
    const workDir = report.storage.filesystem;
    notify("bootstrap", 55, `Bootstrap complete — readiness ${report.twinReadinessScore}/100`);

    const twinDir = join(workDir, "twin");
    const cityDnaPath = join(workDir, "city-dna.json");
    const bootstrapReportPath = join(workDir, "bootstrap-report.json");
    if (!existsSync(join(twinDir, "entities.json"))) {
      throw new Error(`Bootstrap twin missing at ${twinDir}`);
    }
    if (!existsSync(cityDnaPath) || !existsSync(bootstrapReportPath)) {
      throw new Error("Bootstrap DNA or report missing");
    }

    notify("packaging", 65, "Generating .polaris package…");
    const paths = defaultRegistryPaths();
    mkdirSync(paths.packagesDir, { recursive: true });
    const citySlug = slugify(report.cityDisplayName || options.cityName);
    const cityVersion =
      options.cityVersion ?? `1.0.0+${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const packagePath = join(paths.packagesDir, `${citySlug}-${cityVersion}.polaris`);
    const signingSecret = options.signingSecret ?? process.env.POLARIS_PACKAGE_HMAC_SECRET;

    const provenanceDir = join(workDir, "provenance");
    mkdirSync(provenanceDir, { recursive: true });

    const boundaryPath = findBoundary(workDir);
    const manifest = await packCity({
      citySlug,
      cityDisplayName: report.cityDisplayName,
      cityVersion,
      twinDir,
      cityDnaPath,
      bootstrapReportPath,
      twinReadinessScore: report.twinReadinessScore,
      cityReadinessScore: report.cityReadinessScore,
      coverage: report.coverage,
      provenance: {
        datasetKeys: report.datasetsUsed.map((d) => d.key),
        licenses: report.licensing.map((spdx) => ({
          spdx,
          attribution: spdx,
          sourceId: "bootstrap",
        })),
        bootstrapAoiId: report.aoiId,
        workDirHint: workDir,
      },
      outPath: packagePath,
      provenanceDir,
      ...(boundaryPath ? { boundaryPath } : {}),
      ...(signingSecret ? { signingSecret } : {}),
    });

    notify("installing", 85, "Installing package into city registry…");
    const mountDir = join(paths.mountsDir, citySlug, cityVersion);
    await unpackPackage(packagePath, mountDir, {
      signingSecret,
      allowUnsigned: process.env.POLARIS_ALLOW_UNSIGNED_PACKAGES !== "false",
    });

    const registry = new CityRegistry();
    const confidence = Math.round(report.twinReadinessScore * 0.6 + report.cityReadinessScore * 0.4);
    const installed = registry.install({
      citySlug,
      cityDisplayName: report.cityDisplayName,
      packageId: manifest.packageId,
      cityVersion,
      ontologyVersion: manifest.ontologyVersion,
      compilerVersion: COMPILER_VERSION,
      twinReadinessScore: report.twinReadinessScore,
      cityReadinessScore: report.cityReadinessScore,
      coverage: report.coverage,
      dataConfidence: confidence,
      installedAt: new Date().toISOString(),
      installedSizeBytes: statSync(packagePath).size,
      packagePath,
      mountDir,
    });

    const result: CompileResult = {
      reportPath: bootstrapReportPath,
      workDir,
      packagePath,
      manifest,
      installed,
    };
    job.result = result;
    job.finishedAt = new Date().toISOString();
    notify("complete", 100, `City "${report.cityDisplayName}" packaged and installed`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.finishedAt = new Date().toISOString();
    notify("failed", job.percent, "Compilation failed", message);
    throw err;
  }
}

/**
 * Start compile asynchronously; returns jobId for progress polling.
 */
export function compileCityAsync(options: CompileOptions): string {
  const job = ensureJob(options);
  void compileCity({ ...options, jobId: job.jobId }).catch(() => {
    /* errors recorded on job */
  });
  return job.jobId;
}

export { COMPILER_VERSION, findRepoRoot };
