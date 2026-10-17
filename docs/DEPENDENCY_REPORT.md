# Dependency & Readiness Report

**Milestone:** 1 — Foundation  
**Purpose:** State what is complete, what blocks simulation, which credentials/APIs are required, and which assumptions must never be made.

---

## 1. What Is Complete (Milestone 1)

| Area | Status |
|---|---|
| Dataset research across all requested domains | Complete |
| Enterprise architecture (FE/BE/AI/Sim/KG/spatial/TS/object/auth/obs/CI/CD/K8s) | Complete (design + scaffolding) |
| Monorepo structure with DDD / hexagonal boundaries | Complete |
| Documentation (README, architecture, roadmap, contributing, coding standards, setup) | Complete |
| Docker Compose foundation for core dependencies | Scaffolded |
| Connector module placeholders per public source | Scaffolded (interfaces, not live pulls yet) |
| UI design system specification | Complete |
| Simulation & decision modules | Interface-only stubs |
| Fake/dummy city datasets | **Intentionally absent** |

---

## 2. What Data Is Still Missing (Cannot Simulate Yet)

Simulation and cascading-impact analysis require a **materialized twin**. None of the following are populated in this repository (by design):

| Required twin input | Public path | Status |
|---|---|---|
| AOI administrative boundary | geoBoundaries | Connector not yet executed |
| Terrain DEM | Copernicus GLO-30 | Not downloaded |
| Land cover | ESA WorldCover | Not downloaded |
| Road / rail network topology | OSM / Overture | Not ingested |
| Building footprints | Overture / Microsoft | Not ingested |
| Critical facilities | OSM POIs (+ official overlays) | Not ingested |
| Population surface | WorldPop | Not ingested |
| Hydrography | HydroSHEDS + OSM | Not ingested |
| Weather / rainfall history | Open-Meteo | Needs runtime + possibly commercial key |
| Flood discharge / zones | GloFAS + **national floodplain polygons** | Partial public; national often manual |
| Transit networks | GTFS if AOI publishes | City-dependent |
| Utility networks | Partner / government only | **Missing globally** |
| Live traffic | Commercial / city ITS | **Missing globally** |
| Operational emergency status | Agency CAD feeds | **Missing publicly** |
| Historical flood extents | Incomplete globally | **Do not invent** |
| EM-DAT disaster records | Restricted license | Needs access agreement |

**Bottom line:** Simulation is blocked until Milestone 2–3 complete for a chosen AOI.

---

## 3. APIs & Credentials Required

| Dependency | Required for | Credential | Notes |
|---|---|---|---|
| Open-Meteo commercial API | Production weather/AQI/flood/history at SaaS scale | Paid API key | Free tier is non-commercial + rate limited |
| WAQI | Station-level AQI | API token | Optional enrichment |
| Copernicus Data Space Ecosystem | High-volume Sentinel / some DEM STAC access | Free account; S3 keys for some paths | AWS open DEM bucket works for many GLO-30 tiles without account |
| GitHub Packages / container registry | CI images | Org tokens | Standard |
| Cloud provider (AWS/GCP/Azure) | Staging/prod | IAM roles | Not needed for local Docker |
| Keycloak admin | Local auth | Bootstrapped in Compose | Change defaults before any network exposure |
| Neo4j | Graph | Password in `.env` | |
| MinIO | Object storage | Access key/secret in `.env` | |
| Mobility Database / agency GTFS | Transit | Often none; some agencies require registration | Per AOI |
| EM-DAT | Historical disasters database | Registration / license | Do not scrape/redistribute blindly |
| National open data portals | Flood zones, parcels, utilities | Often free account + ToS | Per country |
| Commercial traffic (HERE/TomTom/Google) | Traffic scenarios | Paid contract | Optional Milestone 7 |
| Utility operators | Power/water/gas networks | Data sharing agreement | Required for utility cascade realism |

---

## 4. Government / Manual Download Dependencies

These frequently lack stable global APIs and need **manifest-driven or manual** acquisition:

| Dataset | Typical source type | Action |
|---|---|---|
| Regulatory flood hazard zones | National hydrology / disaster authority portals | Build per-country adapter; document manual steps |
| Cadastral parcels | State/city GIS | Partner integration |
| Official hospital / school registries | Health / education ministries | Prefer over OSM when available |
| Stormwater / sewer networks | Municipal utilities | Almost never fully open |
| Building permits / occupancy | City planning | Optional enrichment |
| Evacuation zones / shelters | Emergency management | Jurisdiction-specific |
| High-res national DEM / LiDAR | Survey departments | Prefer over Copernicus where licensed |

Each should be registered in Catalog as `access_mode: manual | portal | partner` with a runbook under `docs/runbooks/`.

---

## 5. Assumptions That Must NOT Be Made

1. **Do not assume OSM critical facilities are complete** for life-safety decisions.
2. **Do not assume Copernicus DSM equals bare-earth DTM** for flood physics without correction.
3. **Do not assume global flood zone polygons exist** — GloFAS is discharge, not regulatory inundation polygons.
4. **Do not fabricate utility networks** from road centerlines.
5. **Do not treat modelled AQI as station truth** without labeling uncertainty.
6. **Do not use GADM in commercial SaaS** without a commercial license — use geoBoundaries by default.
7. **Do not redistribute ODbL derivatives** without share-alike compliance.
8. **Do not claim “real-time traffic”** without a licensed feed.
9. **Do not train or demo AI recommendations** on empty or synthetic twins.
10. **Do not hardcode a single city** as the platform’s data model.
11. **Do not equate presence of a GTFS feed with complete metro coverage** of an AOI.
12. **Do not ignore license provenance** when merging Overture (ODbL) with CDLA footprints into redistributable products.

---

## 6. Readiness Scorecard (toward first simulation)

| Capability | Ready? | Blocker |
|---|---|---|
| Architecture | Yes | — |
| Repo / modules | Yes | — |
| Design system spec | Yes | Implementation polish ongoing |
| Connector contracts | Scaffolded | Implement + test against live sources |
| AOI bootstrap | No | Execute geoBoundaries + DEM + OSM pipelines |
| Knowledge graph | No | Needs twin entities first |
| Observations | No | Timescale + Open-Meteo wiring |
| Simulation engine | No | Intentionally deferred |
| Decision AI | No | Intentionally deferred |

**Estimated critical path to first honest simulation:** complete Milestone 2 + 3 for one AOI with DEM, hydro, roads, buildings, critical POIs, and population — then Milestone 5 scenario v1.

---

## 7. Recommended Immediate Next Actions

1. Fill `.env` from `.env.example` and bring up Compose stack.
2. Implement `DatasetConnectorPort` + first connector: **geoBoundaries**.
3. Implement **Copernicus DEM** tile selector for AOI bbox.
4. Implement **OSM extract** path via Geofabrik/osmium (not public Overpass for bulk).
5. Stand up Catalog API returning only real DatasetVersions.
6. Obtain Open-Meteo commercial plan before any public SaaS demo using weather APIs.
7. Open partner conversations for utilities and national floodplain data for target launch regions.

---

## 8. Sign-off

Milestone 1 delivers a **production-grade foundation** without false data confidence.  
The platform is **not simulation-ready** until the missing dependencies above are resolved with real sources.
