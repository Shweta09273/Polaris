# Final Product Sprint — POLARIS Demo

End-to-end demo path on the **Monaco Digital Twin SSOT**.

## Workflow

1. Open Mission Control (`pnpm dev` → http://localhost:3000)
2. Load **Monaco**
3. Explore twin (compass, FPS, coords, scale HUD)
4. Select **Extreme Rainfall Experiment**
5. Choose scenario: Normal / Heavy / Extreme / Cloudburst (+ optional wind)
6. Click map for epicenter → **Run experiment**
7. Animate timeline (Before → 30m → 1h → 2h → 4h → Recovery)
8. Review **Mission Intelligence** tabs (Brief / Evidence / Strategies / Confidence / Report)
9. **Export Executive Brief (PDF)** via print dialog

## Honesty

- Rainfall is a **digital experiment**, not a hydrodynamic flood model.
- Accumulation heatmap = DEM low-elevation × low-slope **proxy**.
- Population / € / delay metrics are **documented heuristics**.
- Missing layers reduce confidence breakdown factors explicitly.

## Production blockers (remaining)

| # | Blocker | Severity | Notes |
|---|---|---|---|
| 1 | No Cesium Ion token in default env | Medium | Falls back to Esri World Imagery; World Terrain needs `NEXT_PUBLIC_CESIUM_ION_TOKEN` |
| 2 | Monaco water layer often missing | Medium | Confidence/model scores penalized; no hydro routing |
| 3 | No true GPU memory API in browser | Low | Footer reports streaming/progressive load; Chrome `performance.measureUserAgentSpecificMemory` not portable |
| 4 | PDF is print-to-PDF | Low | Professional HTML brief; native `jspdf` binary optional later |
| 5 | Entity-based Cesium load still O(n) | Medium | Progressive chunks + budgets; 3D Tiles / vector tiles needed for city-scale |
| 6 | In-memory experiment store (API process) | Medium | Lost on restart; OK for demo, not multi-user persistence |
| 7 | Power/pipeline utility graphs absent | Medium | Spatial proxies only (documented) |
| 8 | Auth / tenancy not enforced on demo routes | High for prod | Demo API is open on localhost |
| 9 | Singapore/Amsterdam still budget-cropped | Medium | Full city needs Geofabrik/Overture offline path |
| 10 | No automated E2E browser test for Cesium | Medium | Smoke-tested experiment engine + typecheck |

## Build

```bash
pnpm --filter @polaris/experiment-engine build
pnpm --filter @polaris/decision-engine build
pnpm dev
```
