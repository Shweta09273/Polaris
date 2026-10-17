import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { BoundingBox, ConnectorManifest, LicenseSpdx, Provenance } from "@polaris/domain";

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 15_000,
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  label: string,
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === policy.maxAttempts) break;
      const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 200);
      console.warn(`[retry] ${label} attempt ${attempt} failed; waiting ${delay + jitter}ms`);
      await sleep(delay + jitter);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(path: string): string {
  return sha256Buffer(readFileSync(path));
}

export interface DownloadCheckpoint {
  readonly url: string;
  readonly etag?: string | undefined;
  readonly bytesWritten: number;
  readonly sha256Partial?: string | undefined;
  readonly updatedAt: string;
}

export interface ResumableDownloadResult {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly resumed: boolean;
  readonly contentType?: string | undefined;
}

/**
 * Resumable HTTP download with Range support + checkpoint JSON.
 * Fails closed if server rejects resume and file is partial without restart permission.
 */
export async function resumableDownload(options: {
  url: string;
  destPath: string;
  headers?: Record<string, string>;
  userAgent?: string;
  forceRestart?: boolean;
}): Promise<ResumableDownloadResult> {
  const destPath = options.destPath;
  const partialPath = `${destPath}.partial`;
  const checkpointPath = `${destPath}.checkpoint.json`;
  mkdirSync(dirname(destPath), { recursive: true });

  if (existsSync(destPath) && !options.forceRestart) {
    const bytes = statSync(destPath).size;
    return { path: destPath, sha256: sha256File(destPath), bytes, resumed: false };
  }

  if (options.forceRestart) {
    for (const p of [partialPath, checkpointPath, destPath]) {
      if (existsSync(p)) {
        // intentional overwrite path
      }
    }
  }

  let existing = 0;
  let checkpoint: DownloadCheckpoint | undefined;
  if (existsSync(checkpointPath) && existsSync(partialPath) && !options.forceRestart) {
    checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8")) as DownloadCheckpoint;
    existing = statSync(partialPath).size;
  }

  const headers: Record<string, string> = {
    "User-Agent": options.userAgent ?? "POLARIS-Bootstrap/0.2 (+https://polaris.local; research)",
    ...(options.headers ?? {}),
  };
  if (existing > 0) {
    headers.Range = `bytes=${existing}-`;
  }

  const response = await withRetry(`GET ${options.url}`, async () => {
    const res = await fetch(options.url, { headers });
    if (!res.ok && res.status !== 206) {
      throw new Error(`HTTP ${res.status} for ${options.url}`);
    }
    return res;
  });

  if (existing > 0 && response.status === 200) {
    // Server ignored Range — restart cleanly
    existing = 0;
  }

  const resumed = existing > 0 && response.status === 206;
  const file = createWriteStream(partialPath, { flags: resumed ? "a" : "w" });
  if (!response.body) {
    throw new Error(`Empty body for ${options.url}`);
  }

  await pipeline(Readable.fromWeb(response.body as import("stream/web").ReadableStream), file);

  const etag = response.headers.get("etag") ?? undefined;
  const bytesWritten = statSync(partialPath).size;
  const cp: DownloadCheckpoint = {
    url: options.url,
    etag,
    bytesWritten,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(checkpointPath, JSON.stringify(cp, null, 2));

  const sha = sha256File(partialPath);
  renameSync(partialPath, destPath);
  if (existsSync(checkpointPath)) {
    writeFileSync(checkpointPath, JSON.stringify({ ...cp, completed: true, sha256: sha }, null, 2));
  }

  return {
    path: destPath,
    sha256: sha,
    bytes: bytesWritten,
    resumed,
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return withRetry(`JSON ${url}`, async () => {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "POLARIS-Bootstrap/0.2 (+https://polaris.local; research)",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  });
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  return withRetry(`TEXT ${url}`, async () => {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "POLARIS-Bootstrap/0.2 (+https://polaris.local; research)",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${url}`);
    }
    return res.text();
  });
}

export function makeProvenance(input: {
  sourceId: string;
  sourceName: string;
  license: LicenseSpdx;
  attribution: string;
  accessMode: Provenance["accessMode"];
  sourceUrl?: string;
  sourceVersion?: string;
}): Provenance {
  return {
    ...input,
    retrievedAt: new Date().toISOString() as Provenance["retrievedAt"],
  };
}

export interface ConnectorContext {
  readonly workDir: string;
  readonly bbox: BoundingBox;
  readonly cityName: string;
  readonly aoiId: string;
  readonly signal?: AbortSignal;
}

export interface ConnectorArtifact {
  readonly relativeKey: string;
  readonly mediaType: string;
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface ConnectorRunResult {
  readonly manifest: ConnectorManifest;
  readonly status: "success" | "partial" | "unavailable" | "failed";
  readonly artifacts: readonly ConnectorArtifact[];
  readonly provenance?: Provenance;
  readonly entityCount?: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly missingReason?: string;
}

export interface BootstrapConnector {
  readonly manifest: ConnectorManifest;
  discover(ctx: ConnectorContext): Promise<{ available: boolean; reason?: string; estimatedBytes?: number }>;
  fetch(ctx: ConnectorContext): Promise<ConnectorRunResult>;
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function artifactPath(ctx: ConnectorContext, connectorId: string, filename: string): string {
  const dir = join(ctx.workDir, "raw", connectorId);
  ensureDir(dir);
  return join(dir, filename);
}

export function writeJson(path: string, data: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}
