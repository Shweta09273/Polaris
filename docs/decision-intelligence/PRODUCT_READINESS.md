# Product Readiness Report — POLARIS V1

Generated after journey restore sprint. Digital Twin remains SSOT.

## Workflow map (UI → API → Runtime → Data → Cesium → Decision)

| Step | Path | Status |
|---|---|---|
| Boot viewer | `TwinCanvas` → Cesium Viewer + imagery/terrain | **Implemented** |
| List cities | UI → `GET /v1/twin3d/demo-cities` | **Implemented** |
| Open Monaco | UI → `POST /v1/twin3d/open` → `scene.json` or compile job | **Implemented** (job poll restored) |
| Mount twin | Progressive GeoJSON → Cesium entities + fly-to city | **Implemented** |
| Terrain | Twin DEM / Ion World Terrain | **Implemented** |
| Imagery | Ion → Esri → OSM (LINEAR filters only) | **Implemented** |
| Buildings / roads / POIs | Layer load + styles | **Implemented** |
| Search | UI → `GET .../search?q=` → fly-to + select | **Restored** |
| Picking | Click entity → metadata popup + selection panel | **Restored** (was broken by epicenter steal) |
| Layer toggles | `setLayerVisible` on dataSources | **Restored** (were UI-only stubs) |
| Experiment | `POST /v1/experiments/run` | **Implemented** |
| Timeline | Before…Recovery play/seek | **Implemented** |
| Mission Intelligence | Brief from experiment outputs | **Implemented** |
| Export PDF | Print-ready executive brief | **Implemented** |

## Regressions fixed this pass

1. **LEFT_CLICK stole entity picks** — epicenter only on empty globe when pick mode on; features select first.
2. **Search missing** from Mission Control V3 — restored with fly-to + highlight.
3. **Layer checkboxes dead** — now call `setLayerVisible`.
4. **Compile 202 ignored** — job polling restored until scene mounts.
5. **Camera framing** — aggressive city-height fly-to so user never stays on global Earth after Monaco.
6. **Metadata incomplete** — name, type, coordinates, dataset source, OSM id, geometry.
7. **Mission Intelligence placeholder** — shows **No experiment executed.** until run.
8. **Imagery LINEAR_MIPMAP_LINEAR** — previously fixed to LINEAR.

## Acceptance (API path) — 18/18 PASS

```
PASS  API health
PASS  Demo cities
PASS  Monaco open ready
PASS  Buildings / Roads / POIs / Terrain
PASS  Camera over Monaco
PASS  Search hospital / airport
PASS  Rainfall catalog
PASS  Experiment run + timeline + entities + layers
PASS  Mission Intelligence brief + Strategies ABC
```

Script: `apps/api/scripts/acceptance-v1.ts`

## Remaining blockers (not journey-breaking)

| Item | Severity |
|---|---|
| Cesium UI picking/search require browser (not in API acceptance) | Low |
| Water layer often missing in Monaco twin | Medium (confidence penalty) |
| Ion token optional for World Terrain | Medium |
| In-memory experiment store lost on API restart | Medium |
| No auth on demo API | High for production deploy |
| Print-to-PDF (not binary PDF lib) | Low |

## How to verify in UI

1. Refresh http://localhost:3000  
2. Click **Monaco** → camera flies to city; buildings/roads/POIs load  
3. Search `hospital` → fly-to + selection  
4. Click a building → metadata popup  
5. Toggle layers  
6. Extreme Rainfall → Run → timeline → Mission Intelligence → Export
