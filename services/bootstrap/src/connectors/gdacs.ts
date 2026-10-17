import {
  makeProvenance,
  type BootstrapConnector,
  type ConnectorRunResult,
} from "@polaris/connector-sdk";
import type { ConnectorManifest } from "@polaris/domain";
import { fetchJson, artifactPath, writeJson } from "@polaris/connector-sdk";
import { createHash } from "node:crypto";
import { writeFileSync, statSync } from "node:fs";

/**
 * GDACS — disaster alerts. Spatial filter by AOI bbox center distance (approx).
 */
export const gdacsConnector: BootstrapConnector = {
  manifest: {
    id: "gdacs",
    displayName: "GDACS Disaster Alerts",
    domains: ["disaster_event"],
    license: "Unknown-Needs-Review",
    attribution: "GDACS",
    homepage: "https://www.gdacs.org/",
    accessMode: "api",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "near-real-time",
    notes: "Alert feed — not complete historical extents.",
  } satisfies ConnectorManifest,

  async discover() {
    return { available: true };
  },

  async fetch(ctx): Promise<ConnectorRunResult> {
    const warnings: string[] = [];
    try {
      // GDACS RSS/JSON endpoints vary; use eventlist JSON if available
      const url = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromDate=2020-01-01&toDate=2030-01-01&alertlevel=Green;Orange;Red";
      const data = await fetchJson<unknown>(url).catch(async () => {
        // fallback RSS
        const rss = await fetch("https://www.gdacs.org/xml/rss.xml", {
          headers: { "User-Agent": "POLARIS-Bootstrap/0.2" },
        });
        if (!rss.ok) throw new Error(`GDACS RSS HTTP ${rss.status}`);
        return { format: "rss", body: await rss.text() };
      });

      const path = artifactPath(ctx, "gdacs", "events.json");
      const text = JSON.stringify(data, null, 2);
      writeFileSync(path, text, "utf8");
      warnings.push(
        "GDACS payload retained with provenance; spatial join to AOI applied in normalize if coordinates present. EM-DAT is not auto-ingested.",
      );

      return {
        manifest: this.manifest,
        status: "partial",
        artifacts: [
          {
            relativeKey: "events.json",
            mediaType: "application/json",
            path,
            sha256: createHash("sha256").update(text).digest("hex"),
            bytes: statSync(path).size,
          },
        ],
        provenance: makeProvenance({
          sourceId: "gdacs",
          sourceName: "GDACS",
          license: "Unknown-Needs-Review",
          attribution: "GDACS",
          accessMode: "api",
          sourceUrl: "https://www.gdacs.org/",
        }),
        warnings,
        errors: [],
      };
    } catch (err) {
      return {
        manifest: this.manifest,
        status: "unavailable",
        artifacts: [],
        warnings: [],
        errors: [err instanceof Error ? err.message : String(err)],
        missingReason: "GDACS endpoint unreachable or changed",
      };
    }
  },
};
