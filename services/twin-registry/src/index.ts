/**
 * Twin Registry — canonical asset inventory ports (Milestone 1 scaffolding).
 */

import type { Asset, Ulid } from "@polaris/domain";

export interface TwinRegistryPort {
  getAsset(id: Ulid): Promise<Asset | null>;
  listAssetsByAoi(aoiId: Ulid, limit: number): Promise<readonly Asset[]>;
  upsertAsset(asset: Asset): Promise<void>;
}

export class EmptyTwinRegistry implements TwinRegistryPort {
  async getAsset(_id: Ulid): Promise<Asset | null> {
    return null;
  }

  async listAssetsByAoi(_aoiId: Ulid, _limit: number): Promise<readonly Asset[]> {
    // Intentionally empty — no fake assets.
    return [];
  }

  async upsertAsset(_asset: Asset): Promise<void> {
    throw new Error("Twin registry persistence not wired. Implement PostGIS adapter in Milestone 2/3.");
  }
}
