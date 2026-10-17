import { createHash } from "node:crypto";
import { writeFileSync, statSync, readFileSync } from "node:fs";
import {
  artifactPath,
  resumableDownload,
  makeProvenance,
  type BootstrapConnector,
  type ConnectorContext,
  type ConnectorRunResult,
} from "@polaris/connector-sdk";
import type { ConnectorManifest } from "@polaris/domain";

const AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv";

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

export const ourairportsConnector: BootstrapConnector = {
  manifest: {
    id: "ourairports",
    displayName: "OurAirports",
    domains: ["airport"],
    license: "Public-Domain",
    attribution: "OurAirports.com",
    homepage: "https://ourairports.com/data/",
    accessMode: "bulk_download",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "frequent",
    notes: "CSV filtered by AOI bbox.",
  } satisfies ConnectorManifest,

  async discover() {
    return { available: true };
  },

  async fetch(ctx: ConnectorContext): Promise<ConnectorRunResult> {
    try {
      const csvPath = artifactPath(ctx, "ourairports", "airports.csv");
      const dl = await resumableDownload({ url: AIRPORTS_CSV, destPath: csvPath });
      const text = readFileSync(csvPath, "utf8");
      const rows = parseCsv(text);
      const header = rows[0] ?? [];
      const latIdx = header.indexOf("latitude_deg");
      const lonIdx = header.indexOf("longitude_deg");
      const typeIdx = header.indexOf("type");
      const nameIdx = header.indexOf("name");
      const icaoIdx = header.indexOf("ident");

      if (latIdx < 0 || lonIdx < 0) {
        return {
          manifest: this.manifest,
          status: "failed",
          artifacts: [],
          warnings: [],
          errors: ["OurAirports CSV missing lat/lon columns"],
        };
      }

      const features = [];
      for (const row of rows.slice(1)) {
        const lat = Number(row[latIdx]);
        const lon = Number(row[lonIdx]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (
          lon < ctx.bbox.minLon ||
          lon > ctx.bbox.maxLon ||
          lat < ctx.bbox.minLat ||
          lat > ctx.bbox.maxLat
        ) {
          continue;
        }
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: {
            name: row[nameIdx],
            ident: row[icaoIdx],
            type: row[typeIdx],
            source: "ourairports",
          },
        });
      }

      const geoPath = artifactPath(ctx, "ourairports", "airports.geojson");
      const geoText = JSON.stringify({ type: "FeatureCollection", features }, null, 2);
      writeFileSync(geoPath, geoText, "utf8");
      const sha = createHash("sha256").update(geoText).digest("hex");

      return {
        manifest: this.manifest,
        status: features.length ? "success" : "partial",
        artifacts: [
          {
            relativeKey: "airports.csv",
            mediaType: "text/csv",
            path: dl.path,
            sha256: dl.sha256,
            bytes: dl.bytes,
          },
          {
            relativeKey: "airports.geojson",
            mediaType: "application/geo+json",
            path: geoPath,
            sha256: sha,
            bytes: statSync(geoPath).size,
          },
        ],
        provenance: makeProvenance({
          sourceId: "ourairports",
          sourceName: "OurAirports",
          license: "Public-Domain",
          attribution: "OurAirports.com",
          accessMode: "bulk_download",
          sourceUrl: AIRPORTS_CSV,
        }),
        entityCount: features.length,
        warnings: features.length
          ? []
          : ["No airports inside AOI bbox (may be expected for small AOIs)."],
        errors: [],
      };
    } catch (err) {
      return {
        manifest: this.manifest,
        status: "failed",
        artifacts: [],
        warnings: [],
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  },
};
