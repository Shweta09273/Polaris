export type PolarTheme = "mission-dark" | "aurora-light" | "cosmic-nebula";

export interface ScenarioParamDef {
  key: string;
  label: string;
  type: "number" | "enum" | "boolean";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  default: number | string | boolean;
  description: string;
}

export interface ScenarioItem {
  kind: string;
  name: string;
  description: string;
  hypothesis: string;
  parameters: ScenarioParamDef[];
  requiredLayers: string[];
  optionalLayers: string[];
  metricKeys: string[];
}

export interface StrategyOption {
  id: "A" | "B" | "C";
  name: string;
  objective: string;
  summary: string;
  actions: string[];
  estimatedCostEur: number;
  etaMinutes: number;
  residualRiskScore: number;
  estimatedEffectiveness: number;
  operationalComplexity: number;
  riskReductionPct: number;
  advantages: string[];
  disadvantages: string[];
  tradeoffs: string[];
  targetEntityIds: string[];
  why: string;
  whatData: string[];
  whichAssumptions: string[];
  ontologyEntities: string[];
}

export interface ConfidenceBreakdown {
  dataConfidence: number;
  coverageConfidence: number;
  modelConfidence: number;
  decisionConfidence: number;
  overall: number;
  rationale: string[];
  missingFactors: string[];
}

export interface DecisionBrief {
  id: string;
  experimentId: string;
  resultId: string;
  citySlug: string;
  kind: string;
  createdAt: string;
  executiveSummary: string;
  situation: string;
  overallRisk: string;
  reasoning: string;
  confidence: number;
  confidenceRationale: string;
  confidenceBreakdown?: ConfidenceBreakdown;
  affectedInfrastructure: Array<{ id: string; name: string; kind: string; severity: string }>;
  affectedPopulation: { proxy: number; method: string; note: string };
  economicImpactEstimate: { eur: number; method: string };
  emergencyPriority: string;
  recommendedActions: string[];
  strategies: StrategyOption[];
  strategyComparison: string;
  explainability: {
    why: string;
    whatData: string[];
    whichEntities: string[];
    whichAssumptions: string[];
  ontologyEntities?: string[];
  spatialRelationships?: string[];
  method: string;
  expandable: {
    datasets: Array<{ layer: string; featureCount: number; status: string }>;
    graphReasoning: Array<{ from: string; to: string; mechanism: string; entityIds: string[] }>;
    metricEvidence: Record<string, number>;
  };
};
  warnings: string[];
}

export interface TimelineFrameView {
  phase: "before" | "during" | "after";
  label: string;
  tMinutes: number;
  summary: string;
  intensityFactor: number;
  metricDeltas: Record<string, number>;
}

export interface ExperimentResultView {
  id: string;
  experimentId: string;
  kind: string;
  citySlug: string;
  cityDisplayName: string;
  status: string;
  parameters: Record<string, number | string | boolean>;
  assumptions: string[];
  affectedEntities: Array<{
    id: string;
    name: string;
    kind: string;
    layer: string;
    lon: number;
    lat: number;
    severity: string;
    reason: string;
  }>;
  metrics: Record<string, number>;
  outputLayers: Array<{
    id: string;
    label: string;
    kind: string;
    featureCount: number;
    geojson: {
      type: "FeatureCollection";
      features: Array<Record<string, unknown>>;
    };
  }>;
  riskPropagation: Array<{ from: string; to: string; mechanism: string; entityIds: string[] }>;
  warnings: string[];
  timeline: TimelineFrameView[];
  epicenter: { lon: number; lat: number };
  dataSources: Array<{ layer: string; featureCount: number; status: string; note?: string }>;
}

export interface TwinTelemetry {
  fps: number;
  headingDeg: number;
  heightM: number;
  lon: number;
  lat: number;
  scaleM: number;
}
