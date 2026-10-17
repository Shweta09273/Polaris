/**
 * Experiment model — Digital Experiments (not bare simulation jobs).
 * Execution engines are future milestones; ontology is SSOT now.
 */

export type ExperimentStatus =
  | "draft"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "compared";

export interface ExperimentVariable {
  readonly key: string;
  readonly value: number | string | boolean;
  readonly unit?: string;
  readonly description: string;
}

export interface ExperimentDefinition {
  readonly id: string;
  readonly twinScopeId: string;
  readonly hypothesis: string;
  readonly scenarioId: string;
  readonly initialSnapshotId: string;
  readonly variables: readonly ExperimentVariable[];
  readonly actionIds: readonly string[];
  readonly timelineIntervalId: string;
  readonly metricKeys: readonly string[];
  readonly status: ExperimentStatus;
  readonly confidence?: number;
  readonly resultId?: string;
  readonly comparisonBaselineId?: string;
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly assumptions: readonly string[];
  readonly variables: readonly ExperimentVariable[];
  readonly eventSeeds: readonly string[]; // event type keys or templates
}

export interface ExperimentResultObject {
  readonly id: string;
  readonly experimentId: string;
  readonly metrics: Readonly<Record<string, number>>;
  readonly artifactsUri: string;
  readonly confidence: number;
  readonly completedAt: string;
  readonly notes: string;
}

export const EXPERIMENT_BUSINESS_RULES = [
  "Every Experiment INITIALIZES from a real TwinSnapshot — never an empty fictional city.",
  "Assumptions are first-class; hidden synthetic inputs are forbidden.",
  "Metrics must reference MetricDefinition keys.",
  "Comparison requires an explicit baseline Experiment or observed CityState.",
  "Simulation solvers plug in later; ontology remains stable.",
] as const;
