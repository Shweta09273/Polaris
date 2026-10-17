/**
 * Official .polaris package format constants & manifest schema.
 *
 * This is NOT a ZIP rename. The container is a signed PLRS envelope
 * with a content-addressed payload and explicit compatibility policy.
 */
import { ONTOLOGY_VERSION } from "@polaris/ontology";

/** File magic: ASCII "PLRS" */
export const POLARIS_MAGIC = Buffer.from([0x50, 0x4c, 0x52, 0x53]); // PLRS

/** Wire format major.minor */
export const PACKAGE_FORMAT_VERSION = "1.0" as const;
export const PACKAGE_FORMAT_MAJOR = 1;
export const PACKAGE_FORMAT_MINOR = 0;

/** Runtime / compiler versions that produce packages */
export const COMPILER_VERSION = "0.3.0" as const;
export const RUNTIME_VERSION = "0.3.0" as const;
export const DEFAULT_ONTOLOGY_VERSION = ONTOLOGY_VERSION;

export type CompressionCodec = "gzip" | "identity";
export type SignatureAlgorithm = "hmac-sha256" | "ed25519" | "none";

export type CompatibilityPolicy = {
  /** Minimum runtime major that may load this package */
  readonly minRuntimeMajor: number;
  /** Maximum runtime major (exclusive upper bound optional) */
  readonly maxRuntimeMajor?: number;
  /** Ontology major must match for load */
  readonly requireOntologyMajorMatch: boolean;
  /** Allow loading older city package versions side-by-side */
  readonly allowSideBySide: boolean;
};

export interface LicenseRecord {
  readonly spdx: string;
  readonly attribution: string;
  readonly sourceId: string;
  readonly sourceUrl?: string;
}

export interface ProvenanceSummary {
  readonly datasetKeys: readonly string[];
  readonly licenses: readonly LicenseRecord[];
  readonly bootstrapAoiId?: string;
  readonly workDirHint?: string;
}

export interface PackageChecksums {
  /** sha256 of each content-addressed blob path → hex */
  readonly blobs: Readonly<Record<string, string>>;
  /** sha256 of canonical manifest bytes (excluding signature block) */
  readonly manifestSha256: string;
  /** Merkle-style root over sorted blob hashes */
  readonly contentRootSha256: string;
}

export interface PackageSignature {
  readonly algorithm: SignatureAlgorithm;
  readonly keyId: string;
  /** hex signature / HMAC */
  readonly value: string;
  readonly signedAt: string;
}

export interface IncrementalUpdateInfo {
  readonly baseCityVersion?: string;
  readonly baseContentRootSha256?: string;
  readonly deltaBlobKeys?: readonly string[];
}

export interface PolarisPackageManifest {
  readonly format: typeof PACKAGE_FORMAT_VERSION;
  readonly mediaType: "application/vnd.polaris.package+plrs";
  readonly packageId: string;
  readonly citySlug: string;
  readonly cityDisplayName: string;
  readonly cityVersion: string;
  readonly compilerVersion: string;
  readonly ontologyVersion: string;
  readonly runtimeTarget: string;
  readonly builtAt: string;
  readonly compression: CompressionCodec;
  readonly compatibility: CompatibilityPolicy;
  readonly twinReadinessScore: number;
  readonly cityReadinessScore: number;
  readonly coverage: {
    readonly requiredPresent: number;
    readonly requiredTotal: number;
    readonly optionalPresent: number;
    readonly optionalTotal: number;
  };
  readonly installedSizeBytesEstimate: number;
  readonly dependencies: readonly string[];
  readonly provenance: ProvenanceSummary;
  readonly checksums: PackageChecksums;
  readonly signature: PackageSignature;
  readonly incremental?: IncrementalUpdateInfo;
  readonly entrypoints: {
    readonly twinEntities: string;
    readonly twinEdges: string;
    readonly cityDna: string;
    readonly bootstrapReport: string;
    readonly boundary?: string;
  };
}

export const DEFAULT_COMPATIBILITY: CompatibilityPolicy = {
  minRuntimeMajor: 0,
  maxRuntimeMajor: 1,
  requireOntologyMajorMatch: true,
  allowSideBySide: true,
};

/** Logical layout inside the compressed payload (not a loose zip root). */
export const PACKAGE_LAYOUT = {
  manifest: "manifest.json",
  checksums: "checksums.sha256",
  signature: "signature.json",
  metadata: "metadata/",
  twin: "twin/",
  twinEntities: "twin/entities.json",
  twinEdges: "twin/edges.json",
  cityDna: "metadata/city-dna.json",
  bootstrapReport: "metadata/bootstrap-report.json",
  boundary: "metadata/boundary.geojson",
  provenance: "provenance/",
  blobs: "blobs/", // content-addressed: blobs/sha256/<hex>
} as const;
