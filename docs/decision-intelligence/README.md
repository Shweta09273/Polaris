# Decision Intelligence V1

POLARIS Version 1 extends the Monaco Digital Twin (SSOT) with three integrated systems.

## Systems

1. **Digital Experiment Engine** (`@polaris/experiment-engine`)  
2. **AI Decision Intelligence** (`@polaris/decision-engine`) — rules over experiment outputs only  
3. **Mission Control UI V2** (`apps/web` Mission Control) — three themes

## Workflow

Choose City → Choose Scenario → Configure Parameters → Run Experiment → Results → Decision Brief

Users do **not** ask free-form AI questions. Decisions require an experiment result.

## Scenarios

| Kind | Notes |
|---|---|
| `heavy_rain` | Intensity→radius; DEM low-elevation priority when available |
| `road_closure` | Close roads in radius; hospital access risk |
| `building_fire` | Nearest OSM building ignition + exposure buffer |
| `power_failure` | Spatial outage proxy (no power graph in twin — documented) |
| `medical_emergency` | Operator casualty input + nearest hospital POIs |
| `extreme_heat` | Dense building clusters + vulnerable POIs |
| `water_pipeline_failure` | Circular impact proxy (no utility graph — documented) |

## Honesty

- Every affected entity ID comes from twin GeoJSON.
- Population / economic figures are **documented proxies** carried as assumptions.
- Missing layers reduce confidence and appear in warnings.
- No LLM fabrication path in V1.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/experiments/catalog` | Scenario library |
| POST | `/v1/experiments/run` | Run experiment + decision brief |
| GET | `/v1/experiments/:resultId` | Fetch result |
| GET | `/v1/experiments/:resultId/layers/:layerId` | Output GeoJSON |
| POST | `/v1/decisions/briefs` | `{ resultId }` → brief |

## UI themes

- Mission Dark
- Aurora Light
- Cosmic Nebula

Theme persists in `localStorage` (`polaris.mc.theme`).

## Run

```bash
pnpm install
pnpm --filter @polaris/twin-geometry build
pnpm --filter @polaris/experiment-engine build
pnpm --filter @polaris/decision-engine build
pnpm dev
```

Open http://localhost:3000 → Monaco → Extreme Rainfall → Run → Mission Intelligence → Export PDF.

See also [`FINAL_SPRINT.md`](./FINAL_SPRINT.md) for the production demo path and remaining blockers.
