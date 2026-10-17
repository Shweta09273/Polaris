import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { createGzip, createGunzip } from "node:zlib";
import { ulid } from "./ulid-lite.js";
import {
  COMPILER_VERSION,
  DEFAULT_COMPATIBILITY,
  DEFAULT_ONTOLOGY_VERSION,
  PACKAGE_FORMAT_MAJOR,
  PACKAGE_FORMAT_MINOR,
  PACKAGE_FORMAT_VERSION,
  PACKAGE_LAYOUT,
  POLARIS_MAGIC,
  RUNTIME_VERSION,
  type CompressionCodec,
  type PackageChecksums,
  type PackageSignature,
  type PolarisPackageManifest,
  type ProvenanceSummary,
} from "./format.js";

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256File(path: string): string {
  return sha256Buffer(readFileSync(path));
}

function contentRoot(blobs: Record<string, string>): string {
  const lines = Object.keys(blobs)
    .sort()
    .map((k) => `${blobs[k]}  ${k}`)
    .join("\n");
  return sha256Buffer(Buffer.from(lines, "utf8"));
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  if (existsSync(root)) walk(root);
  return out;
}

/** Minimal tar-like archive: concatenated framed entries (path + length + bytes). */
function packFramed(files: Array<{ path: string; data: Buffer }>): Buffer {
  const chunks: Buffer[] = [];
  for (const f of files) {
    const pathBuf = Buffer.from(f.path.replace(/\\/g, "/"), "utf8");
    const header = Buffer.alloc(8);
    header.writeUInt32BE(pathBuf.length, 0);
    header.writeUInt32BE(f.data.length, 4);
    chunks.push(header, pathBuf, f.data);
  }
  return Buffer.concat(chunks);
}

function unpackFramed(buf: Buffer, opts?: { maxEntries?: number; maxTotalBytes?: number }): Array<{ path: string; data: Buffer }> {
  const maxEntries = opts?.maxEntries ?? 50_000;
  const maxTotalBytes = opts?.maxTotalBytes ?? 2 * 1024 * 1024 * 1024; // 2 GiB
  const out: Array<{ path: string; data: Buffer }> = [];
  let offset = 0;
  let total = 0;
  while (offset + 8 <= buf.length) {
    if (out.length >= maxEntries) {
      throw new Error("Package rejected: too many framed entries (possible bomb)");
    }
    const pathLen = buf.readUInt32BE(offset);
    const dataLen = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (pathLen > 4096 || dataLen < 0 || offset + pathLen + dataLen > buf.length) {
      throw new Error("Package rejected: corrupt frame header");
    }
    total += dataLen;
    if (total > maxTotalBytes) {
      throw new Error("Package rejected: uncompressed payload exceeds size limit");
    }
    const path = buf.subarray(offset, offset + pathLen).toString("utf8");
    offset += pathLen;
    if (path.includes("..") || path.startsWith("/") || path.includes("\0")) {
      throw new Error(`Package rejected: unsafe path ${path}`);
    }
    const data = Buffer.from(buf.subarray(offset, offset + dataLen));
    offset += dataLen;
    out.push({ path, data });
  }
  return out;
}

async function gzipBuffer(input: Buffer): Promise<Buffer> {
  const gzip = createGzip({ level: 9 });
  const chunks: Buffer[] = [];
  gzip.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve, reject) => {
    gzip.on("end", () => resolve(Buffer.concat(chunks)));
    gzip.on("error", reject);
  });
  gzip.end(input);
  return done;
}

async function gunzipBuffer(input: Buffer): Promise<Buffer> {
  const gunzip = createGunzip();
  const chunks: Buffer[] = [];
  gunzip.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve, reject) => {
    gunzip.on("end", () => resolve(Buffer.concat(chunks)));
    gunzip.on("error", reject);
  });
  gunzip.end(input);
  return done;
}

