# POLARIS System Architecture

**Classification:** Foundation / Milestone 1  
**Audience:** Platform engineering, solutions architects, security, data engineering  
**Status:** Approved for implementation scaffolding

---

## 1. Product Architecture Statement

POLARIS is a **Decision Operating System** for cities. The platform materializes a **Living Digital Twin** — a continuously updated, provenance-backed graph of infrastructure, environment, population, and observations — and provides the runtime on which simulation and decision intelligence will later operate.

Milestone 1 builds the **control plane, data plane contracts, and operator surface**. It does not yet execute physics simulations or train models.

---

## 2. Architectural Style

| Principle | Application |
|---|---|
| **Domain-Driven Design** | Bounded contexts own models, persistence, and APIs |
| **Hexagonal Architecture** | Domain core isolated; adapters for DB, HTTP, queues, connectors |
| **Clean Architecture** | Dependency rule: inward toward domain; no framework leakage |
| **SOLID** | Ports/adapters, ISP for connectors, DIP for storage & auth |
| **Event-driven** | Ingestion and twin updates emit domain events on NATS |
| **CQRS (selective)** | Write models for twin mutations; read models for map/catalog |
| **Multi-tenant SaaS** | Workspace → Organization → AOI isolation from day one |

---

## 3. Bounded Contexts

See also [`BOUNDED_CONTEXTS.md`](./BOUNDED_CONTEXTS.md).

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Identity & Access│   │ Workspace &      │   │ Catalog &        │
│ (OIDC, RBAC)     │   │ Tenancy          │   │ Provenance       │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐
│ Ingestion Mesh   │──▶│ Twin Registry    │──▶│ Knowledge Graph  │
│ (Connectors)     │   │ (Assets)         │   │ (Relations)      │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐
│ Observation      │   │ Simulation*      │   │ Decision*        │
│ Telemetry        │   │ (ports only)     │   │ Intelligence     │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

\*Interface-only in Milestone 1.

---

## 4. Logical Component View

### 4.1 Frontend — Mission Control

- **App:** `apps/web` (Next.js App Router)
- **Map:** MapLibre GL (2D operational layers) + CesiumJS (3D terrain/buildings)
- **Design system:** `packages/design-system` (dark mission-control tokens)
- **State:** Server components for catalog; client for map/session; TanStack Query for API
- **Auth:** OIDC PKCE against Keycloak

### 4.2 API Layer

- **Edge / BFF:** `apps/gateway` — authn termination, rate limits, request shaping
- **Core API:** `apps/api` (NestJS) — domain modules, OpenAPI, multi-tenant guards
- **gRPC / internal:** service-to-service for graph & twin registry (optional Milestone 2)

### 4.3 AI Services (future-ready)

- Separate deployable `services/decision-engine`
- Model registry in object storage + metadata in catalog
- Inference behind async jobs; never block map UI
- Feature store interface defined; not implemented in M1

### 4.4 Simulation Engine (future-ready)

- `services/simulation` exposes `SimulationPort`
- Jobs scheduled via worker pool; results versioned in object storage
- Reads twin snapshot + scenario params; writes impact graph deltas

### 4.5 Living Knowledge Graph

- **Store:** Neo4j 5
- **Service:** `services/knowledge-graph`
- **Node types (initial):** `Asset`, `NetworkLink`, `AdminArea`, `HazardZone`, `ObservationSeries`, `Organization`, `DatasetVersion`
- **Edge types (initial):** `CONNECTS`, `SERVES`, `LOCATED_IN`, `DEPENDS_ON`, `EXPOSES`, `OBSERVED_BY`, `DERIVED_FROM`
- Graph is the system of record for **relationships**; geometry lives in PostGIS; time series in TimescaleDB; blobs in object storage. IDs are shared (ULID/UUID).

### 4.6 Twin Registry

- Canonical inventory of infrastructure entities
- Soft deletes, versioning, AOI scoping
- PostGIS geometries + Neo4j projection

### 4.7 Spatial Database

- PostgreSQL 16 + PostGIS 3.4
- Schemas: `catalog`, `twin`, `ingest`, `iam`
- Partitioning by AOI where needed
- Spatial indexes (GiST / BRIN for rasters metadata)

### 4.8 Time Series Database

- TimescaleDB hypertables: weather, aqi, discharge, traffic (when available), sensor feeds
- Retention policies + continuous aggregates for dashboards

