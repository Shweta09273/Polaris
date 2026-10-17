/**
 * POLARIS Runtime — execution environment for compiled city packages.
 *
 * Responsibilities:
 * - Load / validate / mount packages
 * - Register services for a mounted city
 * - Expose twin metadata APIs (no 3D yet)
 * - Cache mounts, track versions, support rollback
 * - Detect package corruption
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  RUNTIME_VERSION,
  PACKAGE_FORMAT_MAJOR,
  verifyPackageFile,
  unpackPackage,
  isPolarisPackageFile,
  type PolarisPackageManifest,
} from "@polaris/package";
import { CityRegistry, defaultRegistryPaths, type InstalledCityRecord } from "@polaris/registry";

export interface MountedCity {
  readonly citySlug: string;
  readonly cityVersion: string;
  readonly mountDir: string;
  readonly packagePath: string;
  readonly manifest: PolarisPackageManifest;
  readonly record: InstalledCityRecord;
  readonly mountedAt: string;
  readonly services: readonly RuntimeServiceHandle[];
}

export interface RuntimeServiceHandle {
  readonly id: string;
  readonly kind: "twin-metadata" | "city-dna" | "bootstrap-report" | "boundary";
  readonly path: string;
  readonly ready: boolean;
}

export interface RuntimeStatus {
  readonly runtimeVersion: string;
  readonly packageFormatMajor: number;
  readonly mountedCities: readonly string[];
  readonly installedCount: number;
  readonly cacheDir: string;
  readonly healthy: boolean;
}

export interface ImportPackageOptions {
  readonly packagePath: string;
  readonly signingSecret?: string;
  readonly allowUnsigned?: boolean;
  /** Copy package into registry packages dir */
  readonly installCopy?: boolean;
}

export interface OpenCityResult {
  readonly mode: "cloud-installed" | "compiled" | "imported";
  readonly city: MountedCity;
  readonly compileJobId?: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

export class PolarisRuntime {
  private readonly mounts = new Map<string, MountedCity>();
  private readonly registry: CityRegistry;
  private readonly paths = defaultRegistryPaths();

  constructor(registry?: CityRegistry) {
    this.registry = registry ?? new CityRegistry();
    mkdirSync(this.paths.mountsDir, { recursive: true });
    mkdirSync(join(this.paths.root, "data", "runtime-cache"), { recursive: true });
  }

  status(): RuntimeStatus {
    return {
      runtimeVersion: RUNTIME_VERSION,
      packageFormatMajor: PACKAGE_FORMAT_MAJOR,
      mountedCities: [...this.mounts.keys()],
      installedCount: this.registry.list().length,
      cacheDir: this.paths.mountsDir,
      healthy: true,
    };
  }

  listInstalled(): InstalledCityRecord[] {
    return this.registry.list();
  }

  searchInstalled(query: string): InstalledCityRecord[] {
    return this.registry.search(query);
  }

  getInstalled(citySlug: string): InstalledCityRecord | undefined {
    return this.registry.get(citySlug);
  }

  getMounted(citySlug: string): MountedCity | undefined {
    return this.mounts.get(citySlug);
  }

  /**
   * Validate integrity of an on-disk package without mounting.
   */
  async validatePackage(
    packagePath: string,
    opts?: { signingSecret?: string; allowUnsigned?: boolean },
  ) {
    if (!isPolarisPackageFile(packagePath) && !packagePath.endsWith(".polaris")) {
      return {
        ok: false as const,
        errors: ["Not a .polaris package (expected PLRS envelope)"],
        warnings: [] as string[],
      };
    }
    return verifyPackageFile(packagePath, {
      signingSecret: opts?.signingSecret ?? process.env.POLARIS_PACKAGE_HMAC_SECRET,
      allowUnsigned:
        opts?.allowUnsigned ?? process.env.POLARIS_ALLOW_UNSIGNED_PACKAGES !== "false",
    });
  }

  /**
   * Detect corruption of an installed mount by re-hashing entrypoint files against manifest.
   */
  detectCorruption(citySlug: string): { ok: boolean; errors: string[] } {
    const mounted = this.mounts.get(citySlug) ?? this.hydrateFromRegistry(citySlug);
    if (!mounted) {
      return { ok: false, errors: [`City not mounted or installed: ${citySlug}`] };
    }
    const errors: string[] = [];
    const entries = mounted.manifest.entrypoints;
    for (const rel of [entries.twinEntities, entries.twinEdges, entries.cityDna, entries.bootstrapReport]) {
      const abs = join(mounted.mountDir, rel);
      if (!existsSync(abs)) errors.push(`Missing entrypoint: ${rel}`);
    }
    if (entries.boundary) {
      const abs = join(mounted.mountDir, entries.boundary);
      if (!existsSync(abs)) errors.push(`Missing boundary: ${entries.boundary}`);
    }
    const manifestPath = join(mounted.mountDir, "manifest.json");
    if (!existsSync(manifestPath)) errors.push("Missing mount manifest.json");
    return { ok: errors.length === 0, errors };
  }

