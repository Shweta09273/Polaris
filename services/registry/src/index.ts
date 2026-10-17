import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PolarisPackageManifest } from "@polaris/package";

export interface InstalledCityRecord {
  readonly citySlug: string;
  readonly cityDisplayName: string;
  readonly packageId: string;
  readonly cityVersion: string;
  readonly ontologyVersion: string;
  readonly compilerVersion: string;
  readonly twinReadinessScore: number;
  readonly cityReadinessScore: number;
  readonly coverage: PolarisPackageManifest["coverage"];
  readonly dataConfidence: number;
  readonly installedAt: string;
  readonly lastUpdated: string;
  readonly installedSizeBytes: number;
  readonly packagePath: string;
  readonly mountDir: string;
  readonly active: boolean;
  readonly previousVersions: readonly {
    readonly cityVersion: string;
    readonly packageId: string;
    readonly packagePath: string;
    readonly mountDir: string;
    readonly replacedAt: string;
  }[];
}

export interface RegistryState {
  readonly version: 1;
  readonly updatedAt: string;
  readonly cities: InstalledCityRecord[];
}

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function defaultRegistryPaths() {
  const root = findRepoRoot();
  return {
    root,
    registryDir: join(root, "data", "registry"),
    packagesDir: join(root, "data", "packages"),
    mountsDir: join(root, "data", "runtime-cache", "mounts"),
    indexPath: join(root, "data", "registry", "index.json"),
  };
}

function emptyState(): RegistryState {
  return { version: 1, updatedAt: new Date().toISOString(), cities: [] };
}

export class CityRegistry {
  constructor(private readonly paths = defaultRegistryPaths()) {
    mkdirSync(this.paths.registryDir, { recursive: true });
    mkdirSync(this.paths.packagesDir, { recursive: true });
    mkdirSync(this.paths.mountsDir, { recursive: true });
    if (!existsSync(this.paths.indexPath)) {
      this.save(emptyState());
    }
  }

  load(): RegistryState {
    try {
      return JSON.parse(readFileSync(this.paths.indexPath, "utf8")) as RegistryState;
    } catch {
      return emptyState();
    }
  }

  private save(state: RegistryState): void {
    const tmp = `${this.paths.indexPath}.tmp`;
    const payload = JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2);
    writeFileSync(tmp, payload, "utf8");
    renameSync(tmp, this.paths.indexPath);
  }

  list(): InstalledCityRecord[] {
    return this.load().cities.filter((c) => c.active);
  }

  get(citySlug: string): InstalledCityRecord | undefined {
    return this.list().find((c) => c.citySlug === citySlug);
  }

  search(query: string): InstalledCityRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter(
      (c) =>
        c.citySlug.includes(q) ||
        c.cityDisplayName.toLowerCase().includes(q) ||
        c.cityDisplayName.toLowerCase().includes(q.replace(/-/g, " ")),
    );
  }

  /**
   * Install or upgrade a city package. Previous active version is retained for rollback.
   */
  install(record: Omit<InstalledCityRecord, "active" | "previousVersions" | "lastUpdated"> & {
    previousVersions?: InstalledCityRecord["previousVersions"];
  }): InstalledCityRecord {
    const state = this.load();
    const existingIdx = state.cities.findIndex((c) => c.citySlug === record.citySlug && c.active);
    let previousVersions = record.previousVersions ?? [];
    if (existingIdx >= 0) {
      const prev = state.cities[existingIdx]!;
      previousVersions = [
        {
          cityVersion: prev.cityVersion,
          packageId: prev.packageId,
          packagePath: prev.packagePath,
          mountDir: prev.mountDir,
          replacedAt: new Date().toISOString(),
        },
        ...prev.previousVersions,
      ].slice(0, 5);
      state.cities[existingIdx] = { ...state.cities[existingIdx]!, active: false };
    }

    const installed: InstalledCityRecord = {
      ...record,
      active: true,
      lastUpdated: new Date().toISOString(),
      previousVersions,
    };
    state.cities.push(installed);
    this.save(state);
    return installed;
  }

  rollback(citySlug: string): InstalledCityRecord {
    const state = this.load();
    const activeIdx = state.cities.findIndex((c) => c.citySlug === citySlug && c.active);
    if (activeIdx < 0) throw new Error(`City not installed: ${citySlug}`);
    const active = state.cities[activeIdx]!;
    const prev = active.previousVersions[0];
    if (!prev) throw new Error(`No previous version to rollback for ${citySlug}`);

    state.cities[activeIdx] = { ...active, active: false };
    const restored: InstalledCityRecord = {
      ...active,
      packageId: prev.packageId,
      cityVersion: prev.cityVersion,
      packagePath: prev.packagePath,
      mountDir: prev.mountDir,
      active: true,
      lastUpdated: new Date().toISOString(),
      previousVersions: active.previousVersions.slice(1),
    };
    state.cities.push(restored);
    this.save(state);
    return restored;
  }

  uninstall(citySlug: string, opts?: { deleteFiles?: boolean }): void {
    const state = this.load();
    const city = state.cities.find((c) => c.citySlug === citySlug && c.active);
    if (!city) throw new Error(`City not installed: ${citySlug}`);
    const related = state.cities.filter((c) => c.citySlug === citySlug);
    const nextCities = state.cities.map((c) =>
      c.citySlug === citySlug ? { ...c, active: false } : c,
    );
    this.save({ ...state, cities: nextCities });
    if (opts?.deleteFiles) {
      for (const c of related) {
        if (existsSync(c.mountDir)) rmSync(c.mountDir, { recursive: true, force: true });
        if (existsSync(c.packagePath)) rmSync(c.packagePath, { force: true });
      }
    }
  }
}