### 4.9 Object Storage

- MinIO (dev) / S3 (prod)
- Buckets: `raw`, `staging`, `processed`, `imagery`, `dem`, `models`, `exports`, `audit`
- All objects addressed by content hash + catalog pointer

### 4.10 Authentication & Authorization

- Keycloak realms per environment
- OIDC + OAuth2; service accounts for workers
- RBAC roles: `platform_admin`, `org_admin`, `analyst`, `operator`, `viewer`, `connector_runner`
- ABAC hooks for AOI and data classification (public / restricted / partner)

### 4.11 Messaging

- NATS JetStream subjects: `ingest.>`, `twin.>`, `graph.>`, `obs.>`, `sim.>`, `decision.>`
- At-least-once with idempotent consumers

### 4.12 Monitoring, Logging, Analytics

| Signal | Stack |
|---|---|
| Traces | OpenTelemetry → Tempo / Jaeger |
| Metrics | Prometheus + Grafana |
| Logs | Loki (structured JSON) |
| FE analytics | Privacy-preserving product analytics (Plausible or self-hosted) — no PII |
| Audit | Immutable append log in Postgres + object storage copies |

### 4.13 CI/CD

- GitHub Actions: lint → typecheck → unit → build → container scan → deploy
- Environments: `dev` → `staging` → `prod`
- Progressive delivery via Helm + Argo CD (recommended) or Actions + kubectl
- SBOM generation (Syft) + vulnerability scan (Trivy/Grype)

### 4.14 Containerization & Cloud

- Multi-stage Dockerfiles per app
- Kubernetes manifests under `infrastructure/kubernetes`
- Terraform modules for VPC, managed Postgres/PostGIS (or Cloud SQL + PostGIS), Neo4j Aura or self-managed, S3, IAM, EKS/GKE/AKS
- **Cloud-neutral:** AWS primary reference architecture; Azure/GCP overlays supported

---

## 5. Data Flow — Ingestion to Twin

```
Public Source
    │
    ▼
Connector Adapter ── validates license + schema
    │
    ▼
Object Storage (raw) ── immutable landing
    │
    ▼
Normalize / Reproject / Validate (Prefect flow)
    │
    ├──▶ PostGIS (geometries, attributes)
    ├──▶ TimescaleDB (observations)
    ├──▶ Neo4j (entities + relations)
    └──▶ Catalog (DatasetVersion + provenance)
    │
    ▼
Domain Events (NATS) → UI subscriptions / webhooks
```

---

## 6. Security Architecture

- TLS everywhere; mTLS for internal mesh (Linkerd/Istio optional)
- Secrets in cloud KMS / Kubernetes Secrets sealed (SOPS/External Secrets)
- Network policies default-deny
- PII minimization; city operational data classification
- Supply-chain: pinned dependencies, signed images (cosign)
- Penetration test gate before any production city onboarding

---

## 7. Scalability Targets (Design Envelope)

| Dimension | M1 Design Target |
|---|---|
| Concurrent operator sessions | 1,000+ |
| AOIs per tenant | 100+ |
| Assets per AOI | 10M+ features |
| Ingestion throughput | Parallel per-connector workers |
| Graph traversal | Sub-second 2–3 hop for critical dependency queries (indexed) |
| Map vector tiles | Tile server / PMTiles from PostGIS exports |

Horizontal scale: stateless APIs; partitioned workers; read replicas for PostGIS; Neo4j clustering for HA.

---

## 8. Failure Domains

- Connector failure must not corrupt twin (quarantine bad batches)
- Graph projection eventually consistent with PostGIS source of geometry truth
- Simulation/decision outages must not take down map or catalog

---

## 9. Explicit Non-Architecture (M1)

- No embedded fake city JSON
- No in-memory mock hospitals as “demo mode” pretending to be production
- No training pipelines until provenance-complete feature store exists

---

## 10. Related Documents

- [`TECHNOLOGY_DECISIONS.md`](./TECHNOLOGY_DECISIONS.md)
- [`BOUNDED_CONTEXTS.md`](./BOUNDED_CONTEXTS.md)
- [`../datasets/DATASET_RESEARCH.md`](../datasets/DATASET_RESEARCH.md)
- [`../DEPENDENCY_REPORT.md`](../DEPENDENCY_REPORT.md)
- ADRs in `docs/adr/`
