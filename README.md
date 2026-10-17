# POLARIS

**AI Decision Intelligence Platform — Living Digital Twin of Cities**

POLARIS is an enterprise Decision Operating System. It builds a Living Digital Twin of urban environments so governments, planners, emergency responders, and infrastructure operators can understand cascading impacts across interconnected systems and receive AI-powered decision recommendations before acting.

> This repository currently delivers **Milestone 1 — Foundation**, **Milestone 2 — Bootstrap Engine**, and **Milestone 3 — Runtime + Package System**.  
> Simulation logic, AI model training, and the 3D twin engine are intentionally deferred.

---

## What POLARIS Is

| POLARIS is | POLARIS is not |
|---|---|
| A Decision Operating System | A dashboard product |
| A Living Digital Twin platform | A static 3D city viewer |
| A Knowledge Graph of city systems | A map tile renderer alone |
| Simulation-ready infrastructure | A trained AI model yet |

---

## Milestone 1 Scope

| Included | Explicitly deferred |
|---|---|
| Dataset research & connector contracts | Simulation engine logic |
| Enterprise architecture | AI model training / inference |
| Monorepo, DDD, hexagonal boundaries | Fake / dummy city datasets |
| Spatial + time-series + object storage design | Hardcoded infrastructure graphs |
| Auth, observability, CI/CD scaffolding | Production city deployment |
| Mission-control UI design system | End-user simulation workflows |
| Dependency & readiness report | Credential-backed live ingestion |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         POLARIS CONTROL PLANE                           │
│  Identity (OIDC) · Workspaces · Policy · Audit · Feature Flags          │
└─────────────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Web Client  │  │  API Gateway │  │  Twin API    │  │ Decision Surface │
│  (Next.js)   │──│  (NestJS)    │──│  Services    │──│ (future)         │
└──────────────┘  └──────────────┘  └──────┬───────┘  └──────────────────┘
                                           │
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │                                  │                                  │
┌───────▼────────┐              ┌──────────▼─────────┐              ┌─────────▼────────┐
│ Ingestion Mesh │              │ Living Knowledge   │              │ Observation Bus  │
│ Connectors +   │─────────────▶│ Graph (Neo4j)      │◀─────────────│ Telemetry / IoT  │
│ Prefect/Airflow│              │ + Twin Registry    │              │ Time Series      │
└───────┬────────┘              └──────────┬─────────┘              └─────────┬────────┘
        │                                  │                                  │
┌───────▼────────┐              ┌──────────▼─────────┐              ┌─────────▼────────┐
│ Object Storage │              │ Spatial DB         │              │ TSDB             │
│ (S3 / MinIO)   │              │ (PostGIS)          │              │ (TimescaleDB)    │
└────────────────┘              └────────────────────┘              └──────────────────┘
```

Full detail: [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md)

---

## Repository Layout

```
polaris/
├── apps/                  # Deployable applications
│   ├── web/               # Mission-control UI (Next.js)
│   ├── api/               # Core platform API (NestJS)
│   ├── gateway/           # Edge BFF / API gateway
│   └── ingestion-worker/  # Pipeline runners
├── packages/              # Shared libraries
│   ├── domain/            # Pure domain models & ports (re-exports ontology)
│   ├── ontology/          # Urban Ontology SSOT (entities, relations, state, …)
│   ├── contracts/         # OpenAPI / event / schema contracts
│   ├── design-system/     # UI primitives & tokens
│   ├── spatial/           # CRS, geometry, tiling utilities
│   └── config/            # Shared runtime config
├── services/              # Bounded-context services & connectors
│   ├── connectors/        # One module per public data source
│   ├── knowledge-graph/   # Graph write/query service
│   ├── twin-registry/     # Asset / infrastructure registry
│   ├── auth/              # Identity adapters
│   ├── simulation/        # Interface-only (Milestone 2+)
│   └── decision-engine/   # Interface-only (Milestone 3+)
├── infrastructure/        # Docker, K8s, Terraform, Helm, monitoring
├── data/                  # Local pipeline staging (gitignored payloads)
├── docs/                  # Architecture, datasets, design, ADRs
├── scripts/               # Developer & ops scripts
└── tests/                 # Cross-cutting e2e / contract tests
```

---

## Technology Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 + TypeScript + MapLibre + Cesium | Enterprise SSR, typed UI, 2D/3D geospatial |
| API | NestJS + Hexagonal modules | Clear DDD boundaries, DI, enterprise patterns |
| Ingestion | Python 3.12 + Prefect | Geospatial ecosystem (GDAL/rasterio), durable pipelines |
| Spatial DB | PostgreSQL 16 + PostGIS 3.4 | Industry standard for city-scale GIS |
| Time Series | TimescaleDB | Weather, AQI, flood discharge, traffic |
| Knowledge Graph | Neo4j 5 | Cascading impact traversal, relationship semantics |
| Object Storage | MinIO (dev) / S3 (prod) | DEM tiles, imagery, GTFS archives, COGs |
| Auth | Keycloak (OIDC/OAuth2) | Enterprise SSO, RBAC, multi-tenant ready |
| Messaging | NATS JetStream | Lightweight, cloud-native event backbone |
| Cache / Lock | Redis 7 | Sessions, rate limits, job coordination |
| Search | OpenSearch | Catalog discovery, asset search |
| Observability | OpenTelemetry + Prometheus + Grafana + Loki | Traces, metrics, logs as first-class |
| Containers | Docker + Kubernetes | Production SaaS path from day one |
| IaC | Terraform + Helm | Reproducible multi-env cloud deploy |

See [`docs/architecture/TECHNOLOGY_DECISIONS.md`](docs/architecture/TECHNOLOGY_DECISIONS.md).

---

## Quick Start (Local Foundation)

### Prerequisites

- Node.js 20+ (22 LTS recommended)
- pnpm 9+
- Python 3.12+
- Docker Desktop 4.30+
- Make (or use scripts in `scripts/`)

### Bootstrap

```bash
# 1. Clone and enter repo
cd polaris