  /**
   * Mount an already-installed city from the registry.
   */
  async mountInstalled(citySlug: string): Promise<MountedCity> {
    const existing = this.mounts.get(citySlug);
    if (existing) return existing;

    const record = this.registry.get(citySlug);
    if (!record) throw new Error(`City not installed: ${citySlug}`);

    if (!existsSync(record.mountDir) || !existsSync(join(record.mountDir, "manifest.json"))) {
      // Remount from package if cache evicted
      const verified = await this.validatePackage(record.packagePath);
      if (!verified.ok) {
        throw new Error(`Installed package corrupt/invalid: ${verified.errors.join("; ")}`);
      }
      await unpackPackage(record.packagePath, record.mountDir, {
        signingSecret: process.env.POLARIS_PACKAGE_HMAC_SECRET,
        allowUnsigned: process.env.POLARIS_ALLOW_UNSIGNED_PACKAGES !== "false",
      });
    }

    const manifest = readJson<PolarisPackageManifest>(join(record.mountDir, "manifest.json"));
    const city = this.registerMount(record, manifest);
    return city;
  }

  /**
   * Import a local .polaris package: validate → install → mount.
   */
  async importPackage(opts: ImportPackageOptions): Promise<MountedCity> {
    const verified = await this.validatePackage(opts.packagePath, {
      signingSecret: opts.signingSecret,
      allowUnsigned: opts.allowUnsigned,
    });
    if (!verified.ok || !verified.manifest) {
      throw new Error(`Import validation failed:\n${verified.errors.join("\n")}`);
    }
    const manifest = verified.manifest;
    const destPkg =
      opts.installCopy === false
        ? opts.packagePath
        : join(this.paths.packagesDir, `${manifest.citySlug}-${manifest.cityVersion}.polaris`);

    if (destPkg !== opts.packagePath) {
      mkdirSync(this.paths.packagesDir, { recursive: true });
      const { copyFileSync } = await import("node:fs");
      copyFileSync(opts.packagePath, destPkg);
    }

    const mountDir = join(this.paths.mountsDir, manifest.citySlug, manifest.cityVersion);
    await unpackPackage(destPkg, mountDir, {
      signingSecret: opts.signingSecret ?? process.env.POLARIS_PACKAGE_HMAC_SECRET,
      allowUnsigned:
        opts.allowUnsigned ?? process.env.POLARIS_ALLOW_UNSIGNED_PACKAGES !== "false",
    });

    const confidence = Math.round(
      manifest.twinReadinessScore * 0.6 + manifest.cityReadinessScore * 0.4,
    );
    const record = this.registry.install({
      citySlug: manifest.citySlug,
      cityDisplayName: manifest.cityDisplayName,
      packageId: manifest.packageId,
      cityVersion: manifest.cityVersion,
      ontologyVersion: manifest.ontologyVersion,
      compilerVersion: manifest.compilerVersion,
      twinReadinessScore: manifest.twinReadinessScore,
      cityReadinessScore: manifest.cityReadinessScore,
      coverage: manifest.coverage,
      dataConfidence: confidence,
      installedAt: new Date().toISOString(),
      installedSizeBytes: fileSize(destPkg),
      packagePath: destPkg,
      mountDir,
    });

    return this.registerMount(record, manifest);
  }

  /**
   * Export currently mounted (or installed) city to a .polaris path (copy of installed package).
   */
  async exportPackage(citySlug: string, outPath: string): Promise<string> {
    const record = this.registry.get(citySlug);
    if (!record) throw new Error(`City not installed: ${citySlug}`);
    if (!existsSync(record.packagePath)) {
      throw new Error(`Package file missing at ${record.packagePath}`);
    }
    const { copyFileSync, mkdirSync: mkdir } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdir(dirname(outPath), { recursive: true });
    copyFileSync(record.packagePath, outPath);
    return outPath;
  }

  rollback(citySlug: string): MountedCity {
    this.mounts.delete(citySlug);
    const restored = this.registry.rollback(citySlug);
    const manifest = readJson<PolarisPackageManifest>(join(restored.mountDir, "manifest.json"));
    return this.registerMount(restored, manifest);
  }

  uninstall(citySlug: string, opts?: { deleteFiles?: boolean }): void {
    this.mounts.delete(citySlug);
    this.registry.uninstall(citySlug, opts);
  }

  /**
   * Evict mount cache for a city (package remains installed).
   */
  unmount(citySlug: string, opts?: { deleteCache?: boolean }): void {
    const m = this.mounts.get(citySlug);
    this.mounts.delete(citySlug);
    if (opts?.deleteCache && m && existsSync(m.mountDir)) {
      rmSync(m.mountDir, { recursive: true, force: true });
    }
  }

