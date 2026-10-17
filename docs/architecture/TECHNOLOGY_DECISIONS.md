# Technology Decisions

Decision records for Milestone 1. Formal ADRs live in `docs/adr/`.

---

## Summary

| Concern | Decision | Alternatives considered | Why |
|---|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Nx, Bazel | Fast JS DX; Python services side-by-side without forcing one toolchain |
| Web | Next.js 15 + React 19 + TS | Remix, pure Vite SPA | SSR, routing, enterprise deployment patterns |
| Maps 2D | MapLibre GL | Leaflet, Google Maps | Open, vector-native, no vendor lock-in |
| Maps 3D | CesiumJS | Three.js custom, deck.gl only | Globe + terrain + tileset maturity |
| API | NestJS | FastAPI-only, Go Fiber | DDD modules, DI, guards, OpenAPI ecosystem |
| Pipelines | Prefect 3 + Python 3.12 | Airflow, Dagster | Lighter local DX; production scalable |
| Spatial DB | PostGIS 3.4 | Elasticsearch geo-only, SpatiaLite | Industry standard for digital twins |
| TSDB | TimescaleDB | InfluxDB, QuestDB | SQL continuity with Postgres |
| Graph | Neo4j 5 | Neptune, AGE, TigerGraph | Relationship-first queries for cascading impacts |
| Objects | MinIO / S3 | Azure Blob, GCS | S3 API ubiquity |
| Auth | Keycloak | Auth0, Cognito-only | Self-hostable OIDC for government deployments |
| Bus | NATS JetStream | Kafka, RabbitMQ | Operational simplicity; sufficient throughput for M1–M3 |
| Search | OpenSearch | Elasticsearch, Typesense | Open license posture |
| Observability | OTel + Grafana stack | Datadog-only | Avoid lock-in; air-gap friendly |
| IaC | Terraform + Helm | Pulumi, CDK | Broadest ops hiring familiarity |
| Containers | Docker + Kubernetes | Nomad, ECS-only | Enterprise SaaS default |

---

## ADR-001: Separate geometry store from knowledge graph

**Status:** Accepted  

**Context:** Digital twin platforms often try to force all data into one database.  

**Decision:** PostGIS owns geometries & attributes; Neo4j owns relationships & dependency semantics; TimescaleDB owns observations; object storage owns rasters/files. Shared ULIDs bind them.  

**Consequence:** Slightly more sync complexity; vastly better query fitness and scalability.

---

## ADR-002: Connectors are first-class services with ports

**Status:** Accepted  

**Context:** Temptation to hardcode one city’s open data.  

**Decision:** Every source is a connector implementing `DatasetConnectorPort` with license, schema, and freshness contracts. Missing sources get empty adapters that fail closed.  

**Consequence:** No fake data path; clear backlog of credentials and national portals.

---

## ADR-003: geoBoundaries over GADM for SaaS

**Status:** Accepted  

**Context:** GADM commercial licensing is restrictive.  

**Decision:** Default admin boundaries connector uses geoBoundaries (CC BY 4.0).  

**Consequence:** Possibly fewer admin levels in some countries; commercially safer.

---

## ADR-004: Dark mission-control UI, not dashboard kits

**Status:** Accepted  

**Context:** Generic admin dashboards undermine product identity.  

**Decision:** Custom design system inspired by Foundry / Linear / mission control — see UI design system doc.  

**Consequence:** Higher design investment; stronger brand and operator focus.

---

## ADR-005: Simulation and AI are ports until data is real

**Status:** Accepted  

**Context:** Premature simulation on empty twin creates false confidence.  

**Decision:** Define interfaces and empty modules only in Milestone 1.  

**Consequence:** No demo theater; honest dependency report.
