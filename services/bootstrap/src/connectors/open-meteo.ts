import { createHash } from "node:crypto";
import { writeFileSync, statSync } from "node:fs";
import {
  artifactPath,
  fetchJson,
  makeProvenance,
  type BootstrapConnector,
  type ConnectorContext,
  type ConnectorRunResult,
} from "@polaris/connector-sdk";
import type { ConnectorManifest } from "@polaris/domain";

function center(ctx: ConnectorContext): { lat: number; lon: number } {
  return {
    lat: (ctx.bbox.minLat + ctx.bbox.maxLat) / 2,
    lon: (ctx.bbox.minLon + ctx.bbox.maxLon) / 2,
  };
}

export const openMeteoConnector: BootstrapConnector = {
  manifest: {
    id: "open-meteo",
    displayName: "Open-Meteo Weather / Archive / Flood / Air Quality",
    domains: ["weather_station", "aqi_station"],
    license: "CC-BY-4.0",
    attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
    homepage: "https://open-meteo.com/",
    accessMode: "api",
    requiresCredentials: Boolean(process.env.OPEN_METEO_API_KEY),
    credentialEnvKeys: ["OPEN_METEO_API_KEY"],
    updateCadence: "hourly",
    notes: "Commercial SaaS requires paid plan.",
  } satisfies ConnectorManifest,

  async discover() {
    return { available: true };
  },

  async fetch(ctx: ConnectorContext): Promise<ConnectorRunResult> {
    const { lat, lon } = center(ctx);
    const warnings: string[] = [];
    const errors: string[] = [];
    const artifacts: Array<{
      relativeKey: string;
      mediaType: string;
      path: string;
      sha256: string;
      bytes: number;
    }> = [];
    const key = process.env.OPEN_METEO_API_KEY;
    if (!key) {
      warnings.push(
        "OPEN_METEO_API_KEY unset — using free public endpoint (non-commercial ToS; rate limited).",
      );
    }
    const keyParam = key ? `&apikey=${encodeURIComponent(key)}` : "";
    const host = key ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com";
    const archiveHost = key
      ? "https://customer-archive-api.open-meteo.com"
      : "https://archive-api.open-meteo.com";
    const floodHost = key
      ? "https://customer-flood-api.open-meteo.com"
      : "https://flood-api.open-meteo.com";
    const aqHost = key
      ? "https://customer-air-quality-api.open-meteo.com"
      : "https://air-quality-api.open-meteo.com";

    const writeArtifact = (name: string, data: unknown) => {
      const path = artifactPath(ctx, "open-meteo", name);
      const text = JSON.stringify(data, null, 2);
      writeFileSync(path, text, "utf8");
      artifacts.push({
        relativeKey: name,
        mediaType: "application/json",
        path,
        sha256: createHash("sha256").update(text).digest("hex"),
        bytes: statSync(path).size,
      });
    };

    try {
      const forecast = await fetchJson(
        `${host}/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,weather_code&forecast_days=3${keyParam}`,
      );
      writeArtifact("forecast.json", forecast);
    } catch (err) {
      errors.push(`forecast: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      const s = start.toISOString().slice(0, 10);
      const e = end.toISOString().slice(0, 10);
      const archive = await fetchJson(
        `${archiveHost}/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${s}&end_date=${e}&daily=precipitation_sum,temperature_2m_mean${keyParam}`,
      );
      writeArtifact("historical_rainfall.json", archive);
    } catch (err) {
      errors.push(`historical_rainfall: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const flood = await fetchJson(
        `${floodHost}/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=7${keyParam}`,
      );
      writeArtifact("flood_discharge.json", flood);
      warnings.push(
        "Open-Meteo Flood provides river discharge (GloFAS), not regulatory floodplain polygons.",
      );
    } catch (err) {
      errors.push(`flood: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const aq = await fetchJson(
        `${aqHost}/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,european_aqi${keyParam}`,
      );
      writeArtifact("aqi.json", aq);
    } catch (err) {
      errors.push(`aqi: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      manifest: this.manifest,
      status: artifacts.length ? (errors.length ? "partial" : "success") : "failed",
      artifacts,
      provenance: makeProvenance({
        sourceId: "open-meteo",
        sourceName: "Open-Meteo",
        license: "CC-BY-4.0",
        attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
        accessMode: "api",
        sourceUrl: "https://open-meteo.com/",
      }),
      entityCount: artifacts.length,
      warnings,
      errors,
    };
  },
};
