import {
  type BootstrapConnector,
  type ConnectorRunResult,
  makeProvenance,
  artifactPath,
  writeJson,
} from "@polaris/connector-sdk";
import type { ConnectorManifest } from "@polaris/domain";

/**
 * Connectors that require bulk S3 / credentials: discover honestly, fetch metadata plan,
 * never invent rasters.
 */

function unavailable(
  manifest: ConnectorManifest,
  reason: string,
  warnings: string[] = [],
): ConnectorRunResult {
  return {
    manifest,
    status: "unavailable",
    artifacts: [],
    warnings,
    errors: [],
    missingReason: reason,
    provenance: makeProvenance({
      sourceId: manifest.id,
      sourceName: manifest.displayName,
      license: manifest.license,
      attribution: manifest.attribution,
      accessMode: manifest.accessMode,
      sourceUrl: manifest.homepage,
    }),
  };
}

export const copernicusConnector: BootstrapConnector = {
  manifest: {
    id: "copernicus",
    displayName: "Copernicus DEM GLO-30",
    domains: ["elevation_tile"],
    license: "Copernicus",
    attribution: "Copernicus DEM",
    homepage: "https://registry.opendata.aws/copernicus-dem/",
    accessMode: "s3",
    requiresCredentials: false,
    credentialEnvKeys: ["COPERNICUS_S3_ACCESS_KEY", "COPERNICUS_S3_SECRET_KEY"],
    updateCadence: "release-based",
    notes: "Tile plan recorded; full DEM mosaic download is operator-gated for bandwidth.",
  } satisfies ConnectorManifest,
  async discover() {
    return { available: true, reason: "Public AWS bucket; tile download optional" };
  },
  async fetch(ctx): Promise<ConnectorRunResult> {
    const plan = {
      product: "GLO-30",
      bbox: ctx.bbox,
      bucket: "s3://copernicus-dem-30m/",
      note: "Tiles intersecting AOI should be pulled with aws s3 cp --no-sign-request in production workers.",
      autoDownload: process.env.POLARIS_DOWNLOAD_DEM === "true",
    };
    const path = artifactPath(ctx, "copernicus", "dem-tile-plan.json");
    writeJson(path, plan);
    if (process.env.POLARIS_DOWNLOAD_DEM !== "true") {
      return {
        ...unavailable(
          this.manifest,
          "DEM tile plan written; set POLARIS_DOWNLOAD_DEM=true to enable multi-GB tile download in worker.",
          ["Elevation layer marked incomplete until tiles land in object storage."],
        ),
        artifacts: [
          {
            relativeKey: "dem-tile-plan.json",
            mediaType: "application/json",
            path,
            sha256: "plan",
            bytes: 0,
          },
        ],
        status: "partial",
      };
    }
    return unavailable(this.manifest, "DEM auto-download hook not fully wired in this build — plan only.");
  },
};

export const worldpopConnector: BootstrapConnector = {
  manifest: {
    id: "worldpop",
    displayName: "WorldPop Population",
    domains: ["population_cell"],
    license: "CC-BY-4.0",
    attribution: "WorldPop",
    homepage: "https://www.worldpop.org/",
    accessMode: "bulk_download",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "annual",
    notes: "Country GeoTIFF discovery; download gated.",
  } satisfies ConnectorManifest,
  async discover() {
    return { available: true };
  },
  async fetch(ctx): Promise<ConnectorRunResult> {
    const path = artifactPath(ctx, "worldpop", "discovery.json");
    writeJson(path, {
      bbox: ctx.bbox,
      city: ctx.cityName,
      catalog: "https://hub.worldpop.org/",
      status: "manual_or_worker_download_required",
    });
    return {
      manifest: this.manifest,
      status: "unavailable",
      artifacts: [
        {
          relativeKey: "discovery.json",
          mediaType: "application/json",
          path,
          sha256: "discovery",
          bytes: 0,
        },
      ],
      warnings: [],
      errors: [],
      missingReason:
        "WorldPop country GeoTIFF must be selected by ISO country and downloaded via WorldPop hub/FTP — not fabricated.",
      provenance: makeProvenance({
        sourceId: "worldpop",
        sourceName: "WorldPop",
        license: "CC-BY-4.0",
        attribution: "WorldPop",
        accessMode: "bulk_download",
        sourceUrl: "https://www.worldpop.org/",
      }),
    };
  },
};

export const esaWorldCoverConnector: BootstrapConnector = {
  manifest: {
    id: "esa-worldcover",
    displayName: "ESA WorldCover",
    domains: ["land_use_cell"],
    license: "CC-BY-4.0",
    attribution: "© ESA WorldCover project",
    homepage: "https://esa-worldcover.org/",
    accessMode: "s3",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "annual",
    notes: "COG tile plan for AOI.",
  } satisfies ConnectorManifest,
  async discover() {
    return { available: true };
  },
  async fetch(ctx): Promise<ConnectorRunResult> {
    const path = artifactPath(ctx, "esa-worldcover", "tile-plan.json");
    writeJson(path, {
      bbox: ctx.bbox,
      product: "WorldCover 2021 v200",
      access: "AWS Open Data / Terrascope",
      autoDownload: process.env.POLARIS_DOWNLOAD_WORLDCOVER === "true",
    });
    return {
      manifest: this.manifest,
      status: "partial",
      artifacts: [
        {
          relativeKey: "tile-plan.json",
          mediaType: "application/json",
          path,
          sha256: "plan",
          bytes: 0,
        },
      ],
      warnings: ["Land cover rasters not downloaded unless POLARIS_DOWNLOAD_WORLDCOVER=true."],
      errors: [],
      missingReason: process.env.POLARIS_DOWNLOAD_WORLDCOVER === "true"
        ? "Download worker not fully wired"
        : "Tile plan only — raster download gated",
      provenance: makeProvenance({
        sourceId: "esa-worldcover",
        sourceName: "ESA WorldCover",
        license: "CC-BY-4.0",
        attribution: "© ESA WorldCover project",
        accessMode: "s3",
        sourceUrl: "https://esa-worldcover.org/",
      }),
    };
  },
};

