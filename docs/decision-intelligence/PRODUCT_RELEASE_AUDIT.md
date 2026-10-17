# POLARIS V1 — Product Release Audit

**Date:** 2026-08-01  
**Mode:** Stabilize only — no new product features, no UI redesign, no architecture rewrite  
**Audience:** Customer demo readiness (enterprise gate)

---

## Dependency graph (SSOT)

```
Frontend (MissionControl + TwinCanvas + MissionIntelligence)
    ↓  HTTP NEXT_PUBLIC_API_URL
API (apps/api · Fastify)
    ↓
Runtime / Twin routes (/v1/twin3d/*)
    ↓
Digital Twin package (data/twin3d/{slug}/ · scene.json + layers/*.geojson)
    ↓
Experiment Engine (@polaris/experiment-engine · spatial rules on twin GeoJSON)
    ↓
Decision Engine (@polaris/decision-engine · buildDecisionBrief(result) only)
    ↓
Mission Intelligence UI (props: brief + result — no parallel data)
    ↓
Rendering Pipeline (createStableViewer · OSM + ellipsoid · entity DataSources)
    ↓
Datasets (OSM twin layers · Terrarium heightmap · search-index.json)
    ↓
Storage (filesystem under data/twin3d/; experiment results in-memory Map)
```

| Layer | Path |
|---|---|
| Frontend shell | `apps/web/src/components/mission/MissionControl.tsx` |
| Cesium mount | `apps/web/src/components/mission/TwinCanvas.tsx` |
| Safe viewer | `apps/web/src/components/twin/cesiumVisual.ts` |
| Entity styles | `apps/web/src/components/twin/layerStyles.ts` |
| Mission Intelligence | `apps/web/src/components/mission/MissionIntelligence.tsx` |
| App state contract | `apps/web/src/components/mission/missionState.ts` |
| Twin API | `apps/api/src/modules/twin3d/routes.ts` |
| Experiment API | `apps/api/src/modules/experiments/routes.ts` |
| Experiment engine | `services/experiment-engine/src/{runners,spatial,catalog,loadTwin}.ts` |
| Decision engine | `services/decision-engine/src/index.ts` |
| Monaco twin | `data/twin3d/monaco/` |

---

## Critical issues & fixes

### P0 — Viewer destroyed every telemetry tick (flicker / FPS collapse / Monaco never sticks)

| Field | Detail |
|---|---|
| **Severity** | P0 — Blocks demo |
| **Root cause** | `TwinCanvas` `useEffect(..., [onReady])` + MissionControl `onReady={() => setViewerReady(true)}`. Telemetry `setState` re-rendered parent → new `onReady` → cleanup destroyed Viewer → recreate WebGL loop. |
| **File** | `TwinCanvas.tsx` (boot effect); `MissionControl.tsx` (TwinCanvas props) |
| **Function** | Viewer boot `useEffect`; `handleViewerReady` |
| **Fix applied** | Boot effect deps `[]`; callbacks via refs; stable `handleViewerReady` / `handleTelemetry`; destroy `ScreenSpaceEventHandler` on unmount; telemetry interval 1s + shallow equality skip |
| **Verification** | Hard reload Mission Control — Viewer remains single instance; FPS HUD stable; no globe flash |
| **Regression test** | Manual: change theme / pick mode / search — Viewer must not remount |

### P0 — Rain intensity changes ignored (identical experiment outputs)

| Field | Detail |
|---|---|
| **Severity** | P0 — Decision integrity |
| **Root cause** | `resolveRainIntensity` returned scenario preset whenever intensity matched *any* preset value (25/60/120/180), discarding operator `intensity_mm_hr`. |
| **File** | `services/experiment-engine/src/runners.ts` |
| **Function** | `resolveRainIntensity` |
| **Fix applied** | Always honor `intensity_mm_hr` when present; duration scales radius by √(duration/4); optional `impact_radius_m` ≥50 overrides |
| **Verification** | `audit-experiment-sensitivity.ts` **PASS** (2026-08-01): 60mm/2h → radius 136 / 15 buildings; 180mm/8h → radius 725 / 251 buildings; override 400 m → radius 400 |
| **Regression test** | `cd apps/api; pnpm exec tsx scripts/audit-experiment-sensitivity.ts` → exit 0; restart API after engine rebuild |

