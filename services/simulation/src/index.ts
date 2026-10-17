/**
 * Simulation context — INTERFACE ONLY (Milestone 1).
 * No physics, no mock scenario outputs.
 */

import {
  FeatureNotReadyError,
  type SimulationPort,
} from "@polaris/domain";

export class SimulationService implements SimulationPort {
  isEnabled(): boolean {
    return process.env.FEATURE_SIMULATION === "true";
  }

  listCapabilities(): readonly string[] {
    return [];
  }

  async run(): Promise<never> {
    throw new FeatureNotReadyError("SimulationEngine", "Milestone 5");
  }
}
