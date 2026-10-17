/**
 * Decision Intelligence — analyses experiment outputs only.
 * Never fabricates entities, metrics, or spatial facts.
 */

import { randomUUID } from "node:crypto";
import type { ExperimentResult } from "@polaris/experiment-engine";

export interface StrategyOption {
  readonly id: "A" | "B" | "C";
  readonly name: string;
  readonly objective: "lowest_cost" | "fastest" | "lowest_risk";
  readonly summary: string;
  readonly actions: readonly string[];
  readonly estimatedCostEur: number;
  readonly etaMinutes: number;
  readonly residualRiskScore: number;
  readonly estimatedEffectiveness: number; // 0..100
  readonly operationalComplexity: number; // 0..100
  readonly riskReductionPct: number; // 0..100
  readonly advantages: readonly string[];
  readonly disadvantages: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly targetEntityIds: readonly string[];
  readonly why: string;
  readonly whatData: readonly string[];
  readonly whichAssumptions: readonly string[];
  readonly ontologyEntities: readonly string[];
}

export interface ConfidenceBreakdown {
  readonly dataConfidence: number;
  readonly coverageConfidence: number;
  readonly modelConfidence: number;
  readonly decisionConfidence: number;
  readonly overall: number;
  readonly rationale: readonly string[];
  readonly missingFactors: readonly string[];
}

export interface ExplainabilityBlock {
  readonly why: string;
  readonly whatData: readonly string[];
  readonly whichEntities: readonly string[];
  readonly whichAssumptions: readonly string[];
  readonly ontologyEntities: readonly string[];
  readonly spatialRelationships: readonly string[];
  readonly method: "rules_over_experiment_outputs";
  readonly expandable: {
    readonly datasets: readonly { layer: string; featureCount: number; status: string }[];
    readonly graphReasoning: readonly {
      from: string;
      to: string;
      mechanism: string;
      entityIds: readonly string[];
    }[];
    readonly metricEvidence: Readonly<Record<string, number>>;
  };
}

export interface DecisionBrief {
  readonly id: string;
  readonly experimentId: string;
  readonly resultId: string;
  readonly citySlug: string;
  readonly kind: string;
  readonly createdAt: string;
  readonly executiveSummary: string;
  readonly situation: string;
  readonly overallRisk: "low" | "moderate" | "high" | "severe";
  readonly reasoning: string;
  readonly confidence: number;
  readonly confidenceRationale: string;
  readonly confidenceBreakdown: ConfidenceBreakdown;
  readonly affectedInfrastructure: readonly {
    id: string;
    name: string;
    kind: string;
    severity: string;
  }[];
  readonly affectedPopulation: {
    readonly proxy: number;
    readonly method: string;
    readonly note: string;
  };
  readonly economicImpactEstimate: {
    readonly eur: number;
    readonly method: string;
  };
  readonly emergencyPriority: "P1" | "P2" | "P3" | "P4";
  readonly recommendedActions: readonly string[];
  readonly strategies: readonly StrategyOption[];
  readonly strategyComparison: string;
  readonly explainability: ExplainabilityBlock;
  readonly warnings: readonly string[];
}

function priorityFromMetrics(result: ExperimentResult): "P1" | "P2" | "P3" | "P4" {
  const critical = result.affectedEntities.filter((e) => e.severity === "critical").length;
  const hospitals = result.affectedEntities.filter((e) => e.kind === "hospital").length;
  const m = result.metrics;
  if (hospitals > 0 || critical >= 5 || (m.incident_severity ?? 0) >= 3) return "P1";
  if (critical >= 1 || (m.buildings_affected ?? m.buildings_without_power ?? 0) > 80) return "P2";
  if ((m.roads_closed ?? m.roads_affected ?? 0) > 10) return "P3";
  return "P4";
}

function overallRisk(result: ExperimentResult, priority: string): "low" | "moderate" | "high" | "severe" {
  if (priority === "P1") return "severe";
  if (priority === "P2") return "high";
  if (priority === "P3") return "moderate";
  return "low";
}

