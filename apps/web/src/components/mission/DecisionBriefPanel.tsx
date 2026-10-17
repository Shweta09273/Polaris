"use client";

import { useState } from "react";
import type { DecisionBrief, ExperimentResultView } from "./types";

export function DecisionBriefPanel({
  brief,
  result,
}: {
  brief: DecisionBrief | null;
  result: ExperimentResultView | null;
}) {
  const [openExplain, setOpenExplain] = useState(false);
  const [openStrategy, setOpenStrategy] = useState<"A" | "B" | "C" | null>("B");

  if (!brief || !result) {
    return (
      <section className="mc-panel">
        <div className="mc-panel-h">AI Decision Brief</div>
        <div className="mc-panel-b">
          <p className="mc-muted">
            Run a structured experiment to generate a decision brief. POLARIS never answers free-form AI
            questions — recommendations are derived only from experiment outputs on the Digital Twin.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mc-panel">
        <div className="mc-panel-h">AI Decision Brief</div>
        <div className="mc-panel-b" style={{ display: "grid", gap: 10 }}>
          <div className="mc-chip">Priority {brief.emergencyPriority}</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{brief.executiveSummary}</p>
          <div className="mc-row">
            <span>confidence</span>
            <span>{(brief.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="mc-progress">
            <i style={{ width: `${brief.confidence * 100}%` }} />
          </div>
          <p className="mc-muted" style={{ fontSize: 11 }}>
            {brief.confidenceRationale}
          </p>
        </div>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-h">Recommended actions</div>
        <div className="mc-panel-b" style={{ display: "grid", gap: 6 }}>
          {brief.recommendedActions.map((a) => (
            <div key={a} style={{ fontSize: 12, lineHeight: 1.4 }}>
              · {a}
            </div>
          ))}
        </div>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-h">Impact</div>
        <div className="mc-panel-b" style={{ display: "grid", gap: 6 }}>
          <div className="mc-row">
            <span>population proxy</span>
            <span>{brief.affectedPopulation.proxy}</span>
          </div>
          <div className="mc-row">
            <span>economic EUR</span>
            <span>{brief.economicImpactEstimate.eur.toLocaleString()}</span>
          </div>
          <div className="mc-row">
            <span>entities</span>
            <span>{brief.affectedInfrastructure.length}+</span>
          </div>
          <p className="mc-muted" style={{ fontSize: 11 }}>
            {brief.affectedPopulation.note}
          </p>
        </div>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-h">Alternative strategies</div>
        <div className="mc-panel-b" style={{ display: "grid", gap: 8 }}>
          <p className="mc-muted" style={{ fontSize: 11 }}>
            {brief.strategyComparison}
          </p>
          {brief.strategies.map((s) => (
            <div key={s.id} className="mc-strategy">
              <button
                type="button"
                className="mc-expand"
                onClick={() => setOpenStrategy(openStrategy === s.id ? null : s.id)}
              >
                Strategy {s.id} — {s.name}
              </button>
              {openStrategy === s.id && (
                <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <div>{s.summary}</div>
                  <div className="mc-row">
                    <span>cost</span>
                    <span>€{s.estimatedCostEur.toLocaleString()}</span>
                  </div>
                  <div className="mc-row">
                    <span>ETA</span>
                    <span>{s.etaMinutes} min</span>
                  </div>
                  <div className="mc-row">
                    <span>residual risk</span>
                    <span>{s.residualRiskScore}</span>
                  </div>
                  <div>
                    <strong>WHY</strong>
                    <div className="mc-muted">{s.why}</div>
                  </div>
                  <div>
                    <strong>WHAT DATA</strong>
                    <div className="mc-muted">{s.whatData.join(" · ") || "—"}</div>
                  </div>
                  <div>
                    <strong>ENTITIES</strong>
                    <div className="mc-muted" style={{ fontFamily: "var(--polaris-font-mono)", fontSize: 10 }}>
                      {s.targetEntityIds.slice(0, 12).join(", ") || "—"}
                      {s.targetEntityIds.length > 12 ? "…" : ""}
                    </div>
                  </div>
                  <div>
                    <strong>ASSUMPTIONS</strong>
                    <div className="mc-muted">{s.whichAssumptions.join(" | ") || "—"}</div>
                  </div>
                  <div>
                    <strong>Tradeoffs</strong>
                    <div className="mc-muted">{s.tradeoffs.join(" · ")}</div>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {s.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-h">Reasoning & evidence</div>
        <div className="mc-panel-b" style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{brief.reasoning}</p>
          <button type="button" className="mc-expand" onClick={() => setOpenExplain((v) => !v)}>
            {openExplain ? "Hide explainability" : "Expand explainability"}
          </button>
          {openExplain && (
            <div style={{ display: "grid", gap: 8, fontSize: 11 }}>
              <div>
                <strong>Datasets</strong>
                {brief.explainability.expandable.datasets.map((d) => (
                  <div key={d.layer} className="mc-row">
                    <span>{d.layer}</span>
                    <span>
                      {d.featureCount} · {d.status}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <strong>Graph reasoning</strong>
                {brief.explainability.expandable.graphReasoning.map((g, i) => (
                  <div key={`${g.from}-${i}`} className="mc-muted">
                    {g.from} → {g.to}: {g.mechanism} ({g.entityIds.length} entities)
                  </div>
                ))}
              </div>
              <div>
                <strong>Metric evidence</strong>
                {Object.entries(brief.explainability.expandable.metricEvidence).map(([k, v]) => (
                  <div key={k} className="mc-row">
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <strong>Assumptions</strong>
                {brief.explainability.whichAssumptions.map((a) => (
                  <div key={a} className="mc-muted">
                    · {a}
                  </div>
                ))}
              </div>
            </div>
          )}
          {brief.warnings.length > 0 && (
            <div>
              <strong style={{ color: "var(--mc-warn)" }}>Warnings</strong>
              {brief.warnings.map((w) => (
                <div key={w} className="mc-muted">
                  · {w}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-h">Affected infrastructure</div>
        <div className="mc-panel-b" style={{ display: "grid", gap: 4, maxHeight: 180, overflow: "auto" }}>
          {brief.affectedInfrastructure.slice(0, 40).map((e) => (
            <div key={e.id} className="mc-row">
              <span>
                {e.name} · {e.kind}
              </span>
              <span>{e.severity}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
