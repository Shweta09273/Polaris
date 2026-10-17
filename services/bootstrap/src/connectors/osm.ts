import { createHash } from "node:crypto";
import { writeFileSync, statSync } from "node:fs";
import {
  artifactPath,
  fetchJson,
  makeProvenance,
  withRetry,
  type BootstrapConnector,
  type ConnectorContext,
  type ConnectorRunResult,
} from "@polaris/connector-sdk";
import type { BoundingBox, ConnectorManifest } from "@polaris/domain";
import { bboxAreaDeg2 } from "@polaris/spatial";

const OVERPASS = process.env.POLARIS_OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

function bboxClause(b: BoundingBox): string {
  // Overpass: south,west,north,east
  return `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
}

/** Profiles keep queries bounded; huge cities should use PBF extracts (reported in warnings). */
const PROFILES = {
  roads: `
    way["highway"]({{bbox}});
    relation["highway"]({{bbox}});
  `,
  buildings: `
    way["building"]({{bbox}});
    relation["building"]({{bbox}});
  `,
  hospitals: `
    nwr["amenity"="hospital"]({{bbox}});
    nwr["healthcare"="hospital"]({{bbox}});
  `,
  schools: `
    nwr["amenity"~"school|college|university"]({{bbox}});
  `,
  police: `nwr["amenity"="police"]({{bbox}});`,
  fire: `nwr["amenity"="fire_station"]({{bbox}});`,
  water: `
    nwr["natural"="water"]({{bbox}});
    way["waterway"]({{bbox}});
    relation["waterway"]({{bbox}});
  `,
  railway: `
    way["railway"]({{bbox}});
    nwr["railway"="station"]({{bbox}});
  `,
  metro: `
    relation["route"~"subway|light_rail|tram"]({{bbox}});
    nwr["station"="subway"]({{bbox}});
    nwr["railway"="subway_entrance"]({{bbox}});
  `,
  landuse: `nwr["landuse"]({{bbox}});`,
  airports_osm: `nwr["aeroway"~"aerodrome|airport"]({{bbox}});`,
} as const;

export type OsmProfile = keyof typeof PROFILES;

function buildQuery(profile: OsmProfile, bbox: BoundingBox): string {
  const body = PROFILES[profile].replaceAll("{{bbox}}", bboxClause(bbox));
  return `
[out:json][timeout:180];
(
${body}
);
out body;
>;
out skel qt;
`.trim();
}

async function runOverpass(query: string): Promise<unknown> {
  return withRetry("overpass", async () => {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "POLARIS-Bootstrap/0.2 (OSM connector; respectful use)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (res.status === 429 || res.status === 504) {
      throw new Error(`Overpass ${res.status}`);
    }
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Overpass HTTP ${res.status}: ${t.slice(0, 240)}`);
    }
    return res.json();
  });
}

export async function fetchOsmProfile(
  ctx: ConnectorContext,
  profile: OsmProfile,
): Promise<ConnectorRunResult> {
  const area = bboxAreaDeg2(ctx.bbox);
  const warnings: string[] = [];
  if (area > 1.5) {
    warnings.push(
      `AOI area ${area.toFixed(3)} deg² is large for public Overpass. Prefer Geofabrik PBF for production. Attempting profile "${profile}" anyway.`,
    );
  }

  try {
    const query = buildQuery(profile, ctx.bbox);
    const data = await runOverpass(query);
    const elements = (data as { elements?: unknown[] }).elements ?? [];
    const path = artifactPath(ctx, "osm", `${profile}.osm.json`);
    const text = JSON.stringify(data);
    writeFileSync(path, text, "utf8");
    const sha = createHash("sha256").update(text).digest("hex");

    return {
      manifest: osmConnector.manifest,
      status: elements.length ? "success" : "partial",
      artifacts: [
        {
          relativeKey: `${profile}.osm.json`,
          mediaType: "application/json",
          path,
          sha256: sha,
          bytes: statSync(path).size,
        },
      ],
      provenance: makeProvenance({
        sourceId: "osm.overpass",
        sourceName: "OpenStreetMap via Overpass API",
        license: "ODbL-1.0",
        attribution: "© OpenStreetMap contributors",
        accessMode: "api",
        sourceUrl: OVERPASS,
      }),
      entityCount: elements.length,
      warnings: elements.length
        ? warnings
        : [...warnings, `OSM profile "${profile}" returned 0 elements — layer may be unmapped.`],
      errors: [],
    };
  } catch (err) {
    return {
      manifest: osmConnector.manifest,
      status: "failed",
      artifacts: [],
      warnings,
      errors: [err instanceof Error ? err.message : String(err)],
      missingReason: `OSM Overpass failed for profile ${profile}`,
    };
  }
}

export const osmConnector: BootstrapConnector = {
  manifest: {
    id: "osm",
    displayName: "OpenStreetMap Core Extract",
    domains: ["road", "hospital", "school", "police_station", "fire_station", "railway", "waterway", "building"],
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    homepage: "https://www.openstreetmap.org/copyright",
    accessMode: "api",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "continuous",
    notes: "Multi-profile Overpass extraction for AOI.",
  } satisfies ConnectorManifest,

  async discover(ctx) {
    return {
      available: true,
      estimatedBytes: Math.round(bboxAreaDeg2(ctx.bbox) * 5_000_000),
    };
  },

  async fetch(ctx) {
    // Default fetch runs core profiles sequentially (polite)
    const profiles: OsmProfile[] = [
      "roads",
      "buildings",
      "hospitals",
      "schools",
      "police",
      "fire",
      "water",
      "railway",
      "metro",
      "landuse",
      "airports_osm",
    ];
    const artifacts = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let entityCount = 0;
    let anySuccess = false;

    for (const profile of profiles) {
      const result = await fetchOsmProfile(ctx, profile);
      artifacts.push(...result.artifacts);
      warnings.push(...result.warnings.map((w) => `[${profile}] ${w}`));
      errors.push(...result.errors.map((e) => `[${profile}] ${e}`));
      entityCount += result.entityCount ?? 0;
      if (result.status === "success" || result.status === "partial") anySuccess = true;
      // polite gap between Overpass calls
      await new Promise((r) => setTimeout(r, 2000));
    }

    return {
      manifest: this.manifest,
      status: anySuccess ? (errors.length ? "partial" : "success") : "failed",
      artifacts,
      provenance: makeProvenance({
        sourceId: "osm.overpass",
        sourceName: "OpenStreetMap via Overpass API",
        license: "ODbL-1.0",
        attribution: "© OpenStreetMap contributors",
        accessMode: "api",
        sourceUrl: OVERPASS,
      }),
      entityCount,
      warnings,
      errors,
    };
  },
};

/** Used when only metadata probe needed */
export async function probeOverpass(): Promise<boolean> {
  try {
    await fetchJson<{ osm3s?: unknown }>(`${OVERPASS}?data=[out:json];node(1);out;`);
    return true;
  } catch {
    return false;
  }
}
