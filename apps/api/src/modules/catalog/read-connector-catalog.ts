import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatasetCatalogItemDto } from "@polaris/contracts";
import type { AssetType, LicenseSpdx } from "@polaris/domain";

interface ConnectorManifestFile {
  id: string;
  displayName: string;
  domains: AssetType[];
  license: LicenseSpdx;
  accessMode: string;
  requiresCredentials: boolean;
  notes: string;
}

function resolveConnectorsRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // apps/api/src/modules/catalog -> repo root services/connectors
  return join(here, "..", "..", "..", "..", "services", "connectors");
}

export function readConnectorCatalog(): DatasetCatalogItemDto[] {
  const root = resolveConnectorsRoot();
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const items: DatasetCatalogItemDto[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const manifestPath = join(root, entry.name, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as ConnectorManifestFile;
    items.push({
      datasetKey: raw.id,
      displayName: raw.displayName,
      domains: raw.domains,
      license: raw.license,
      accessMode: raw.accessMode,
      requiresCredentials: raw.requiresCredentials,
      publishedVersions: 0,
      notes: raw.notes,
    });
  }

  return items.sort((a, b) => a.datasetKey.localeCompare(b.datasetKey));
}