### P1 — Operator left on Earth globe

| Field | Detail |
|---|---|
| **Severity** | P1 — Demo flow break |
| **Root cause** | Monaco only loaded on button click; Viewer recreate also wiped mounted twin |
| **File** | `MissionControl.tsx` |
| **Function** | Auto-open `useEffect` + `openCity` → `mountScene` |
| **Fix applied** | After `viewerReady` + demo-cities, auto-open Monaco once; `mountScene` flies camera to city |
| **Verification** | Open app → camera flies Monaco without click |
| **Regression test** | Product flow Stage 7 checklist |

### P1 — Water layer absent

| Field | Detail |
|---|---|
| **Severity** | P1 — Dataset gap (not code) |
| **Root cause** | Overpass 504 during compile; `layers/water.geojson` is empty FeatureCollection; `scene.json` marks water `missing` |
| **File** | `data/twin3d/monaco/scene.json`, `layers/water.geojson` |
| **Fix applied** | None fabricated. Explicit missing in scene warnings. Recompile when Overpass healthy. |
| **Verification** | MI confidence `missingFactors` includes water |
| **Regression test** | Do not invent water polygons |

### P2 — Continuous Cesium render loop

| Field | Detail |
|---|---|
| **Severity** | P2 — GPU load |
| **Root cause** | `requestRenderMode: false` (intentional for interactive camera) |
| **File** | `cesiumVisual.ts` `createStableViewer` |
| **Fix applied** | Left continuous; primary GPU spike was Viewer recreate (P0). No HDR/MSAA/FXAA. |
| **Verification** | After P0 fix, FPS target 30–60 |
| **Regression test** | Task Manager GPU should not spike on idle after mount |

---

## Stage status

| Stage | Status | Notes |
|---|---|---|
| 1 Rendering | **Fixed** | Single Viewer; safe scene; no custom GLSL |
| 2 Digital Twin | **Fixed path** | Monaco package present; auto-mount + flyTo |
| 3 Entity interaction | **Intact** | Pick → metadata panel; search → selectAndFlyTo |
| 4 Experiments | **Fixed** | Intensity/duration/radius override change outputs |
| 5 Mission Intelligence | **Wired** | Cards/charts from `buildDecisionBrief(result)` only; empty state explicit |
| 6 System state | **Contract** | `missionState.ts` documents SSOT fields; MissionControl holds runtime state |
| 7 Product flow | **Ready for manual gate** | See checklist below |

---

## Product flow checklist (manual)

1. Open http://localhost:3000 (API on :4000)  
2. Viewer initializes once — no flicker  
3. FPS settles 30–60  
4. Monaco auto-loads (or Cities → Monaco)  
5. Camera flies Monaco  
6. Buildings / roads / vegetation / POIs appear (water may be missing — documented)  
7. Search “Hospital” → fly + highlight  
8. Click hospital → metadata (name, type, coordinates, dataset, osm_id)  
9. Extreme Rainfall · intensity 120 · Run  
10. Risk / buildings / roads / MI / confidence / strategies update  
11. Change intensity 60 vs 180 · re-run · outputs differ  
12. Export Decision Brief  

No refresh. No manual API. No placeholders when experiment has run.

---

## Known limitations (honest)

- Water layer empty (Overpass failure at compile) — not fabricated  
- Rainfall is a spatial digital experiment, not a hydrodynamic solver (stated in assumptions/warnings)  
- Terrain is ellipsoid at Viewer + DEM heightmap used in experiment engine (World Terrain upgrade deferred for GPU stability)  
- Experiment result store is in-memory (API process) — acceptable for V1 demo  

---

## Build / verify commands

```powershell
pnpm --filter @polaris/experiment-engine build
pnpm --filter @polaris/decision-engine build
cd apps/api; pnpm exec tsx scripts/audit-experiment-sensitivity.ts
pnpm dev
```

Restart `pnpm dev` after engine rebuild so API picks up new `dist`.
