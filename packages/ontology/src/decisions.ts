/**
 * Decision model — recommendations as first-class graph objects.
 * Implementation of ranking/ML is deferred; schema is canonical now.
 */

export type DecisionStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "cancelled"
  | "expired";

export interface DecisionCost {
  readonly currency: string;
  readonly amount: number;
  readonly components?: Readonly<Record<string, number>>;
}

export interface DecisionObject {
  readonly id: string;
  readonly twinScopeId: string;
  readonly objective: string;
  readonly status: DecisionStatus;
  readonly actionIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly expectedOutcomeIds: readonly string[];
  readonly confidence: number; // 0..1
  readonly riskScore: number; // 0..100
  readonly cost: DecisionCost;
  readonly etaMinutes: number;
  readonly explanationId: string;
  readonly evaluationId?: string;
  readonly evidenceEntityIds: readonly string[];
  readonly evidenceDatasetVersionIds: readonly string[];
  readonly createdAt: string;
  readonly createdBy: string; // user or system principal
}

export interface ActionObject {
  readonly id: string;
  readonly actionType: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly targetEntityIds: readonly string[];
  readonly usesResourceIds: readonly string[];
  readonly status: DecisionStatus;
}

export interface ExpectedOutcomeObject {
  readonly id: string;
  readonly metricKeys: readonly string[];
  readonly expectedValues: Readonly<Record<string, number>>;
  readonly horizonMinutes: number;
  readonly confidence: number;
}

export interface ExplanationObject {
  readonly id: string;
  readonly narrative: string;
  readonly citationIds: readonly string[]; // entity / dataset / experiment ids
  readonly method: "rules" | "graph_reasoning" | "human" | "hybrid" | "model_deferred";
}

export interface EvaluationObject {
  readonly id: string;
  readonly decisionOrExperimentId: string;
  readonly scores: Readonly<Record<string, number>>;
  readonly comparedToId?: string;
  readonly notes: string;
  readonly evaluatedAt: string;
}

export const DECISION_CHAIN = [
  "Decision",
  "Action",
  "Resource",
  "ExpectedOutcome",
  "Confidence",
  "Risk",
  "Cost",
  "Time",
  "Explanation",
  "Evaluation",
] as const;

export const DECISION_BUSINESS_RULES = [
  "A Decision without Explanation is invalid for operator presentation.",
  "A Decision without evidence links (entities or DatasetVersions) is invalid.",
  "Confidence and risk are mandatory numeric fields — no silent defaults pretending certainty.",
  "Actions must ACTS_ON real twin entities or declared TwinScope.",
  "ML/LLM methods may populate Explanation later; schema does not require them now.",
] as const;
