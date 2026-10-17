import { createHash } from "node:crypto";
import { writeFileSync, statSync } from "node:fs";
import {
  artifactPath,
  fetchJson,
  fetchText,
  makeProvenance,
  writeJson,
  type BootstrapConnector,
  type ConnectorContext,
  type ConnectorRunResult,
} from "@polaris/connector-sdk";
import type { ConnectorManifest } from "@polaris/domain";

/**
 * geoBoundaries — attempt ADM2/ADM3 via API; report unavailable rather than invent.
 * API: https://www.geoboundaries.org/api/current/gbOpen/{ISO}/{ADM}/
 */

interface GeoBoundariesMeta {
  boundaryID?: string;
  boundaryName?: string;
  boundaryType?: string;
  gjDownloadURL?: string;
  imagePreview?: string;
}

function countryHintFromDisplayName(displayName: string): string | undefined {
  const parts = displayName.split(",").map((p) => p.trim());
  return parts.at(-1);
}

/** Very small ISO2 map for common demos — unknown countries → unavailable, not guessed wrong. */
const COUNTRY_ISO2: Record<string, string> = {
  India: "IND",
  Singapore: "SGP",
  Japan: "JPN",
  "United States": "USA",
  USA: "USA",
  "United Kingdom": "GBR",
  France: "FRA",
  Germany: "DEU",
  Australia: "AUS",
  Brazil: "BRA",
  Canada: "CAN",
  "United Arab Emirates": "ARE",
  UAE: "ARE",
};

export const geoboundariesConnector: BootstrapConnector = {
  manifest: {
    id: "geoboundaries",
    displayName: "geoBoundaries Administrative Boundaries",
    domains: ["admin_boundary"],
    license: "CC-BY-4.0",
    attribution: "geoBoundaries",
    homepage: "https://www.geoboundaries.org/",
    accessMode: "api",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "periodic releases",
    notes: "Preferred commercial-safe admin boundaries.",
  } satisfies ConnectorManifest,

  async discover(ctx) {
    const hint = countryHintFromDisplayName(ctx.cityName);
    const iso = hint ? COUNTRY_ISO2[hint] : undefined;
    if (!iso) {
      return {
        available: false,
        reason: `Cannot map country from "${ctx.cityName}" to ISO3 for geoBoundaries. Boundary still available via Nominatim.`,
      };
    }
    return { available: true };
  },

  async fetch(ctx: ConnectorContext): Promise<ConnectorRunResult> {
    const warnings: string[] = [];
    // Prefer country from resolved nominatim file if present
    let countryName: string | undefined;
    try {
      const boundaryMetaPath = `${ctx.workDir}/boundary/city-boundary.geojson`;
      const { readFileSync, existsSync } = await import("node:fs");
      if (existsSync(boundaryMetaPath)) {
        const doc = JSON.parse(readFileSync(boundaryMetaPath, "utf8")) as {
          polaris?: { displayName?: string };
        };
        countryName = countryHintFromDisplayName(doc.polaris?.displayName ?? ctx.cityName);
      }
    } catch {
      countryName = countryHintFromDisplayName(ctx.cityName);
    }

    const iso = countryName ? COUNTRY_ISO2[countryName] : undefined;
    if (!iso) {
      return {
        manifest: this.manifest,
        status: "unavailable",
        artifacts: [],
        warnings: [],
        errors: [],
        missingReason: `geoBoundaries requires ISO3 country code; could not resolve from "${countryName ?? ctx.cityName}".`,
      };
    }

    const levels = ["ADM2", "ADM1", "ADM3"] as const;
    const errors: string[] = [];
    for (const level of levels) {
      try {
        const api = `https://www.geoboundaries.org/api/current/gbOpen/${iso}/${level}/`;
        const meta = await fetchJson<GeoBoundariesMeta | GeoBoundariesMeta[]>(api);
        const first = Array.isArray(meta) ? meta[0] : meta;
        if (!first?.gjDownloadURL) {
          warnings.push(`No gjDownloadURL for ${iso}/${level}`);
          continue;
        }
        const text = await fetchText(first.gjDownloadURL);
        const path = artifactPath(ctx, "geoboundaries", `${iso}_${level}.geojson`);
        writeFileSync(path, text, "utf8");
        const sha = createHash("sha256").update(text).digest("hex");
        writeJson(artifactPath(ctx, "geoboundaries", `${iso}_${level}.meta.json`), first);
        return {
          manifest: this.manifest,
          status: "success",
          artifacts: [
            {
              relativeKey: `${iso}_${level}.geojson`,
              mediaType: "application/geo+json",
              path,
              sha256: sha,
              bytes: statSync(path).size,
            },
          ],
          provenance: makeProvenance({
            sourceId: "geoboundaries",
            sourceName: "geoBoundaries",
            license: "CC-BY-4.0",
            attribution: "geoBoundaries",
            accessMode: "api",
            sourceUrl: first.gjDownloadURL,
            sourceVersion: first.boundaryID,
          }),
          entityCount: JSON.parse(text).features?.length ?? undefined,
          warnings,
          errors: [],
        };
      } catch (err) {
        errors.push(`${level}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      manifest: this.manifest,
      status: "unavailable",
      artifacts: [],
      warnings,
      errors,
      missingReason: `geoBoundaries download failed for ${iso}: ${errors.join("; ")}`,
    };
  },
};