function buildConfidence(result: ExperimentResult): ConfidenceBreakdown {
  const ready = result.dataSources.filter((d) => d.status === "ready");
  const missing = result.dataSources.filter((d) => d.status === "missing");
  const totalLayers = Math.max(1, result.dataSources.length);
  const coverage = ready.length / totalLayers;

  let dataConfidence = 0.55 + coverage * 0.4;
  const rationale: string[] = [
    `Data confidence from twin layer readiness (${ready.length}/${totalLayers} ready).`,
  ];
  const missingFactors: string[] = missing.map(
    (m) => `${m.layer} missing/empty — reduces data & coverage confidence`,
  );

  if (!result.dataSources.find((d) => d.layer === "terrain" && d.status === "ready")) {
    dataConfidence -= 0.08;
    missingFactors.push("DEM/terrain unavailable — elevation & slope analysis degraded");
  }
  if (!result.dataSources.find((d) => d.layer === "water" && d.featureCount > 0)) {
    dataConfidence -= 0.05;
    missingFactors.push("Water bodies unavailable — no hydro network evidence");
  }

  const coverageConfidence = Number(Math.max(0.2, Math.min(0.95, coverage)).toFixed(2));

  // Model confidence: rules engine honesty — not physics
  let modelConfidence = 0.62;
  rationale.push("Model confidence capped — spatial rules over twin geometry, not hydrodynamic solver.");
  if (result.kind === "heavy_rain") {
    modelConfidence = 0.58;
    rationale.push("Rainfall experiment explicitly non-physical (documented accumulation proxy).");
  }
  if (result.warnings.length) {
    modelConfidence -= Math.min(0.12, result.warnings.length * 0.02);
  }

  let decisionConfidence = 0.7;
  if (result.affectedEntities.length >= 20) decisionConfidence += 0.08;
  if (result.affectedEntities.length === 0) decisionConfidence = 0.3;
  if (missing.length >= 2) decisionConfidence -= 0.08;
  rationale.push(
    `Decision confidence from evidence entity count (${result.affectedEntities.length}) and missing-layer penalty.`,
  );

  dataConfidence = Math.max(0.15, Math.min(0.95, dataConfidence));
  modelConfidence = Math.max(0.2, Math.min(0.85, modelConfidence));
  decisionConfidence = Math.max(0.15, Math.min(0.95, decisionConfidence));

  const overall = Number(
    (
      0.3 * dataConfidence +
      0.2 * coverageConfidence +
      0.25 * modelConfidence +
      0.25 * decisionConfidence
    ).toFixed(2),
  );

  return {
    dataConfidence: Number(dataConfidence.toFixed(2)),
    coverageConfidence,
    modelConfidence: Number(modelConfidence.toFixed(2)),
    decisionConfidence: Number(decisionConfidence.toFixed(2)),
    overall,
    rationale,
    missingFactors,
  };
}

function ontologyForKind(kind: string): string[] {
  const map: Record<string, string[]> = {
    building: ["Building"],
    road: ["RoadSegment"],
    hospital: ["Hospital"],
    school: ["School"],
    airport: ["Airport"],
    railway_station: ["RailwayStation"],
  };
  return map[kind] ?? ["TwinEntity"];
}

