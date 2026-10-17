import { loadTwinFeatures } from "./loadTwin.js";
import { executeExperiment } from "./runners.js";
import { SCENARIO_CATALOG, getScenario } from "./catalog.js";
import type { ExperimentResult, RunExperimentRequest } from "./types.js";

export * from "./types.js";
export { SCENARIO_CATALOG, getScenario } from "./catalog.js";
export { loadTwinFeatures } from "./loadTwin.js";
export { executeExperiment } from "./runners.js";

export function listScenarios() {
  return SCENARIO_CATALOG;
}

export function runExperiment(request: RunExperimentRequest): ExperimentResult {
  const twin = loadTwinFeatures(request.citySlug);
  return executeExperiment(twin, request);
}