export interface PackInput {
  readonly citySlug: string;
  readonly cityDisplayName: string;
  readonly cityVersion?: string;
  readonly twinDir: string; // contains entities.json, edges.json
  readonly cityDnaPath: string;
  readonly bootstrapReportPath: string;
  readonly boundaryPath?: string;
  readonly provenanceDir?: string;
  readonly twinReadinessScore: number;
  readonly cityReadinessScore: number;
  readonly coverage: PolarisPackageManifest["coverage"];
  readonly provenance: ProvenanceSummary;
  readonly signingSecret?: string; // HMAC key; if absent signature.algorithm=none with empty value (dev only)
  readonly outPath: string;
  readonly compression?: CompressionCodec;
}

export async function packCity(input: PackInput): Promise<PolarisPackageManifest> {
  const compression: CompressionCodec = input.compression ?? "gzip";
  const stagingFiles: Array<{ path: string; data: Buffer }> = [];
  const blobHashes: Record<string, string> = {};

  const addFile = (logicalPath: string, absPath: string) => {
    const data = readFileSync(absPath);
    const hash = sha256Buffer(data);
    const casPath = `${PACKAGE_LAYOUT.blobs}sha256/${hash}`;
    stagingFiles.push({ path: casPath, data });
    stagingFiles.push({ path: logicalPath, data }); // convenience path for runtime
    blobHashes[casPath] = hash;
    blobHashes[logicalPath] = hash;
  };

  addFile(PACKAGE_LAYOUT.twinEntities, join(input.twinDir, "entities.json"));
  addFile(PACKAGE_LAYOUT.twinEdges, join(input.twinDir, "edges.json"));
  addFile(PACKAGE_LAYOUT.cityDna, input.cityDnaPath);
  addFile(PACKAGE_LAYOUT.bootstrapReport, input.bootstrapReportPath);
  if (input.boundaryPath && existsSync(input.boundaryPath)) {
    addFile(PACKAGE_LAYOUT.boundary, input.boundaryPath);
  }
  if (input.provenanceDir && existsSync(input.provenanceDir)) {
    for (const f of walkFiles(input.provenanceDir)) {
      const rel = relative(input.provenanceDir, f).split(sep).join("/");
      addFile(`${PACKAGE_LAYOUT.provenance}${rel}`, f);
    }
  }

  const packageId = ulid();
  const cityVersion = input.cityVersion ?? `1.0.0+${new Date().toISOString().slice(0, 10)}`;
  const contentRootSha256 = contentRoot(blobHashes);

  const manifestDraft: Omit<PolarisPackageManifest, "checksums" | "signature"> = {
    format: PACKAGE_FORMAT_VERSION,
    mediaType: "application/vnd.polaris.package+plrs",
    packageId,
    citySlug: input.citySlug,
    cityDisplayName: input.cityDisplayName,
    cityVersion,
    compilerVersion: COMPILER_VERSION,
    ontologyVersion: DEFAULT_ONTOLOGY_VERSION,
    runtimeTarget: RUNTIME_VERSION,
    builtAt: new Date().toISOString(),
    compression,
    compatibility: DEFAULT_COMPATIBILITY,
    twinReadinessScore: input.twinReadinessScore,
    cityReadinessScore: input.cityReadinessScore,
    coverage: input.coverage,
    installedSizeBytesEstimate: stagingFiles.reduce((n, f) => n + f.data.length, 0),
    dependencies: ["@polaris/ontology@" + DEFAULT_ONTOLOGY_VERSION, "@polaris/runtime@" + RUNTIME_VERSION],
    provenance: input.provenance,
    entrypoints: {
      twinEntities: PACKAGE_LAYOUT.twinEntities,
      twinEdges: PACKAGE_LAYOUT.twinEdges,
      cityDna: PACKAGE_LAYOUT.cityDna,
      bootstrapReport: PACKAGE_LAYOUT.bootstrapReport,
      boundary: input.boundaryPath ? PACKAGE_LAYOUT.boundary : undefined,
    },
  };

  const manifestWithoutSig = {
    ...manifestDraft,
    checksums: {
      blobs: blobHashes,
      manifestSha256: "", // filled after
      contentRootSha256,
    } satisfies PackageChecksums,
  };

  const manifestForHash = Buffer.from(
    JSON.stringify({ ...manifestWithoutSig, signature: undefined }),
    "utf8",
  );
  const manifestSha256 = sha256Buffer(manifestForHash);

  const checksums: PackageChecksums = {
    blobs: blobHashes,
    manifestSha256,
    contentRootSha256,
  };

  let signature: PackageSignature;
  if (input.signingSecret) {
    const hmac = createHmac("sha256", input.signingSecret)
      .update(manifestSha256)
      .update(contentRootSha256)
      .digest("hex");
    signature = {
      algorithm: "hmac-sha256",
      keyId: "local-hmac",
      value: hmac,
      signedAt: new Date().toISOString(),
    };
  } else {
    signature = {
      algorithm: "none",
      keyId: "unsigned-dev",
      value: "",
      signedAt: new Date().toISOString(),
    };
  }

  const manifest: PolarisPackageManifest = {
    ...manifestDraft,
    checksums,
    signature,
  };

  stagingFiles.push({
    path: PACKAGE_LAYOUT.manifest,
    data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
  });
  stagingFiles.push({
    path: PACKAGE_LAYOUT.checksums,
    data: Buffer.from(
      Object.entries(blobHashes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([p, h]) => `${h}  ${p}`)
        .join("\n") + "\n",
      "utf8",
    ),
  });
  stagingFiles.push({
    path: PACKAGE_LAYOUT.signature,
    data: Buffer.from(JSON.stringify(signature, null, 2), "utf8"),
  });

  const framed = packFramed(stagingFiles);
  const payload = compression === "gzip" ? await gzipBuffer(framed) : framed;

  // Envelope: MAGIC(4) + major(1) + minor(1) + flags(1) + reserved(1) + headerLen(4) + headerJson + payload
  const headerJson = Buffer.from(
    JSON.stringify({
      format: PACKAGE_FORMAT_VERSION,
      packageId,
      citySlug: input.citySlug,
      cityVersion,
      compression,
      contentRootSha256,
      manifestSha256,
      signatureAlgorithm: signature.algorithm,
    }),
    "utf8",
  );

  const envelope = Buffer.alloc(12 + headerJson.length + payload.length);
  POLARIS_MAGIC.copy(envelope, 0);
  envelope.writeUInt8(PACKAGE_FORMAT_MAJOR, 4);
  envelope.writeUInt8(PACKAGE_FORMAT_MINOR, 5);
  envelope.writeUInt8(compression === "gzip" ? 1 : 0, 6); // flags
  envelope.writeUInt8(0, 7);
  envelope.writeUInt32BE(headerJson.length, 8);
  headerJson.copy(envelope, 12);
  payload.copy(envelope, 12 + headerJson.length);

  ensureDir(dirname(input.outPath));
  writeFileSync(input.outPath, envelope);
  return manifest;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly header?: Record<string, unknown>;
  readonly manifest?: PolarisPackageManifest;
}