export const gtfsConnector: BootstrapConnector = {
  manifest: {
    id: "gtfs",
    displayName: "GTFS via Mobility Database",
    domains: ["metro_line", "transit_stop"],
    license: "Unknown-Needs-Review",
    attribution: "Per-agency GTFS license",
    homepage: "https://mobilitydatabase.org/",
    accessMode: "api",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "agency-dependent",
    notes: "Catalog search by city name; feed download when openly licensed.",
  } satisfies ConnectorManifest,
  async discover() {
    return { available: true };
  },
  async fetch(ctx): Promise<ConnectorRunResult> {
    const path = artifactPath(ctx, "gtfs", "catalog-search.json");
    try {
      const url = `https://bit.ly/catalogs-protobuf`; // may fail — honest
      writeJson(path, {
        city: ctx.cityName,
        bbox: ctx.bbox,
        note: "Use Mobility Database API / CSV catalog to locate feeds. No feed auto-assumed.",
        searchHint: `https://mobilitydatabase.org/`,
      });
      return {
        manifest: this.manifest,
        status: "unavailable",
        artifacts: [
          {
            relativeKey: "catalog-search.json",
            mediaType: "application/json",
            path,
            sha256: "search",
            bytes: 0,
          },
        ],
        warnings: [],
        errors: [],
        missingReason: `No GTFS feed automatically selected for "${ctx.cityName}". Register feed URL in workspace manifest when available.`,
      };
    } catch (err) {
      return unavailable(this.manifest, err instanceof Error ? err.message : String(err));
    }
  },
};

export const overtureConnector: BootstrapConnector = {
  manifest: {
    id: "overture",
    displayName: "Overture Maps Buildings",
    domains: ["building"],
    license: "ODbL-1.0",
    attribution: "Overture Maps Foundation",
    homepage: "https://docs.overturemaps.org/guides/buildings/",
    accessMode: "s3",
    requiresCredentials: false,
    credentialEnvKeys: [],
    updateCadence: "monthly",
    notes: "GeoParquet via S3; DuckDB worker recommended.",
  } satisfies ConnectorManifest,
  async discover() {
    return { available: true };
  },
  async fetch(ctx): Promise<ConnectorRunResult> {
    const path = artifactPath(ctx, "overture", "query-plan.json");
    writeJson(path, {
      theme: "buildings",
      bbox: ctx.bbox,
      release: "latest",
      note: "Execute with DuckDB/Athena against Overture S3 in ingestion worker.",
    });
    return {
      manifest: this.manifest,
      status: "partial",
      artifacts: [
        {
          relativeKey: "query-plan.json",
          mediaType: "application/json",
          path,
          sha256: "plan",
          bytes: 0,
        },
      ],
      warnings: ["Overture Parquet not pulled in-process; OSM buildings used as primary for M2 bootstrap."],
      errors: [],
      missingReason: "Bulk Parquet pull deferred to worker",
      provenance: makeProvenance({
        sourceId: "overture",
        sourceName: "Overture Maps",
        license: "ODbL-1.0",
        attribution: "Overture Maps Foundation",
        accessMode: "s3",
        sourceUrl: "https://docs.overturemaps.org/",
      }),
    };
  },
};

export const sentinelConnector: BootstrapConnector = {
  manifest: {
    id: "sentinel",
    displayName: "Sentinel-2 L2A Imagery",
    domains: ["imagery_scene"],
    license: "Copernicus",
    attribution: "Contains modified Copernicus Sentinel data",
    homepage: "https://dataspace.copernicus.eu/",
    accessMode: "stac",
    requiresCredentials: true,
    credentialEnvKeys: ["COPERNICUS_USERNAME", "COPERNICUS_PASSWORD"],
    updateCadence: "~5-day revisit",
    notes: "STAC search requires CDSE account for volume.",
  } satisfies ConnectorManifest,
  async discover() {
    const hasCreds = Boolean(process.env.COPERNICUS_USERNAME && process.env.COPERNICUS_PASSWORD);
    if (!hasCreds) {
      return { available: false, reason: "CDSE credentials missing" };
    }
    return { available: true };
  },
  async fetch(ctx): Promise<ConnectorRunResult> {
    const path = artifactPath(ctx, "sentinel", "stac-search-plan.json");
    writeJson(path, { bbox: ctx.bbox, collections: ["sentinel-2-l2a"] });
    if (!process.env.COPERNICUS_USERNAME) {
      return {
        manifest: this.manifest,
        status: "unavailable",
        artifacts: [
          {
            relativeKey: "stac-search-plan.json",
            mediaType: "application/json",
            path,
            sha256: "plan",
            bytes: 0,
          },
        ],
        warnings: [],
        errors: [],
        missingReason: "COPERNICUS_USERNAME/PASSWORD not set — Sentinel mosaic skipped",
      };
    }
    return unavailable(this.manifest, "STAC download worker not fully wired in this build");
  },
};
