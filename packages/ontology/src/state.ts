/**
 * Dynamic City State Model — every twin entity carries versioned state facets.
 */

export const STATE_KINDS = ["current", "historical", "predicted", "risk"] as const;
export type StateKind = (typeof STATE_KINDS)[number];

export interface Confidence {
  readonly value: number; // 0..1
  readonly method: "sensor" | "model" | "ingest" | "expert" | "derived" | "unknown";
  readonly notes?: string;
}

export interface HealthScore {
  readonly value: number; // 0..100
  readonly components?: Readonly<Record<string, number>>;
}

export interface RiskState {
  readonly score: number; // 0..100
  readonly likelihood: number; // 0..1
  readonly consequence: number; // 0..100
  readonly hazardKeys: readonly string[];
  readonly horizon: "immediate" | "near" | "medium" | "long";
}

export interface EntityStateVector {
  readonly entityId: string;
  readonly entityKind: string;
  readonly stateKind: StateKind;
  readonly version: number;
  readonly observedAt: string; // ISO-8601
  readonly validFrom: string;
  readonly validTo?: string;
  readonly variables: Readonly<Record<string, number | string | boolean | null>>;
  readonly health: HealthScore;
  readonly risk: RiskState;
  readonly confidence: Confidence;
  readonly dependencyIds: readonly string[];
  readonly datasetVersionId?: string;
  readonly twinSnapshotId?: string;
}

export interface CityState {
  readonly twinScopeId: string;
  readonly epochId: string;
  readonly asOf: string;
  readonly snapshotId: string;
  readonly coverageRatio: number; // 0..1 entities with current state
  readonly aggregateHealth: HealthScore;
  readonly aggregateRisk: RiskState;
  readonly confidence: Confidence;
  readonly openEventIds: readonly string[];
  readonly notes: string;
}

export const STATE_BUSINESS_RULES = [
  "Every physical EntityKind instance SHOULD have a current EntityState when published to operators.",
  "predicted and risk states MUST declare confidence.method and horizon.",
  "historical states are immutable; corrections SUPERSEDE via new version.",
  "health_score 0..100; null health is forbidden on current state — use unknown components instead.",
  "dependencyIds list immediate DEPENDS_ON / POWERS / SUPPLIES neighbors for cascade UI.",
  "CityState is derived — never hand-authored without TwinSnapshot backing.",
] as const;