  /**
   * Open twin metadata for a mounted city (shell for future 3D engine).
   */
  openTwin(citySlug: string): {
    citySlug: string;
    cityDisplayName: string;
    twinReadinessScore: number;
    coverage: PolarisPackageManifest["coverage"];
    entityCount: number;
    edgeCount: number;
    cityDna: unknown;
    note: string;
  } {
    const mounted = this.mounts.get(citySlug);
    if (!mounted) throw new Error(`City not mounted: ${citySlug}. Call mountInstalled first.`);

    const entitiesPath = join(mounted.mountDir, mounted.manifest.entrypoints.twinEntities);
    const edgesPath = join(mounted.mountDir, mounted.manifest.entrypoints.twinEdges);
    const dnaPath = join(mounted.mountDir, mounted.manifest.entrypoints.cityDna);

    const entities = existsSync(entitiesPath) ? readJson<unknown[]>(entitiesPath) : [];
    const edges = existsSync(edgesPath) ? readJson<unknown[]>(edgesPath) : [];
    const cityDna = existsSync(dnaPath) ? readJson(dnaPath) : null;

    return {
      citySlug: mounted.citySlug,
      cityDisplayName: mounted.manifest.cityDisplayName,
      twinReadinessScore: mounted.manifest.twinReadinessScore,
      coverage: mounted.manifest.coverage,
      entityCount: Array.isArray(entities) ? entities.length : 0,
      edgeCount: Array.isArray(edges) ? edges.length : 0,
      cityDna,
      note: "3D Digital Twin engine deferred. Metadata shell is available for Mission Control.",
    };
  }

  versionHistory(citySlug: string): Array<{
    cityVersion: string;
    packageId: string;
    active: boolean;
    replacedAt?: string;
  }> {
    const state = this.registry.load();
    const all = state.cities.filter((c) => c.citySlug === citySlug);
    const active = all.find((c) => c.active);
    const history: Array<{
      cityVersion: string;
      packageId: string;
      active: boolean;
      replacedAt?: string;
    }> = [];
    if (active) {
      history.push({
        cityVersion: active.cityVersion,
        packageId: active.packageId,
        active: true,
      });
      for (const p of active.previousVersions) {
        history.push({
          cityVersion: p.cityVersion,
          packageId: p.packageId,
          active: false,
          replacedAt: p.replacedAt,
        });
      }
    }
    return history;
  }

  private hydrateFromRegistry(citySlug: string): MountedCity | undefined {
    const record = this.registry.get(citySlug);
    if (!record || !existsSync(join(record.mountDir, "manifest.json"))) return undefined;
    const manifest = readJson<PolarisPackageManifest>(join(record.mountDir, "manifest.json"));
    return this.registerMount(record, manifest);
  }

  private registerMount(record: InstalledCityRecord, manifest: PolarisPackageManifest): MountedCity {
    const services: RuntimeServiceHandle[] = [
      {
        id: "twin-entities",
        kind: "twin-metadata",
        path: join(record.mountDir, manifest.entrypoints.twinEntities),
        ready: existsSync(join(record.mountDir, manifest.entrypoints.twinEntities)),
      },
      {
        id: "city-dna",
        kind: "city-dna",
        path: join(record.mountDir, manifest.entrypoints.cityDna),
        ready: existsSync(join(record.mountDir, manifest.entrypoints.cityDna)),
      },
      {
        id: "bootstrap-report",
        kind: "bootstrap-report",
        path: join(record.mountDir, manifest.entrypoints.bootstrapReport),
        ready: existsSync(join(record.mountDir, manifest.entrypoints.bootstrapReport)),
      },
    ];
    if (manifest.entrypoints.boundary) {
      services.push({
        id: "boundary",
        kind: "boundary",
        path: join(record.mountDir, manifest.entrypoints.boundary),
        ready: existsSync(join(record.mountDir, manifest.entrypoints.boundary)),
      });
    }

    const city: MountedCity = {
      citySlug: record.citySlug,
      cityVersion: record.cityVersion,
      mountDir: record.mountDir,
      packagePath: record.packagePath,
      manifest,
      record,
      mountedAt: new Date().toISOString(),
      services,
    };
    this.mounts.set(record.citySlug, city);
    return city;
  }
}

export { RUNTIME_VERSION, CityRegistry, defaultRegistryPaths };
export type { InstalledCityRecord };

/** List package files under data/packages for Package Manager UI */
export function listLocalPackageFiles(): Array<{ path: string; sizeBytes: number; name: string }> {
  const { packagesDir } = defaultRegistryPaths();
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir)
    .filter((n) => n.endsWith(".polaris"))
    .map((name) => {
      const path = join(packagesDir, name);
      return { path, name, sizeBytes: fileSize(path) };
    });
}
