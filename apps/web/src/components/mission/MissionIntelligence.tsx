"use client";

import { useMemo, useState } from "react";
import type { DecisionBrief, ExperimentResultView } from "./types";
import { exportExecutiveBriefPdf } from "./exportReport";

type Tab = "brief" | "evidence" | "strategies" | "confidence" | "report";

function Bar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div className="mc-row">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mc-progress">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Radar({ strategies }: { strategies: DecisionBrief["strategies"] }) {
  // Simple SVG radar: effectiveness, speed (inv ETA), cost efficiency, risk reduction, complexity (inv)
  const axes = ["Effect", "Speed", "CostEff", "Risk↓", "Simplicity"] as const;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const colors = ["var(--mc-ok)", "var(--mc-accent)", "var(--mc-accent-2)"];

  const pointsFor = (s: DecisionBrief["strategies"][number]) => {
    const maxEta = Math.max(...strategies.map((x) => x.etaMinutes), 1);
    const maxCost = Math.max(...strategies.map((x) => x.estimatedCostEur), 1);
    const vals = [
      s.estimatedEffectiveness / 100,
      1 - s.etaMinutes / maxEta,
      1 - s.estimatedCostEur / maxCost,
      s.riskReductionPct / 100,
      1 - s.operationalComplexity / 100,
    ];
    return vals
      .map((v, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / vals.length;
        return `${cx + Math.cos(a) * r * v},${cy + Math.sin(a) * r * v}`;
      })
      .join(" ");
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Strategy radar">
      {[0.33, 0.66, 1].map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={r * f}
          fill="none"
          stroke="var(--mc-border)"
          strokeWidth={1}
        />
      ))}
      {axes.map((label, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
        const x = cx + Math.cos(a) * (r + 14);
        const y = cy + Math.sin(a) * (r + 14);
        return (
          <text key={label} x={x} y={y} fontSize={9} fill="var(--mc-text-muted)" textAnchor="middle">
            {label}
          </text>
        );
      })}
      {strategies.map((s, idx) => (
        <polygon
          key={s.id}
          points={pointsFor(s)}
          fill={colors[idx]}
          fillOpacity={0.15}
          stroke={colors[idx]}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

export function MissionIntelligence({
  brief,
  result,
}: {
  brief: DecisionBrief | null;
  result: ExperimentResultView | null;
}) {
  const [tab, setTab] = useState<Tab>("brief");

  const tabs = useMemo(
    () =>
      [
        ["brief", "Executive Brief"],
        ["evidence", "Evidence"],
        ["strategies", "Strategies"],
        ["confidence", "Confidence"],
        ["report", "Report"],
      ] as const,
    [],
  );

  if (!brief || !result) {
    return (
      <section className="mc-panel">
        <div className="mc-panel-h">Mission Intelligence</div>
        <div className="mc-panel-b">
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No experiment executed.</p>
          <p className="mc-muted" style={{ marginTop: 8 }}>
            Load Monaco, configure Extreme Rainfall, then click Run experiment. This panel updates from
            experiment outputs only.
          </p>
        </div>
      </section>
    );
  }

  const cb = brief.confidenceBreakdown ?? {
    dataConfidence: brief.confidence,
    coverageConfidence: brief.confidence,
    modelConfidence: brief.confidence,
    decisionConfidence: brief.confidence,
    overall: brief.confidence,
    rationale: [brief.confidenceRationale ?? ""],
    missingFactors: [] as string[],
  };

  return (
    <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div className="mc-tabs" role="tablist" aria-label="Mission Intelligence">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "brief" && (
        <>
          <section className="mc-panel">
            <div className="mc-panel-h">Executive Brief</div>
            <div className="mc-panel-b" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="mc-chip">Risk {brief.overallRisk}</span>
                <span className="mc-chip">Priority {brief.emergencyPriority}</span>
                <span className="mc-chip">
                  Overall {(brief.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{brief.executiveSummary}</p>
              <div className="mc-row">
                <span>population proxy</span>
                <span>{brief.affectedPopulation.proxy}</span>
              </div>
              <div className="mc-row">
                <span>economic impact</span>
                <span>€{brief.economicImpactEstimate.eur.toLocaleString()}</span>
              </div>
              <div className="mc-row">
                <span>infrastructure</span>
                <span>{brief.affectedInfrastructure.length}+ entities</span>
              </div>
            </div>
          </section>
          <section className="mc-panel">
            <div className="mc-panel-h">Recommended actions</div>
            <div className="mc-panel-b" style={{ display: "grid", gap: 6 }}>
              {brief.recommendedActions.map((a) => (
                <div key={a} style={{ fontSize: 12 }}>
                  · {a}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "evidence" && (
        <section className="mc-panel">
          <div className="mc-panel-h">Evidence</div>
          <div className="mc-panel-b" style={{ display: "grid", gap: 10, fontSize: 12 }}>
            <div>
              <strong>WHY</strong>
              <p className="mc-muted">{brief.explainability.why}</p>
            </div>
            <div>
              <strong>DATASETS</strong>
              {brief.explainability.whatData.map((d) => (
                <div key={d} className="mc-muted">
                  · {d}
                </div>
              ))}
            </div>
            <div>
              <strong>ONTOLOGY</strong>
              <div className="mc-muted">{(brief.explainability.ontologyEntities ?? []).join(", ") || "—"}</div>
            </div>
            <div>
              <strong>SPATIAL RELATIONSHIPS</strong>
              {(brief.explainability.spatialRelationships ?? []).map((s) => (
                <div key={s} className="mc-muted">
                  · {s}
                </div>
              ))}
            </div>
            <div>
              <strong>ENTITIES (sample)</strong>
              <div className="mc-muted" style={{ fontFamily: "var(--polaris-font-mono)", fontSize: 10 }}>
                {brief.explainability.whichEntities.slice(0, 20).join(", ")}
                {brief.explainability.whichEntities.length > 20 ? "…" : ""}
              </div>
            </div>
            <div>
              <strong>ASSUMPTIONS</strong>
              {brief.explainability.whichAssumptions.map((a) => (
                <div key={a} className="mc-muted">
                  · {a}
                </div>
              ))}
            </div>
            <div>
              <strong>METRIC EVIDENCE</strong>
              {Object.entries(brief.explainability.expandable.metricEvidence).map(([k, v]) => (
                <div key={k} className="mc-row">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "strategies" && (
        <section className="mc-panel">
          <div className="mc-panel-h">Strategies A / B / C</div>
          <div className="mc-panel-b" style={{ display: "grid", gap: 12 }}>
            <p className="mc-muted" style={{ fontSize: 11 }}>
              {brief.strategyComparison}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Radar strategies={brief.strategies} />
            </div>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {brief.strategies.map((s) => (
                    <th key={s.id}>{s.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Cost €", (s: StrategyOptionRow) => s.estimatedCostEur.toLocaleString()],
                    ["ETA min", (s: StrategyOptionRow) => String(s.etaMinutes)],
                    ["Effectiveness", (s: StrategyOptionRow) => String(s.estimatedEffectiveness)],
                    ["Risk ↓ %", (s: StrategyOptionRow) => String(s.riskReductionPct)],
                    ["Residual risk", (s: StrategyOptionRow) => String(s.residualRiskScore)],
                    ["Complexity", (s: StrategyOptionRow) => String(s.operationalComplexity)],
                  ] as const
                ).map(([label, fn]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {brief.strategies.map((s) => (
                      <td key={s.id}>{fn(s)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {brief.strategies.map((s) => (
              <div key={s.id} className="mc-strategy">
                <h4>
                  Strategy {s.id} — {s.name}
                </h4>
                <div className="mc-muted">{s.summary}</div>
                <Bar label="Effectiveness" value={s.estimatedEffectiveness} />
                <Bar label="Risk reduction %" value={s.riskReductionPct} />
                <Bar label="Complexity" value={s.operationalComplexity} />
                <div>
                  <strong>Advantages</strong>
                  <div className="mc-muted">{s.advantages.join(" · ")}</div>
                </div>
                <div>
                  <strong>Disadvantages</strong>
                  <div className="mc-muted">{s.disadvantages.join(" · ")}</div>
                </div>
                <div>
                  <strong>WHY / DATA / ENTITIES</strong>
                  <div className="mc-muted">{s.why}</div>
                  <div className="mc-muted">{s.whatData.join(" · ")}</div>
                  <div className="mc-muted" style={{ fontFamily: "var(--polaris-font-mono)", fontSize: 10 }}>
                    {s.targetEntityIds.slice(0, 8).join(", ")}
                    {s.targetEntityIds.length > 8 ? "…" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "confidence" && (
        <section className="mc-panel">
          <div className="mc-panel-h">Confidence breakdown</div>
          <div className="mc-panel-b" style={{ display: "grid", gap: 10 }}>
            <Bar label="Data confidence" value={cb.dataConfidence * 100} />
            <Bar label="Coverage" value={cb.coverageConfidence * 100} />
            <Bar label="Model confidence" value={cb.modelConfidence * 100} />
            <Bar label="Decision confidence" value={cb.decisionConfidence * 100} />
            <Bar label="Overall" value={cb.overall * 100} />
            <div>
              <strong>Rationale</strong>
              {cb.rationale.map((r) => (
                <div key={r} className="mc-muted">
                  · {r}
                </div>
              ))}
            </div>
            {cb.missingFactors.length > 0 && (
              <div>
                <strong style={{ color: "var(--mc-warn)" }}>Missing / degraded</strong>
                {cb.missingFactors.map((m) => (
                  <div key={m} className="mc-muted">
                    · {m}
                  </div>
                ))}
              </div>
            )}
            {brief.warnings.map((w) => (
              <div key={w} className="mc-muted">
                ⚠ {w}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "report" && (
        <section className="mc-panel">
          <div className="mc-panel-h">Executive Decision Brief</div>
          <div className="mc-panel-b" style={{ display: "grid", gap: 10 }}>
            <p className="mc-muted">
              Generate a printable PDF-ready brief for city authorities. Content is derived only from
              this experiment result and decision brief — no fabricated narrative.
            </p>
            <button
              type="button"
              className="mc-btn primary"
              onClick={() => exportExecutiveBriefPdf(brief, result)}
            >
              Export Executive Brief (PDF)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

type StrategyOptionRow = DecisionBrief["strategies"][number];
