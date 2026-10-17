import type { DecisionBrief, ExperimentResultView } from "./types";

/** Opens a print-ready HTML brief; user saves as PDF via browser print. */
export function exportExecutiveBriefPdf(brief: DecisionBrief, result: ExperimentResultView) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) {
    alert("Pop-up blocked — allow pop-ups to export the Executive Brief.");
    return;
  }

  const metrics = Object.entries(result.metrics)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`)
    .join("");

  const strategies = brief.strategies
    .map(
      (s) => `
      <h3>Strategy ${s.id} — ${esc(s.name)}</h3>
      <p>${esc(s.summary)}</p>
      <ul>
        <li>Cost: €${s.estimatedCostEur.toLocaleString()}</li>
        <li>ETA: ${s.etaMinutes} min</li>
        <li>Effectiveness: ${s.estimatedEffectiveness}</li>
        <li>Risk reduction: ${s.riskReductionPct}%</li>
        <li>Residual risk: ${s.residualRiskScore}</li>
        <li>Complexity: ${s.operationalComplexity}</li>
      </ul>
      <p><strong>Why:</strong> ${esc(s.why)}</p>
      <p><strong>Data:</strong> ${esc(s.whatData.join("; "))}</p>
      <p><strong>Assumptions:</strong> ${esc(s.whichAssumptions.join(" | "))}</p>
      <p><strong>Ontology:</strong> ${esc(s.ontologyEntities.join(", "))}</p>
      <p><strong>Trade-offs:</strong> ${esc(s.tradeoffs.join("; "))}</p>
    `,
    )
    .join("");

  const infra = brief.affectedInfrastructure
    .slice(0, 40)
    .map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.kind)}</td><td>${esc(e.severity)}</td><td>${esc(e.id)}</td></tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>POLARIS Executive Decision Brief — ${esc(result.cityDisplayName)}</title>
<style>
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 32px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.04em; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 18px; }
  .meta { color: #555; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f4f6; }
  .chip { display: inline-block; border: 1px solid #ccc; padding: 2px 8px; border-radius: 999px; font-size: 11px; margin-right: 6px; }
  .warn { color: #8a5a00; }
  @media print { button { display: none; } body { margin: 16px; } }
</style>
</head>
<body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>POLARIS Executive Decision Brief</h1>
  <div class="meta">${esc(result.cityDisplayName)} · ${esc(result.kind)} · ${esc(brief.createdAt)}</div>
  <div style="margin-top:10px">
    <span class="chip">Risk ${esc(brief.overallRisk)}</span>
    <span class="chip">Priority ${esc(brief.emergencyPriority)}</span>
    <span class="chip">Confidence ${(brief.confidence * 100).toFixed(0)}%</span>
  </div>

  <h2>1. Executive Summary</h2>
  <p>${esc(brief.executiveSummary)}</p>

  <h2>2. Situation</h2>
  <p>${esc(brief.situation)}</p>

  <h2>3. Experiment</h2>
  <p>Result ID: <code>${esc(result.id)}</code></p>
  <p>Parameters: <code>${esc(JSON.stringify(result.parameters))}</code></p>
  <p>Epicenter: ${result.epicenter.lon.toFixed(5)}, ${result.epicenter.lat.toFixed(5)}</p>
  <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${metrics}</tbody></table>

  <h2>4. Evidence</h2>
  <p>${esc(brief.explainability.why)}</p>
  <p><strong>Datasets:</strong> ${esc(brief.explainability.whatData.join("; "))}</p>
  <p><strong>Ontology:</strong> ${esc((brief.explainability.ontologyEntities ?? []).join(", "))}</p>
  <p><strong>Spatial relationships:</strong></p>
  <ul>${(brief.explainability.spatialRelationships ?? []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  <p><strong>Assumptions:</strong></p>
  <ul>${brief.explainability.whichAssumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>

  <h2>5. Affected Infrastructure</h2>
  <p>Population proxy: ${brief.affectedPopulation.proxy} (${esc(brief.affectedPopulation.note)})</p>
  <p>Economic estimate: €${brief.economicImpactEstimate.eur.toLocaleString()}</p>
  <table>
    <thead><tr><th>Name</th><th>Kind</th><th>Severity</th><th>Entity ID</th></tr></thead>
    <tbody>${infra}</tbody>
  </table>

  <h2>6. Strategies</h2>
  <p>${esc(brief.strategyComparison)}</p>
  ${strategies}

  <h2>7. Recommendations</h2>
  <ul>${brief.recommendedActions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>

  <h2>8. Confidence</h2>
  <ul>
    <li>Data: ${(((brief.confidenceBreakdown?.dataConfidence ?? brief.confidence) * 100)).toFixed(0)}%</li>
    <li>Coverage: ${(((brief.confidenceBreakdown?.coverageConfidence ?? brief.confidence) * 100)).toFixed(0)}%</li>
    <li>Model: ${(((brief.confidenceBreakdown?.modelConfidence ?? brief.confidence) * 100)).toFixed(0)}%</li>
    <li>Decision: ${(((brief.confidenceBreakdown?.decisionConfidence ?? brief.confidence) * 100)).toFixed(0)}%</li>
    <li>Overall: ${(((brief.confidenceBreakdown?.overall ?? brief.confidence) * 100)).toFixed(0)}%</li>
  </ul>
  <p>${esc((brief.confidenceBreakdown?.rationale ?? [brief.confidenceRationale]).join(" "))}</p>
  ${
    (brief.confidenceBreakdown?.missingFactors?.length ?? 0) > 0
      ? `<p class="warn"><strong>Missing / degraded:</strong> ${esc((brief.confidenceBreakdown?.missingFactors ?? []).join("; "))}</p>`
      : ""
  }

  <h2>9. Appendix</h2>
  <p>Method: ${esc(brief.explainability.method)}. This brief is generated from Digital Twin experiment outputs only. Rainfall analysis is a documented digital experiment — not a hydrodynamic flood model.</p>
  <p>Warnings: ${esc(brief.warnings.join(" | ") || "None")}</p>
  <p class="meta">POLARIS Decision Operating System · Confidential — for authorized city operators</p>
  <script>setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
