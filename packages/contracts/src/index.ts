/**
 * Cross-service contracts (events + HTTP DTOs).
 * Keep in sync with OpenAPI as it evolves in Milestone 2.
 */

import type { AssetType, BoundingBox, LicenseSpdx } from "@polaris/domain";

export interface HealthResponse {
  readonly status: "ok" | "degraded" | "down";
  readonly service: string;
  readonly version: string;
  readonly features: {
    readonly simulation: boolean;
    readonly decisionEngine: boolean;
    readonly experiments: boolean;
  };
  readonly time: string;
}

export interface DatasetCatalogItemDto {
  readonly datasetKey: string;
  readonly displayName: string;
  readonly domains: AssetType[];
  readonly license: LicenseSpdx;
  readonly accessMode: string;
  readonly requiresCredentials: boolean;
  readonly publishedVersions: number;
  readonly notes: string;
}

export interface CreateAoiRequest {
  readonly workspaceId: string;
  readonly name: string;
  readonly bbox: BoundingBox;
}

export type DomainEventType =
  | "catalog.dataset_version.published"
  | "catalog.dataset_version.quarantined"
  | "twin.asset.upserted"
  | "graph.edge.upserted"
  | "ingest.job.completed"
  | "ingest.job.failed";

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: DomainEventType;
  readonly occurredAt: string;
  readonly workspaceId?: string;
  readonly aoiId?: string;
  readonly payload: TPayload;
}
