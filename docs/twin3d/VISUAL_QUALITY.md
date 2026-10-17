# Visual Quality — Digital Twin Viewer

Production visual stack for Cesium Mission Control (`TwinMissionControl` / `TwinCanvas`).

> **2026-07-30 — Stable path override:** HDR, MSAA×4, FXAA, and soft shadows caused
> fragment-shader / CesiumWidget init failures on some GPUs. Runtime boot now uses
> `createStableViewer()` (OSM + ellipsoid, no post-process). See
> [`RENDERING_REGRESSION_REPORT.md`](./RENDERING_REGRESSION_REPORT.md). Reintroduce
> extras one-by-one via `upgradeVisualsOptionally`.

## Blur audit (evidence)

Root causes of the soft “basic GIS” look before this pass:

| Factor | Prior state | Effect |
|---|---|---|
| Imagery | `tile.openstreetmap.org` carto raster | Map style, not aerial — looks painted / soft vs Google Earth |
| Terrain | `EllipsoidTerrainProvider` only | Flat globe; Terrarium DEM fetched but unused as terrain mesh |
| HDR | `highDynamicRange = false` | Flat lighting, weak atmosphere response |
| AA | FXAA off; MSAA default | Jagged silhouettes, shimmer on buildings |
| DPR | `resolutionScale = 1` | Soft on HiDPI (Windows 125–200% scaling) |
| Camera | Often ≥8 km altitude | Soft mipmaps on aerial tiles |
| Buildings | Flat beige fill, no height fallback docs | Toy extrusion look |
| Shadows | Off | No contact grounding |

## Imagery selection (automatic)

1. **Cesium Ion World Imagery (aerial)** — if `NEXT_PUBLIC_CESIUM_ION_TOKEN` set  
2. **Esri World Imagery** — public ArcGIS Online MapServer (Esri / Maxar / Earthstar; credits via provider)  
3. **OSM raster** — last-resort carto fallback (documented in UI Render stack)

Never fabricates imagery tiles.

## Terrain

- Prefer **Cesium World Terrain** (vertex normals + water mask) when Ion token present  
- Without Ion: ellipsoid + **AOI Terrarium heightmap samples** for building base elevations only (no fake global DEM from a local grid)  
- UI: **vertical exaggeration** default `1.0` (`scene.verticalExaggeration`)

## Rendering / lighting

- `resolutionScale = min(devicePixelRatio, 2)`  
- FXAA + MSAA ×4  
- HDR, globe lighting, dynamic atmosphere from sun, fog, sky/sun/moon  
- Soft shadows (2048 shadow map, capped distance)  
- Camera inertia (spin / translate / zoom)  
- Day / dusk / night clock presets  

## Buildings

- Heights from OSM `height` or `building:levels × 3.2`  
- **Documented fallback:** 10 m when both absent (`BUILDING_HEIGHT_FALLBACK_NOTE`)  
- Height-tinted materials, closed roofs, optional outlines (≤4k features), hover + selection edge highlight  
- Ground height from AOI DEM when World Terrain unavailable  

## Labels

- POIs: hospital / school / airport / station color coding  
- Distance display conditions + scale-by-distance (hide when zoomed out)  
- Named roads: labels only under ~1.2 km camera range  

## Performance (unchanged budgets)

Progressive chunked GeoJSON → Entity load, outline disable above 4k buildings, existing centroid budgets. Visual upgrades do **not** raise texture resolution unboundedly; they prefer aerial sources + DPR-aware rendering + LOD-friendly camera heights.

## Env

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_CESIUM_ION_TOKEN=   # optional — unlocks Ion aerial + World Terrain
```
