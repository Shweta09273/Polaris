# Bootstrap Operator Guide

## Run a city twin bootstrap

```bash
pnpm bootstrap:city -- "Greater Noida, India"
```

Inspect:

1. `bootstrap-report.md` — missing layers, licenses, scores
2. `city-dna.json` — metrics (null = unavailable, not zero-filled)
3. `twin/entities.json` — ontology entities with provenance ids

## Interpreting scores

| Score | Meaning |
|---|---|
| City Readiness | How completely public layers resolved for planning |
| Twin Readiness | Whether a connected twin skeleton exists for operators |
| Validation quality | Geometry/ID/license hygiene |

Exit code `2` means twin readiness &lt; 40 (usable report, incomplete twin).

## Credentials (optional)

| Env | Purpose |
|---|---|
| `OPEN_METEO_API_KEY` | Commercial Open-Meteo |
| `POLARIS_DOWNLOAD_DEM=true` | Enable DEM tile pull (bandwidth) |
| `POLARIS_DOWNLOAD_WORLDCOVER=true` | Enable WorldCover pull |
| `COPERNICUS_USERNAME/PASSWORD` | Sentinel STAC |
| `POLARIS_OVERPASS_URL` | Self-hosted Overpass |
| `DATABASE_URL` / `NEO4J_URI` / … | Mark storage targets (writers expand in M2.1) |

## What operators must not assume

- OSM hospitals ≠ official registry
- Missing utilities ≠ “no utilities”
- Flood discharge ≠ inundation map
- High City Readiness ≠ simulation-ready (needs DEM + hydro calibration)