# 2. Copy environment templates
cp .env.example .env

# 3. Install JS workspace
pnpm install

# 4. Start infrastructure dependencies (PostGIS, Neo4j, Redis, MinIO, Keycloak, …)
pnpm infra:up

# 5. Apply schemas / migrations (when available)
pnpm db:migrate

# 6. Run API + Web (only — avoids spawning every package watcher on Windows)
pnpm dev
```

> **Note:** `pnpm dev` runs `@polaris/api` + `@polaris/web` only.  
> Full-workspace watch (`pnpm dev:all`) can hit Windows process limits (error 1450).

Web (Cesium Digital Twin): `http://localhost:3000`  
API: `http://localhost:4000/health`

### Digital Twin (3D)

```bash
# Prebuild a demo city (optional — UI can also compile on click)
pnpm twin3d:city Monaco

pnpm dev
```

Click **Monaco**, **Singapore**, or **Amsterdam** in the UI. Docs: [`docs/twin3d/README.md`](docs/twin3d/README.md).  
Grafana: `http://localhost:3001`  
MinIO Console: `http://localhost:9001`  
Neo4j Browser: `http://localhost:7474`

Detailed setup: [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md)

---

## Documentation Map

| Document | Purpose |
|---|---|
| [`docs/datasets/DATASET_RESEARCH.md`](docs/datasets/DATASET_RESEARCH.md) | Public dataset inventory (Phase 1) |
| [`docs/ontology/README.md`](docs/ontology/README.md) | Urban Ontology & Knowledge Graph SSOT |
| [`docs/bootstrap/README.md`](docs/bootstrap/README.md) | Living City Bootstrap Engine (Milestone 2) |
| [`docs/runtime/RUNTIME_SPEC.md`](docs/runtime/RUNTIME_SPEC.md) | Runtime + Package System (Milestone 3) |
| [`docs/runtime/PACKAGE_FORMAT.md`](docs/runtime/PACKAGE_FORMAT.md) | Official `.polaris` PLRS format |
| [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md) | Full enterprise architecture |
| [`docs/architecture/BOUNDED_CONTEXTS.md`](docs/architecture/BOUNDED_CONTEXTS.md) | DDD contexts & ownership |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Development roadmap |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Contribution guide |
| [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) | Coding standards |
| [`docs/DEPENDENCY_REPORT.md`](docs/DEPENDENCY_REPORT.md) | Missing dependencies before simulation |
| [`docs/design-system/UI_DESIGN_SYSTEM.md`](docs/design-system/UI_DESIGN_SYSTEM.md) | Mission-control UI system |

---

## Data Integrity Policy

1. **Never fabricate city or infrastructure data.**
2. **Prefer automated connectors** over manual dumps when APIs exist.
3. If a dataset is unavailable publicly, document the gap and define a **port/interface** — do not invent values.
4. All ingested assets must carry **provenance, license, and freshness metadata**.
5. Derived products must preserve **attribution chains** (especially ODbL / CC BY sources).

---

## License

Source code: **Apache-2.0** (see `LICENSE`).  
Third-party datasets retain their original licenses (ODbL, CC BY, CDLA, Copernicus, etc.). Attribution requirements are tracked in `docs/datasets/`.

---

## Status

**Milestone 1 — Foundation** · Architecture · Dataset research · Modular monorepo · Design system · Dependency report

Next: Milestone 2 — Automated ingestion mesh + Living Knowledge Graph materialization for a first real AOI.