function buildStrategies(result: ExperimentResult): StrategyOption[] {
  const econ = result.metrics.economic_impact_eur ?? 0;
  const criticalIds = result.affectedEntities.filter((e) => e.severity === "critical").map((e) => e.id);
  const roadIds = result.affectedEntities.filter((e) => e.layer === "roads").map((e) => e.id);
  const buildingIds = result.affectedEntities.filter((e) => e.layer === "buildings").map((e) => e.id);
  const hospitalIds = result.affectedEntities.filter((e) => e.kind === "hospital").map((e) => e.id);
  const schoolIds = result.affectedEntities.filter((e) => e.kind === "school").map((e) => e.id);

  const dataRefs = result.dataSources
    .filter((d) => d.status !== "missing")
    .map((d) => `${d.layer} (${d.featureCount})`);

  const ontology = [
    ...new Set(result.affectedEntities.flatMap((e) => ontologyForKind(e.kind))),
  ];

  const A: StrategyOption = {
    id: "A",
    name: "Lowest Cost",
    objective: "lowest_cost",
    summary: "Contain with minimal resource burn — critical entities only.",
    actions: [
      hospitalIds.length
        ? `Protect ${hospitalIds.length} hospital entity(ies) first`
        : "Stabilize highest-severity twin entities first",
      `Defer non-critical building interventions (${Math.max(0, buildingIds.length - 10)} deferred)`,
      "Use existing road capacity; avoid full corridor rebuilds",
    ],
    estimatedCostEur: Math.round(econ * 0.45),
    etaMinutes: Math.round(90 + (roadIds.length + buildingIds.length) * 0.8),
    residualRiskScore: Math.min(95, 55 + criticalIds.length * 4),
    estimatedEffectiveness: 55,
    operationalComplexity: 35,
    riskReductionPct: 40,
    advantages: ["Lowest spend", "Smaller team footprint", "Fast political approval"],
    disadvantages: ["Higher residual risk", "Schools/non-critical may wait", "Slower full recovery"],
    tradeoffs: ["Lower spend", "Higher residual risk on non-critical assets", "Slower full recovery"],
    targetEntityIds: [...criticalIds, ...hospitalIds].slice(0, 40),
    why: "Minimizes documented unit-cost impact by acting only on critical severity entities from experiment output.",
    whatData: dataRefs,
    whichAssumptions: result.assumptions.filter((a) => a.includes("EUR") || a.includes("Economic")),
    ontologyEntities: ontology,
  };

  const B: StrategyOption = {
    id: "B",
    name: "Fastest Response",
    objective: "fastest",
    summary: "Rapid perimeter + access restoration for emergency movement.",
    actions: [
      `Clear / control ${Math.min(roadIds.length, 25)} priority road segments from experiment output`,
      hospitalIds.length
        ? `Open approach corridors to ${hospitalIds.length} hospital(s)`
        : "Establish incident perimeter from impact zone layer",
      schoolIds.length ? `Stage school shelter protocols for ${schoolIds.length} school(s)` : "Parallel teams on highest-severity cluster",
    ],
    estimatedCostEur: Math.round(econ * 0.85),
    etaMinutes: Math.max(25, Math.round(35 + roadIds.length * 0.35)),
    residualRiskScore: Math.min(90, 40 + criticalIds.length * 3),
    estimatedEffectiveness: 72,
    operationalComplexity: 60,
    riskReductionPct: 58,
    advantages: ["Fastest ETA", "Restores hospital access early", "Clear operational narrative"],
    disadvantages: ["Higher short-term cost", "May over-allocate to roads", "Complex coordination"],
    tradeoffs: ["Fastest ETA", "Higher short-term cost", "May over-allocate to roads vs buildings"],
    targetEntityIds: [...roadIds.slice(0, 30), ...hospitalIds],
    why: "Optimizes ETA by targeting road entities that drive access metrics in the experiment result.",
    whatData: [`roads affected/closed metrics`, ...dataRefs.slice(0, 4)],
    whichAssumptions: result.assumptions.slice(0, 3),
    ontologyEntities: ontology,
  };

  const C: StrategyOption = {
    id: "C",
    name: "Lowest Risk",
    objective: "lowest_risk",
    summary: "Comprehensive mitigation across critical + high severity entities.",
    actions: [
      `Mitigate all ${criticalIds.length} critical entities`,
      `Stage protection for ${Math.min(buildingIds.length, 50)} building entities`,
      "Maintain redundant access to every hospital in affected set",
      "Monitor recovery timeline residual metrics",
    ],
    estimatedCostEur: Math.round(econ * 1.15 + 5000),
    etaMinutes: Math.round(120 + (buildingIds.length + roadIds.length) * 1.1),
    residualRiskScore: Math.max(8, 22 - Math.min(12, criticalIds.length)),
    estimatedEffectiveness: 88,
    operationalComplexity: 82,
    riskReductionPct: 78,
    advantages: ["Lowest residual risk", "Covers schools + hospitals", "Strong audit trail"],
    disadvantages: ["Highest cost", "Longest duration", "Highest operational complexity"],
    tradeoffs: ["Lowest residual risk", "Highest cost", "Longest duration"],
    targetEntityIds: result.affectedEntities
      .filter((e) => e.severity === "critical" || e.severity === "high")
      .map((e) => e.id)
      .slice(0, 80),
    why: "Minimizes residual risk score by covering critical and high severity entities enumerated in experiment output.",
    whatData: dataRefs,
    whichAssumptions: result.assumptions,
    ontologyEntities: ontology,
  };

  return [A, B, C];
}

