# Digital Twin 3D Pipeline

End-to-end path: **city name → public datasets → Cesium interactive twin**.

## Performance budgets (demo stability)

Measured failure mode: Cesium `GeoJsonDataSource` = **1 Entity per feature**.  
Amsterdam shipped **307k buildings / 143 MB** → browser thrash; Singapore **~180k entities** → OOM.

| Cap | Value |
|---|---|
| Buildings | 12,000 (centroid-nearest) |
| Roads | 15,000 |
| Water | 4,000 |
| Vegetation | 3,000 |
| Search index | POIs + named roads only (never every building) |

```bash
# Stabilize existing oversized artifacts without re-hitting Overpass
pnpm twin3d:city rebudget amsterdam
pnpm twin3d:city rebudget singapore
```

Client: progressive chunked Entity load + outline disable above 4k buildings.

See audit canvas: `twin-performance-audit.canvas.tsx`.

## Demo cities

| City | Notes |
|---|---|
| Monaco | Full AOI (small) — validated |
| Singapore | Center-cropped for Overpass limits; missing full-city extent reported |
| Amsterdam | Center-cropped if AOI exceeds safety limit |

## Pipeline (`@polaris/twin-geometry`)

1. Nominatim boundary  
2. OSM Overpass: buildings, roads, water, vegetation, POIs (`out geom`)  
3. AWS Terrarium DEM heightmap (public, no credentials)  
4. Scene graph + search index + `scene.json`  
5. Cesium Mission Control viewer

**Never fabricates geometry.** Missing layers are listed in `scene.missing` / UI panel.

## Commands

```bash
# Build a twin (CLI)
pnpm twin3d:city Monaco

# Run API + Web
pnpm dev
```

Open http://localhost:3000 → click **Monaco** / **Singapore** / **Amsterdam**.

## Decision Intelligence V1

Mission Control V2 + experiments + decision briefs: see [`../decision-intelligence/README.md`](../decision-intelligence/README.md).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/twin3d/demo-cities` | Supported demos |
| POST | `/v1/twin3d/open` | Open or compile |
| GET | `/v1/twin3d/jobs/:id` | Progress |
| GET | `/v1/twin3d/cities/:slug/scene` | Scene manifest |
| GET | `/v1/twin3d/cities/:slug/search?q=` | Fly-to search |
| GET | `/v1/twin3d/cities/:slug/file?path=` | GeoJSON / heightmap |

Artifacts: `data/twin3d/<slug>/`

## Honesty

- ESA WorldCover / Sentinel mosaics are **not** auto-downloaded — reported missing.  
- Large cities crop the Overpass bbox; warning explains Geofabrik/Overture for full coverage.  
- Cesium Ion token optional (`NEXT_PUBLIC_CESIUM_ION_TOKEN`); without it the viewer auto-selects **Esri World Imagery**, then OSM carto.

## Visual quality

See [`VISUAL_QUALITY.md`](./VISUAL_QUALITY.md) — blur audit, imagery/terrain selection, lighting, labels, building height fallbacks.

