# Bounded Contexts (DDD)

Each context is a deployable or logically isolated module with its own model. Cross-context communication uses published contracts in `packages/contracts` and domain events — never shared database tables across contexts.

---

## Context Map

| Context | Owner package / service | Core responsibility | Upstream / Downstream |
|---|---|---|---|
| **Identity & Access** | `services/auth`, Keycloak | Users, orgs, roles, tokens | Upstream to all |
| **Workspace & Tenancy** | `apps/api` module `workspace` | Orgs, workspaces, AOI membership | Downstream of IAM |
| **Catalog & Provenance** | `apps/api` module `catalog` | Dataset versions, licenses, lineage | Downstream of Ingestion |
| **Ingestion Mesh** | `apps/ingestion-worker`, `services/connectors/*` | Fetch, validate, land, normalize | Upstream of Twin & Graph |
| **Twin Registry** | `services/twin-registry` | Canonical assets & networks | Downstream of Ingestion |
| **Knowledge Graph** | `services/knowledge-graph` | Relationships & cascading paths | Downstream of Twin |
| **Observation** | `apps/api` module `observation` | Time-series & live feeds | Downstream of Ingestion |
| **Simulation** | `services/simulation` | Scenario runs (port only M1) | Downstream of Twin/Graph |
| **Decision Intelligence** | `services/decision-engine` | Recommendations (port only M1) | Downstream of Simulation |
| **Audit & Compliance** | `apps/api` module `audit` | Immutable action log | Observes all |

---

## Hexagonal Slice (per context)

```
src/
  domain/           # entities, value objects, domain events, ports (interfaces)
  application/      # use cases / command & query handlers
  infrastructure/   # adapters: postgres, neo4j, s3, http, nats
  interface/        # controllers, consumers, schedulers
```

Dependencies point **inward**. Domain never imports NestJS, Prisma, or HTTP clients.

---

## Ubiquitous Language (excerpt)

| Term | Meaning |
|---|---|
| **AOI** | Area of Interest — polygonal scope for a twin |
| **Asset** | Twin entity instance (prefer `EntityKind` over legacy `AssetType`) |
| **EntityKind** | Canonical ontology class (e.g. `Hospital`, `RoadSegment`) |
| **RelationType** | Canonical graph relationship (e.g. `DEPENDS_ON`, `POWERS`) |
| **NetworkLink** | Directed or undirected connection between assets |
| **DatasetVersion** | Immutable ingested batch with provenance |
| **Living Twin** | Continuously updated projection of assets + relations + observations |
| **CityState** | Aggregate current state of a TwinScope at an Epoch |
| **Cascade Path** | Graph walk describing dependency impact |
| **Decision** | First-class recommendation object (schema now; engine later) |
| **Digital Experiment** | Assumption-explicit trial against a TwinSnapshot |
| **Connector** | Adapter that pulls an external authoritative source |
| **Quarantine** | Holding area for failed validation batches |

---

## Anti-Corruption Layers

- OSM tags → normalized `AssetType` taxonomy in Twin Registry
- GTFS agency IDs → `TransitSystem` aggregate
- Open-Meteo variables → internal observation vocabulary
- Partner utility schemas → `UtilityNetworkPort` ACL

---

## Context Independence Rules

1. No foreign key across context databases.
2. Reference other aggregates by ID + published event.
3. Read models may denormalize copies explicitly marked as projections.
4. UI may compose multiple contexts via BFF — composition is not domain coupling.
