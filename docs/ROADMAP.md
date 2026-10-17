# POLARIS Development Roadmap

Honest, production-oriented sequencing. No simulation or AI training until the twin is fed by real connectors.

---

## Milestone 1 — Foundation

**Status:** Complete (scaffolding)

- [x] Dataset research for all required domains
- [x] Enterprise architecture & technology decisions
- [x] DDD / hexagonal folder structure
- [x] Documentation set (README, setup, standards, contributing)
- [x] Docker / infra scaffolding
- [x] UI design system specification
- [x] Dependency & readiness report
- [x] Urban Ontology SSOT

**Exit criteria:** New engineer can bootstrap repo, understand architecture, and implement a connector without inventing data.

---

## Milestone 2 — Living City Bootstrap Engine

**Status:** Complete

**Objective:** `polaris bootstrap city "<name>"` builds a Living Twin skeleton from public datasets.

- [x] Connector SDK (retry, resumable download, checksum)
- [x] Dataset registry for required urban layers
- [x] Boundary resolution (Nominatim + validation)
- [x] Connectors: OSM profiles, geoBoundaries, OurAirports, Open-Meteo, GDACS, gated DEM/WorldPop/WorldCover/GTFS/Overture/Sentinel
- [x] Normalization to Urban Ontology
- [x] Validation engine
- [x] Filesystem twin persistence (+ honest DB skip)
- [x] Ontology-driven graph edge inference
- [x] City DNA + bootstrap report
- [x] CLI entrypoint
- [x] Docs + multi-persona architecture review

**Exit criteria:** Operator can bootstrap a named city and receive entities/edges/report without fabricated layers.

**Follow-ups (M2.1):** PostGIS/Neo4j bulk writers, Geofabrik PBF path, DuckDB Overture, WorldPop auto-clip.

---

## Milestone 3 — Runtime + Package System (CURRENT)

**Status:** Complete (foundation)

**Objective:** Execution environment + official `.polaris` distribution for compiled cities (Cloud + Local Package modes).

- [x] Official PLRS `.polaris` format (manifest, checksums, signatures, provenance, licenses)
- [x] Package pack / verify / unpack
- [x] City Registry (readiness, coverage, version, size, confidence, rollback)
- [x] Runtime (mount, validate, cache, corruption detect, twin metadata shell)
- [x] City Compiler wrapping Bootstrap → package → install
- [x] API routes for open/compile/import/export/progress
- [x] Mission Control shell (search, installed, packages, progress — no 3D)
- [x] Docs + multi-persona architecture review

**Exit criteria:** Operator can search/compile a city or import `City.polaris` and open twin metadata without manual dataset downloads.

**Follow-ups (M3.1):** Ed25519 trust store, remote package CDN, persistent compile jobs, tenancy.

---

## Milestone 4 — Living Knowledge Graph

**Objective:** Materialize relationships for cascading impact queries.

- Twin Registry service
- Neo4j projection pipelines
- Edge inference rules grounded in ontology
- Graph query API
- Freshness monitors & SLO dashboards

**Exit criteria:** Operator can ask “what depends on this arterial road segment?” and get graph-backed answers from real data.

---

## Milestone 5 — Observations & Situational Awareness

**Objective:** Live and historical environmental context.

- TimescaleDB hypertables for weather, AQI, river discharge
- Open-Meteo commercial credentials in prod
- WAQI optional station overlay
- Sentinel-2 basemap mosaic pipeline
- Alert rules engine (thresholding only — not ML)

**Exit criteria:** Mission control shows live weather/AQI/discharge against real twin layers.

---

## Milestone 6 — Simulation Runtime

**Objective:** Simulation engine against real twin snapshots.

- Snapshot versioning
- Flood inundation scenario (DEM + hydro — no fake bathymetry)
- Network disruption cascade
- Result layers & comparison UI

**Exit criteria:** One validated scenario type runs on a real AOI with documented uncertainty.

---

## Milestone 7 — Decision Intelligence

**Objective:** AI-assisted recommendations grounded in twin + simulation outputs.

- Feature store from provenance-complete data
- Decision Brief generator (grounded, cited)
- Human-in-the-loop approval
- Evaluation harness

**Exit criteria:** Recommendations cite twin entities, data versions, and simulation runs.

---

## Milestone 8 — Enterprise Hardening

- Multi-region HA
- Customer SSO / VPC peering
- Data residency controls
- Pen test + SOC2 path
- Partner connectors: utilities, traffic, emergency CAD

---

## Explicitly Out of Order

1. Training custom models on synthetic cities
2. Hardcoding a single demo city as product truth
3. Simulation before DEM + hydro + network ingestion
4. “AI chatbot over empty map”
