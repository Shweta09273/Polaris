# Cesium Rendering Regression Report

**Date:** 2026-07-30  
**Status:** Stable boot path restored (safe defaults only)  
**Scope:** Rendering pipeline only — AI / experiments / Mission Intelligence UI untouched

## Verdict

Viewer construction failed after the visual-quality pass introduced HDR, MSAA×4, FXAA, soft shadows, globe lighting, and invalid imagery mipmap filters. Those features have been disabled. Boot is now: standard Cesium Viewer + OSM raster + ellipsoid terrain + standard entity styling/picking.

## Root cause (primary)

| # | Feature | File | Approx. lines | Failure mode | Rollback |
|---|---|---|---|---|---|
| 1 | HDR | `cesiumVisual.ts` `applyPremiumSceneSettings` | ~`highDynamicRange = true` | Fragment shader compile / CesiumWidget init fail on some Windows GPU drivers | Forced `false` in `applySafeSceneSettings` |
| 2 | MSAA ×4 | same | ~`msaaSamples = 4` | Multi-sample framebuffer / shader path fails at Viewer construct | Forced `msaaSamples = 1` |
| 3 | FXAA post-process | same | ~`postProcessStages.fxaa.enabled = true` | Post-process fragment shader compile failure | Forced `enabled = false` |
| 4 | Soft shadows + shadow map | same + Viewer `shadows: true` | ~`viewer.shadows`, `shadowMap.softShadows` | Shadow-map shaders fail on unsupported drivers | `viewer.shadows = false`, `terrainShadows = 0`, entity `ShadowMode.DISABLED` |
| 5 | Globe lighting / atmosphere intensity | same | ~`globe.enableLighting`, dynamic atmosphere | Extra lighting shader variants | `globe.enableLighting = false` |
| 6 | DPR `resolutionScale` | same | ~`min(devicePixelRatio, 2)` | Higher fill-rate; secondary stress (not primary crash) | Forced `resolutionScale = 1` |
| 7 | Invalid imagery min filter | `tuneImageryLayer` | `LINEAR_MIPMAP_LINEAR` | `DeveloperError: ImageryLayer minification filter must be NEAREST or LINEAR` | Use `LINEAR` only |
| 8 | Custom `DirectionalLight` intensity 2.2 | `TwinMissionControl.tsx` / prior `TwinCanvas` | boot path | Nonstandard lighting path after construct | Removed; Cesium default sun light |
| 9 | Premature aerial + World Terrain at construct | prior Viewer options | `createWorldTerrainAsync` + Ion/Esri before/at Viewer | Heavier globe shaders before Viewer alive | Boot OSM + ellipsoid only; upgrade deferred |

## Working baseline (restored)

| Capability | Implementation |
|---|---|
| Viewer init | `createStableViewer()` — OSM + ellipsoid, WebGL1 retry |
| Scene | `applySafeSceneSettings()` — no HDR / MSAA / FXAA / shadows |
| Imagery | OSM raster (`tile.openstreetmap.org`) |
| Terrain | `EllipsoidTerrainProvider` |
| Buildings / roads / POIs | Standard `ColorMaterialProperty` entity styles (`layerStyles.ts`) |
| Picking | `selectedEntityChanged` + `ScreenSpaceEventHandler` entity pick |
| Search / fly-to | Unchanged Mission Control path (not part of shader stack) |

## Boot call chain

1. `TwinCanvas.tsx` → `createStableViewer(Cesium, container)`
2. `new Cesium.Viewer(...)` with OSM + ellipsoid (+ WebGL1 fallback)
3. `applySafeSceneSettings` + `tuneImageryLayer(LINEAR)`
4. Layer GeoJSON load + `style*Entity` (shadows disabled)

Optional upgrades (Task 5 — off by default):

```ts
import { upgradeVisualsOptionally } from "../twin/cesiumVisual";
// After Viewer is confirmed stable:
await upgradeVisualsOptionally(Cesium, viewer, { imagery: true, terrain: false });
// then terrain, then (only if GPU allows) re-enable AA / lighting one flag at a time
```

## Compatibility matrix

| Feature | Status | Reintroduce order | Risk |
|---|---|---|---|
| OSM + ellipsoid Viewer | **ON** | — | Low |
| Entity buildings/roads/POIs | **ON** | — | Low |
| Entity picking / search | **ON** | — | Low |
| Esri / Ion aerial | **OFF** | 1 — `upgradeVisualsOptionally({ imagery: true })` | Medium (network / provider) |
| World Terrain | **OFF** | 2 — `{ terrain: true }` | Medium (globe shaders) |
| FXAA | **OFF** | 3 — enable alone | High (post-process GLSL) |
| MSAA 2→4 | **OFF** | 4 | High |
| HDR | **OFF** | 5 | High (known crash class) |
| Soft shadows | **OFF** | 6 last | Highest |

## Files changed for restore

| File | Change |
|---|---|
| `apps/web/src/components/twin/cesiumVisual.ts` | Safe boot API; premium path no-ops to safe; deferred upgrades |
| `apps/web/src/components/mission/TwinCanvas.tsx` | Uses `createStableViewer` only |
| `apps/web/src/components/twin/TwinMissionControl.tsx` | Same stable boot (legacy route) |
| `apps/web/src/components/twin/layerStyles.ts` | Building/road shadows `DISABLED` |

## Acceptance checklist

| Criterion | Expected |
|---|---|
| Cesium Viewer initializes | ✓ no CesiumWidget / WebGL init error |
| No fragment shader compile errors | ✓ advanced stages disabled |
| Monaco loads | ✓ twin GeoJSON path unchanged |
| Buildings / roads / hospitals / airports | ✓ standard entity styles |
| Picking + metadata + search | ✓ unchanged interaction path |
| FPS > 30 | Expected (lighter pipeline); confirm in HUD |
| No browser crash | ✓ |

## Policy until Task 5 complete

- Do not re-enable HDR / MSAA / FXAA / soft shadows without a per-feature render test.
- Do not add custom GLSL, CustomShader, or custom fragment materials.
- Do not modify AI, experiments, or Mission Intelligence for rendering work.
