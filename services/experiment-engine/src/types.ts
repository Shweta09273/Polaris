/**
 * Digital Experiment Engine — shared types (V1).
 * Every metric and entity must originate from twin layers or documented assumptions.
 */

import type { Feature, FeatureCollection, Geometry } from "geojson";

export type ExperimentKind =
  | "heavy_rain"
  | "road_closure"
  | "building_fire"
  | "power_failure"
  | "medical_emergency"
  | "extreme_heat"
  | "water_pipeline_failure";

export type Severity = "low" | "medium" | "high" | "critical";
export type TimelinePhase = "before" | "during" | "after";

export interface ExperimentParameterDef {
  readonly key: string;
  readonly label: string;
  readonly type: "number" | "enum" | "boolean";
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly string[];
  readonly default: number | string | boolean;
  readonly description: string;
}

export interface ScenarioCatalogItem {
  readonly kind: ExperimentKind;
  readonly name: string;
  readonly description: string;
  readonly hypothesis: string;
  readonly parameters: readonly ExperimentParameterDef[];
  readonly requiredLayers: readonly string[];
  readonly optionalLayers: readonly string[];
  readonly metricKeys: readonly string[];
}

export interface AffectedEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly layer: string;
  readonly lon: number;
  readonly lat: number;
  readonly severity: Severity;
  readonly reason: string;
}

export interface RiskEdge {
  readonly from: string;
  readonly to: string;
  readonly mechanism: string;
  readonly entityIds: readonly string[];
}

export interface OutputLayer {
  readonly id: string;
  readonly label: string;
  readonly kind: "polygon" | "line" | "point" | "heatmap";
  readonly featureCount: number;
  readonly geojson: FeatureCollection;
}

export interface TimelineFrame {
  readonly phase: TimelinePhase;
  readonly label: string;
  readonly tMinutes: number;
  readonly summary: string;
  readonly intensityFactor: number;
  readonly metricDeltas: Readonly<Record<string, number>>;
}

export interface DataSourceUsed {
  readonly layer: string;
  readonly featureCount: number;
  readonly status: "ready" | "partial" | "missing";
  readonly note?: string;
}

export interface ExperimentResult {
  readonly id: string;
  readonly experimentId: string;
  readonly kind: ExperimentKind;
  readonly citySlug: string;
  readonly cityDisplayName: string;
  readonly status: "succeeded" | "failed";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly parameters: Readonly<Record<string, number | string | boolean>>;
  readonly assumptions: readonly string[];
  readonly dataSources: readonly DataSourceUsed[];
  readonly affectedEntities: readonly AffectedEntity[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly outputLayers: readonly OutputLayer[];
  readonly riskPropagation: readonly RiskEdge[];
  readonly warnings: readonly string[];
  readonly timeline: readonly TimelineFrame[];
  readonly epicenter: { readonly lon: number; readonly lat: number };
}

export interface RunExperimentRequest {
  readonly citySlug: string;
  readonly kind: ExperimentKind;
  readonly parameters?: Readonly<Record<string, number | string | boolean>>;
  /** Optional map click epicenter; defaults to twin camera center */
  readonly epicenter?: { readonly lon: number; readonly lat: number };
}

export interface TwinFeatureIndex {
  readonly scene: {
    citySlug: string;
    cityDisplayName: string;
    camera: { lon: number; lat: number; height: number };
    layers: Array<{ id: string; status: string; featureCount: number; note?: string }>;
    missing: string[];
  };
  readonly buildings: Feature[];
  readonly roads: Feature[];
  readonly pois: Feature[];
  readonly vegetation: Feature[];
  readonly water: Feature[];
  readonly heightmap: {
    cols: number;
    rows: number;
    west: number;
    south: number;
    east: number;
    north: number;
    heights: number[];
  } | null;
}

export type FeatureGeom = Feature<Geometry>;