export function buildDecisionBrief(result: ExperimentResult): DecisionBrief {
  if (result.status !== "succeeded") {
    throw new Error("Decision brief requires a succeeded experiment result — refusing to invent outcomes.");
  }

  const confidenceBreakdown = buildConfidence(result);
  const strategies = buildStrategies(result);
  const priority = priorityFromMetrics(result);
  const risk = overallRisk(result, priority);
  const pop = result.metrics.population_proxy ?? 0;
  const econ = result.metrics.economic_impact_eur ?? 0;

  const infra = result.affectedEntities.slice(0, 60).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    severity: e.severity,
  }));

  const topKinds = Object.entries(
    result.affectedEntities.reduce<Record<string, number>>((acc, e) => {
      acc[e.kind] = (acc[e.kind] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");

  const executiveSummary =
    `${result.cityDisplayName} · ${result.kind.replace(/_/g, " ")}: ` +
    `overall risk ${risk.toUpperCase()}. ${result.affectedEntities.length} twin entities affected` +
    (topKinds ? ` (${topKinds})` : "") +
    `. Population proxy ${pop}. Economic estimate €${econ.toLocaleString()}. ` +
    `Emergency priority ${priority}.`;

  const situation = [
    `Experiment ${result.kind} on twin ${result.citySlug}.`,
    `Epicenter (${result.epicenter.lon.toFixed(5)}, ${result.epicenter.lat.toFixed(5)}).`,
    `Parameters: ${JSON.stringify(result.parameters)}.`,
    `Metrics peak: intensity=${result.metrics.rain_intensity_mm_hr ?? "n/a"} mm/h, ` +
      `buildings=${result.metrics.buildings_affected ?? 0}, roads=${result.metrics.roads_affected ?? result.metrics.roads_closed ?? 0}, ` +
      `hospitals=${result.metrics.hospitals_access_risk ?? 0}.`,
  ].join(" ");

  const reasoning = [
    `Analysed experiment result ${result.id} only — no external LLM claims.`,
    situation,
    `Risk propagation: ${result.riskPropagation.map((r) => `${r.from}→${r.to}`).join("; ") || "none"}.`,
    result.warnings.length ? `Warnings: ${result.warnings.join(" | ")}` : "No experiment warnings.",
  ].join(" ");

  const recommendedActions = [
    strategies[1]!.actions[0]!,
    strategies[2]!.actions[0]!,
    `Track recovery frame at t=${result.timeline.find((t) => t.phase === "after")?.tMinutes ?? 0} min`,
  ];

  const strategyComparison =
    `A (€${strategies[0]!.estimatedCostEur}, ${strategies[0]!.etaMinutes} min, residual ${strategies[0]!.residualRiskScore}, effect ${strategies[0]!.estimatedEffectiveness}) ` +
    `vs B (€${strategies[1]!.estimatedCostEur}, ${strategies[1]!.etaMinutes} min, residual ${strategies[1]!.residualRiskScore}, effect ${strategies[1]!.estimatedEffectiveness}) ` +
    `vs C (€${strategies[2]!.estimatedCostEur}, ${strategies[2]!.etaMinutes} min, residual ${strategies[2]!.residualRiskScore}, effect ${strategies[2]!.estimatedEffectiveness}). ` +
    `Prefer B for urgent access (P1/P2); C for minimum residual risk; A under budget constraint.`;

  const ontology = [...new Set(result.affectedEntities.flatMap((e) => ontologyForKind(e.kind)))];

  const explainability: ExplainabilityBlock = {
    why: reasoning,
    whatData: result.dataSources.map((d) => `${d.layer}: ${d.featureCount} features (${d.status})`),
    whichEntities: result.affectedEntities.slice(0, 80).map((e) => e.id),
    whichAssumptions: result.assumptions,
    ontologyEntities: ontology,
    spatialRelationships: result.riskPropagation.map(
      (r) => `${r.from} → ${r.to}: ${r.mechanism} (${r.entityIds.length} entities)`,
    ),
    method: "rules_over_experiment_outputs",
    expandable: {
      datasets: result.dataSources.map((d) => ({
        layer: d.layer,
        featureCount: d.featureCount,
        status: d.status,
      })),
      graphReasoning: result.riskPropagation,
      metricEvidence: result.metrics,
    },
  };

  return {
    id: randomUUID(),
    experimentId: result.experimentId,
    resultId: result.id,
    citySlug: result.citySlug,
    kind: result.kind,
    createdAt: new Date().toISOString(),
    executiveSummary,
    situation,
    overallRisk: risk,
    reasoning,
    confidence: confidenceBreakdown.overall,
    confidenceRationale: confidenceBreakdown.rationale.join(" "),
    confidenceBreakdown,
    affectedInfrastructure: infra,
    affectedPopulation: {
      proxy: pop,
      method: "experiment_metric.population_proxy",
      note:
        result.assumptions.find((a) => a.toLowerCase().includes("population")) ??
        "Population figure is experiment metric only — verify assumptions.",
    },
    economicImpactEstimate: {
      eur: econ,
      method: "experiment_metric.economic_impact_eur",
    },
    emergencyPriority: priority,
    recommendedActions,
    strategies,
    strategyComparison,
    explainability,
    warnings: result.warnings,
  };
}

export class DecisionEngineService {
  isEnabled(): boolean {
    return process.env.FEATURE_DECISION_ENGINE !== "false";
  }

  listCapabilities(): readonly string[] {
    return [
      "decision_brief_from_experiment",
      "strategy_abc_compare",
      "confidence_breakdown",
      "explainability_blocks",
      "executive_report_export",
    ];
  }

  async recommend(result?: ExperimentResult): Promise<DecisionBrief> {
    if (!result) {
      throw new Error(
        "DecisionEngine.recommend requires an ExperimentResult. POLARIS never fabricates decisions without experiment outputs.",
      );
    }
    return buildDecisionBrief(result);
  }
}