export async function verifyPackageFile(
  packagePath: string,
  opts?: { signingSecret?: string; allowUnsigned?: boolean },
): Promise<VerifyResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const buf = readFileSync(packagePath);

  if (buf.length < 12 || !buf.subarray(0, 4).equals(POLARIS_MAGIC)) {
    return {
      ok: false,
      errors: ["Not a POLARIS package: bad magic (expected PLRS envelope, not ZIP)"],
      warnings,
    };
  }

  const major = buf.readUInt8(4);
  const minor = buf.readUInt8(5);
  if (major !== PACKAGE_FORMAT_MAJOR) {
    errors.push(`Incompatible format major ${major} (runtime expects ${PACKAGE_FORMAT_MAJOR})`);
  }
  const headerLen = buf.readUInt32BE(8);
  const headerJson = buf.subarray(12, 12 + headerLen).toString("utf8");
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(headerJson) as Record<string, unknown>;
  } catch {
    return { ok: false, errors: ["Corrupt package header JSON"], warnings };
  }

  const flagGzip = buf.readUInt8(6) === 1;
  const payload = buf.subarray(12 + headerLen);
  let framed: Buffer;
  try {
    framed = flagGzip ? await gunzipBuffer(payload) : payload;
  } catch {
    return { ok: false, errors: ["Payload decompression failed — package may be corrupt"], warnings };
  }

  let files: Array<{ path: string; data: Buffer }>;
  try {
    files = unpackFramed(framed);
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "Framed payload rejected"],
      warnings,
    };
  }
  const byPath = new Map(files.map((f) => [f.path, f.data]));
  const manifestRaw = byPath.get(PACKAGE_LAYOUT.manifest);
  if (!manifestRaw) {
    return { ok: false, errors: ["Missing manifest.json in payload"], warnings };
  }

  let manifest: PolarisPackageManifest;
  try {
    manifest = JSON.parse(manifestRaw.toString("utf8")) as PolarisPackageManifest;
  } catch {
    return { ok: false, errors: ["manifest.json is not valid JSON"], warnings };
  }

  // Recompute blob hashes
  for (const [path, expected] of Object.entries(manifest.checksums.blobs)) {
    const data = byPath.get(path);
    if (!data) {
      errors.push(`Missing blob path: ${path}`);
      continue;
    }
    const actual = sha256Buffer(data);
    if (actual !== expected) {
      errors.push(`Checksum mismatch for ${path}`);
    }
  }

  const recomputedRoot = contentRoot(manifest.checksums.blobs);
  if (recomputedRoot !== manifest.checksums.contentRootSha256) {
    errors.push("contentRootSha256 mismatch — tamper detected");
  }

  if (header.contentRootSha256 && header.contentRootSha256 !== manifest.checksums.contentRootSha256) {
    errors.push("Header contentRoot does not match manifest");
  }

  // Signature
  if (manifest.signature.algorithm === "none") {
    if (!opts?.allowUnsigned) {
      warnings.push("Package is unsigned (dev). Set POLARIS_PACKAGE_HMAC_SECRET for HMAC signing.");
    }
  } else if (manifest.signature.algorithm === "hmac-sha256") {
    if (!opts?.signingSecret) {
      errors.push("HMAC-signed package requires signingSecret to verify");
    } else {
      const expected = createHmac("sha256", opts.signingSecret)
        .update(manifest.checksums.manifestSha256)
        .update(manifest.checksums.contentRootSha256)
        .digest("hex");
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(manifest.signature.value, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        errors.push("HMAC signature verification failed — package rejected");
      }
    }
  } else if (manifest.signature.algorithm === "ed25519") {
    warnings.push("ed25519 verification reserved — provide public key material in M3.1");
  }

  // Compatibility
  if (manifest.compatibility.requireOntologyMajorMatch) {
    const pkgOntMajor = Number(manifest.ontologyVersion.split(".")[0] ?? 0);
    const runtimeOntMajor = Number(DEFAULT_ONTOLOGY_VERSION.split(".")[0] ?? 0);
    if (pkgOntMajor !== runtimeOntMajor) {
      errors.push(
        `Ontology major mismatch: package ${manifest.ontologyVersion} vs runtime ${DEFAULT_ONTOLOGY_VERSION}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    header,
    manifest,
  };
}

export interface UnpackResult {
  readonly mountDir: string;
  readonly manifest: PolarisPackageManifest;
}

export async function unpackPackage(
  packagePath: string,
  mountDir: string,
  opts?: { signingSecret?: string; allowUnsigned?: boolean },
): Promise<UnpackResult> {
  const verified = await verifyPackageFile(packagePath, opts);
  if (!verified.ok || !verified.manifest) {
    throw new Error(`Package validation failed:\n${verified.errors.join("\n")}`);
  }

  const buf = readFileSync(packagePath);
  const headerLen = buf.readUInt32BE(8);
  const flagGzip = buf.readUInt8(6) === 1;
  const payload = buf.subarray(12 + headerLen);
  const framed = flagGzip ? await gunzipBuffer(payload) : payload;
  const files = unpackFramed(framed);

  ensureDir(mountDir);
  for (const f of files) {
    const dest = join(mountDir, f.path);
    ensureDir(dirname(dest));
    writeFileSync(dest, f.data);
  }

  return { mountDir, manifest: verified.manifest };
}

export function isPolarisPackageFile(path: string): boolean {
  if (!existsSync(path) || !path.endsWith(".polaris")) return false;
  const fd = readFileSync(path);
  return fd.length >= 4 && fd.subarray(0, 4).equals(POLARIS_MAGIC);
}
