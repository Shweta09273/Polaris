/**
 * POLARIS domain core — pure types and ports.
 * No framework imports. No I/O.
 *
 * Semantic vocabulary (EntityKind, RelationType, state/events/…) lives in
 * `@polaris/ontology` and is re-exported here for application convenience.
 */

export type {
  EntityKind,
  RelationType,
  UrbanDomain,
  StateKind,
  EventType,
  ResourceClass,
  DecisionStatus,
  ExperimentStatus,
} from "@polaris/ontology";

export {
  ONTOLOGY_VERSION,
  ONTOLOGY_NAME,
  ENTITY_KINDS,
  RELATION_TYPES,
  URBAN_DOMAINS,
  ASSET_TYPE_TO_ENTITY_KIND,
  isEntityKind,
  isRelationType,
} from "@polaris/ontology";

import type { EntityKind, RelationType } from "@polaris/ontology";

export type Ulid = string & { readonly __brand: "Ulid" };
export type IsoDateTime = string & { readonly __brand: "IsoDateTime" };

export type LicenseSpdx =
  | "ODbL-1.0"
  | "CC-BY-4.0"
  | "CDLA-Permissive-2.0"
  | "Apache-2.0"
  | "Copernicus"
  | "Public-Domain"
  | "Proprietary-Partner"
  | "Unknown-Needs-Review";

export type AccessMode = "api" | "bulk_download" | "stac" | "s3" | "manual" | "partner";

/**
 * @deprecated Milestone 1 coarse ingest tags. Prefer `EntityKind`.
 * Mapping: ASSET_TYPE_TO_ENTITY_KIND in @polaris/ontology.
 */
export type AssetType =
  | "road"
  | "building"
  | "hospital"
  | "school"
  | "police_station"
  | "fire_station"
  | "admin_boundary"
  | "population_cell"
  | "elevation_tile"
  | "drainage"
  | "waterway"
  | "weather_station"
  | "aqi_station"
  | "metro_line"
  | "transit_stop"
  | "railway"
  | "airport"
  | "utility_node"
  | "utility_link"
  | "flood_zone"
  | "land_use_cell"
  | "imagery_scene"
  | "disaster_event"
  | "traffic_segment"
  | "unknown";

export interface BoundingBox {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
  readonly crs: "EPSG:4326";
}

export interface Provenance {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly license: LicenseSpdx;
  readonly attribution: string;
  readonly accessMode: AccessMode;
  readonly retrievedAt: IsoDateTime;
  readonly sourceVersion?: string;
  readonly sourceUrl?: string;
}

export interface DatasetVersion {
  readonly id: Ulid;
  readonly datasetKey: string;
  readonly aoiId: Ulid;
  readonly versionLabel: string;
  readonly provenance: Provenance;
  readonly contentHash: string;
  readonly storageUri: string;
  readonly status: "raw" | "validated" | "published" | "quarantined" | "retired";
  readonly createdAt: IsoDateTime;
}

export interface Asset {
  readonly id: Ulid;
  readonly aoiId: Ulid;
  /** @deprecated Prefer entityKind */
  readonly type: AssetType;
  /** Canonical ontology kind when known */
  readonly entityKind?: EntityKind;
  readonly name?: string;
  readonly externalIds: Readonly<Record<string, string>>;
  readonly datasetVersionId: Ulid;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** Canonical graph relationship type from Urban Ontology. */
export type GraphRelationType = RelationType;

/** @deprecated Use CONNECTED_TO from ontology RelationType */
export type LegacyGraphRelationAlias = "CONNECTS";

export const LEGACY_RELATION_TO_ONTOLOGY = {
  CONNECTS: "CONNECTED_TO",
} as const satisfies Record<LegacyGraphRelationAlias, RelationType>;

export interface GraphEdge {
  readonly id: Ulid;
  readonly type: GraphRelationType;
  readonly fromAssetId: Ulid;
  readonly toAssetId: Ulid;
  readonly datasetVersionId: Ulid;
  readonly weight?: number;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface Aoi {
  readonly id: Ulid;
  readonly workspaceId: Ulid;
  readonly name: string;
  readonly bbox: BoundingBox;
  readonly adminBoundaryDatasetVersionId?: Ulid;
  readonly createdAt: IsoDateTime;
}

export interface ConnectorManifest {
  readonly id: string;
  readonly displayName: string;
  readonly domains: readonly AssetType[];
  readonly license: LicenseSpdx;
  readonly attribution: string;
  readonly homepage: string;
  readonly accessMode: AccessMode;
  readonly requiresCredentials: boolean;
  readonly credentialEnvKeys: readonly string[];
  readonly updateCadence: string;
  readonly notes: string;
}

export interface ConnectorFetchRequest {
  readonly aoi: Aoi;
  readonly bbox: BoundingBox;
  readonly since?: IsoDateTime;
}

export interface ConnectorFetchResult {
  readonly manifest: ConnectorManifest;
  readonly objects: readonly {
    readonly relativeKey: string;
    readonly mediaType: string;
    readonly bytes?: Uint8Array;
    readonly remoteUri?: string;
  }[];
  readonly provenance: Provenance;
}

/**
 * Port every public/partner source must implement.
 * Implementations live in services/connectors/* adapters.
 */
export interface DatasetConnectorPort {
  readonly manifest: ConnectorManifest;
  discover(request: ConnectorFetchRequest): Promise<{ estimatedBytes?: number; available: boolean; reason?: string }>;
  fetch(request: ConnectorFetchRequest): Promise<ConnectorFetchResult>;
  validate(result: ConnectorFetchResult): Promise<{ ok: boolean; errors: string[] }>;
}

/** Simulation is intentionally unavailable until twin data exists. */
export interface SimulationPort {
  isEnabled(): boolean;
  listCapabilities(): readonly string[];
}

/** Decision engine is intentionally unavailable until simulation + features exist. */
export interface DecisionEnginePort {
  isEnabled(): boolean;
  listCapabilities(): readonly string[];
}

export interface UtilityNetworkPort {
  /** Partner/government only — no global public source. */
  isConfigured(): boolean;
}

export interface TrafficFeedPort {
  /** Commercial or city ITS — no free global real-time source. */
  isConfigured(): boolean;
}

export interface EmergencyOperationsPort {
  /** CAD/AVL — not public. */
  isConfigured(): boolean;
}

export class FeatureNotReadyError extends Error {
  constructor(feature: string, milestone: string) {
    super(`${feature} is not enabled until ${milestone}. No mock implementation is provided.`);
    this.name = "FeatureNotReadyError";
  }
}

export class MissingDatasetError extends Error {
  constructor(datasetKey: string, detail: string) {
    super(`Dataset '${datasetKey}' is unavailable: ${detail}`);
    this.name = "MissingDatasetError";
  }
}
