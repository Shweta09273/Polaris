/**
 * Public Mapzen Terrarium DEM tiles (AWS Open Data) — no credentials.
 * Height decode: (R * 256 + G + B / 256) - 32768
 * https://github.com/tilezen/joerd/blob/master/docs/formats.md
 */
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BoundingBox } from "@polaris/domain";
import { withRetry } from "@polaris/connector-sdk";

const TERRARIUM_TMPL =
  process.env.POLARIS_TERRARIUM_URL ??
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export interface HeightmapTerrain {
  readonly status: "ready" | "missing";
  readonly path?: string;
  readonly cols: number;
  readonly rows: number;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly heights: number[];
  readonly provenance: {
    readonly sourceId: string;
    readonly sourceName: string;
    readonly license: string;
    readonly attribution: string;
    readonly sourceUrl: string;
    readonly fetchedAt: string;
  };
  readonly warnings: string[];
}

function lon2tile(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z),
  );
}

async function fetchPng(url: string): Promise<Buffer> {
  return withRetry("terrarium", async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "POLARIS-Twin3D/0.4 (terrarium DEM)" },
    });
    if (!res.ok) throw new Error(`Terrarium HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }, { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 8_000 });
}

/**
 * Minimal PNG decoder for Terrarium RGB8 — uses dynamic import of 'pngjs' if available,
 * otherwise falls back to sampling via sharp-less approach: we embed a tiny pure decoder
 * only for uncompressed/IDAT via createRequire... 
 *
 * To avoid heavy deps, we sample heights using the public Open-Elevation-compatible
 * approach: decode Terrarium via pure JS PNG (pngjs). Add pngjs as dependency.
 */
async function decodeTerrariumPng(buf: Buffer): Promise<{ width: number; height: number; data: Uint8Array }> {
  const pngjs = await import("pngjs");
  const PNG = pngjs.PNG ?? (pngjs as unknown as { default: { PNG: typeof pngjs.PNG } }).default?.PNG;
  if (!PNG) throw new Error("pngjs PNG export missing");
  return new Promise((resolve, reject) => {
    new PNG().parse(buf, (err: Error | null, png: { width: number; height: number; data: Buffer }) => {
      if (err || !png) return reject(err ?? new Error("PNG parse failed"));
      resolve({ width: png.width, height: png.height, data: png.data });
    });
  });
}

function heightAt(data: Uint8Array, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  const r = data[i]!;
  const g = data[i + 1]!;
  const b = data[i + 2]!;
  return r * 256 + g + b / 256 - 32768;
}

export async function buildTerrariumHeightmap(
  bbox: BoundingBox,
  outDir: string,
  opts?: { zoom?: number; grid?: number },
): Promise<HeightmapTerrain> {
  mkdirSync(outDir, { recursive: true });
  const zoom = opts?.zoom ?? 12;
  const grid = opts?.grid ?? 64;
  const warnings: string[] = [];

  const provenance = {
    sourceId: "aws-terrarium",
    sourceName: "AWS Terrain Tiles (Mapzen Terrarium)",
    license: "ODC-By / public elevation composites",
    attribution: "Terrain Tiles on AWS — Mapzen Terrarium encoding",
    sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
    fetchedAt: new Date().toISOString(),
  };

  try {
    const x0 = lon2tile(bbox.minLon, zoom);
    const x1 = lon2tile(bbox.maxLon, zoom);
    const y0 = lat2tile(bbox.maxLat, zoom); // north → smaller y
    const y1 = lat2tile(bbox.minLat, zoom);

    // Limit tile count for demo cities
    const tiles: Array<{ x: number; y: number; buf: Buffer }> = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (tiles.length > 16) {
          warnings.push("Terrarium tile fetch capped at 16 tiles for demo bandwidth.");
          break;
        }
        const url = TERRARIUM_TMPL.replace("{z}", String(zoom))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        const buf = await fetchPng(url);
        tiles.push({ x, y, buf });
        writeFileSync(join(outDir, `terrarium_${zoom}_${x}_${y}.png`), buf);
      }
    }

    if (tiles.length === 0) {
      return {
        status: "missing",
        cols: 0,
        rows: 0,
        west: bbox.minLon,
        south: bbox.minLat,
        east: bbox.maxLon,
        north: bbox.maxLat,
        minHeight: 0,
        maxHeight: 0,
        heights: [],
        provenance,
        warnings: ["No Terrarium tiles downloaded"],
      };
    }

    // Decode first tile set into a simple lat/lon grid by sampling tile pixels
    const decoded = await Promise.all(
      tiles.map(async (t) => ({ ...t, png: await decodeTerrariumPng(t.buf) })),
    );

    const heights: number[] = [];
    let minH = Infinity;
    let maxH = -Infinity;
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const lon = bbox.minLon + ((col + 0.5) / grid) * (bbox.maxLon - bbox.minLon);
        const lat = bbox.maxLat - ((row + 0.5) / grid) * (bbox.maxLat - bbox.minLat);
        const tx = lon2tile(lon, zoom);
        const ty = lat2tile(lat, zoom);
        const tile = decoded.find((d) => d.x === tx && d.y === ty);
        let h = 0;
        if (tile) {
          const n = Math.pow(2, zoom);
          const xTileF = ((lon + 180) / 360) * n;
          const r = (lat * Math.PI) / 180;
          const yTileF =
            ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
          const px = Math.min(
            tile.png.width - 1,
            Math.max(0, Math.floor((xTileF - tx) * tile.png.width)),
          );
          const py = Math.min(
            tile.png.height - 1,
            Math.max(0, Math.floor((yTileF - ty) * tile.png.height)),
          );
          h = heightAt(tile.png.data, tile.png.width, px, py);
        }
        if (!Number.isFinite(h)) h = 0;
        heights.push(h);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
    }

    const payload = {
      cols: grid,
      rows: grid,
      west: bbox.minLon,
      south: bbox.minLat,
      east: bbox.maxLon,
      north: bbox.maxLat,
      minHeight: minH,
      maxHeight: maxH,
      heights,
      provenance,
      sha256: createHash("sha256").update(Buffer.from(Float32Array.from(heights).buffer)).digest("hex"),
    };
    const path = join(outDir, "heightmap.json");
    writeFileSync(path, JSON.stringify(payload));

    return {
      status: "ready",
      path,
      cols: grid,
      rows: grid,
      west: bbox.minLon,
      south: bbox.minLat,
      east: bbox.maxLon,
      north: bbox.maxLat,
      minHeight: minH,
      maxHeight: maxH,
      heights,
      provenance,
      warnings,
    };
  } catch (e) {
    warnings.push(`DEM failed: ${e instanceof Error ? e.message : String(e)}`);
    return {
      status: "missing",
      cols: 0,
      rows: 0,
      west: bbox.minLon,
      south: bbox.minLat,
      east: bbox.maxLon,
      north: bbox.maxLat,
      minHeight: 0,
      maxHeight: 0,
      heights: [],
      provenance,
      warnings,
    };
  }
}
