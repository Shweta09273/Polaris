# Urban Ontology Specification

**POLARIS Decision Operating System**  
**Version:** 1.0.0  
**Authority:** `@polaris/ontology`

---

## 1. Purpose

POLARIS represents the urban (and multi-scale) world as a **connected knowledge graph**, not as disconnected GIS layers. Layers remain projections for visualization; **semantics live in the ontology**.

The ontology defines:

- What exists (entities)
- How things relate (relationships)
- How things change (state, events)
- What can be deployed (resources)
- What operators should do (decisions)
- How futures are tested (experiments)

---

## 2. Architectural binding

| Store | Ontology role |
|---|---|
| **PostGIS** | Geometry + typed attributes for `EntityKind`; `entity_kind` column uses canonical names |
| **TimescaleDB** | Observation series referenced by `ObservationSeries` |
| **Object storage** | Rasters, extracts, experiment artifacts; linked by URI on `DatasetVersion` / `ExperimentResult` |
| **Neo4j** | Labels = EntityKind (+ facet labels); types = RelationType |
| **API** | DTOs import types from `@polaris/ontology` |
| **AI / Simulation (future)** | Read/write only through ontology contracts |

ADR alignment: polyglot persistence ([ADR-0002](../adr/0002-polyglot-persistence.md)) — shared ULIDs bind stores.

---

## 3. Domain catalog

| Domain | Responsibility |
|---|---|
| spatial | AOI, geometry containment, campuses/districts |
| administrative | Jurisdictions, agencies |
| transportation | Road, rail, transit, air, sea, traffic |
| buildings | Structures & facilities |
| land_use | Zoning & land cover |
| healthcare | Care delivery nodes |
| emergency | Fire, EMS, shelters, EOC |
| security | Police, perimeters, bases |
| public_services | Civic service centers |
| education | Schools & campuses |
| utilities | Cross-cutting utility service points |
| energy | Generation → distribution |
| water | Potable supply chain |
| drainage | Storm/sewer hydrology links |
| waste | Waste facilities |
| communication | Telecom, radio, data centers |
| environment | Environmental quality |
| weather | Near-term atmosphere |
| climate | Long-horizon climate |
| natural_features | Terrain, hydrography, ecology, geology |
| population | People aggregates (no PII) |
| economy | Jobs, industry, markets |
| government | Institutions |
| policy | Plans, ordinances, permits |
| infrastructure | Critical nodes & corridors |
| construction | Projects & work zones |
| resources | Deployable capacity |
| disasters | Hazards & disaster events |
| events | Operational events & incidents |
| time | Intervals & epochs |
| observation | Sensors, series, alerts |
| decision | Recommendations |
| experiment | Digital experiments |
| twin_meta | Snapshots, provenance, entity state |

Full descriptions: `packages/ontology/src/domains.ts`.

---

## 4. Entity model (summary)

Every twin node is an **Entity** with:

- `id` (ULID)
- `entity_kind` (canonical `EntityKind`)
- `aoi_id` / `twin_scope_id`
- `lifecycle_phase`
- `dataset_version_id`
- typed attributes + state variables (per kind)
- optional geometry in PostGIS

**Identity rule:** one real-world thing → one entity id. Multiple source datasets merge via `external_ids` + provenance, not duplicate nodes.

See [ENTITY_DICTIONARY.md](./ENTITY_DICTIONARY.md).

---

## 5. Relationship model (summary)

Relationships are first-class, typed, and often **cascade-relevant**. Edge properties may include `confidence`, `weight`, `dataset_version_id`, `derived`, `updated_at`.

See [RELATIONSHIP_DICTIONARY.md](./RELATIONSHIP_DICTIONARY.md).

---

## 6. Per-domain design pattern

For each domain the ontology defines:

| Dimension | Meaning |
|---|---|
| **Entities** | Canonical kinds owned by the domain |
| **Attributes** | Stable descriptive fields |
| **Relationships** | Allowed relation types to other domains |
| **Lifecycle** | `LifecyclePhase` set |
| **Dependencies** | Typical `DEPENDS_ON` / `POWERS` / `SUPPLIES` patterns |
| **State variables** | Live/operational fields on current state |
| **Business rules** | Invariants & data honesty constraints |

Encoded in `ENTITY_KIND_SPECS` inside `entities.ts`.

### Cross-cutting examples

**Transportation ↔ Emergency:** `RoadSegment` `SERVES` `Hospital`/`FireStation`; `road_closure` `BLOCKS` segments and cascades access risk.

**Energy ↔ Water/Drainage:** `PumpStation` `DEPENDS_ON` power; outage `CASCADES_TO` flood mitigation assets.

**Weather ↔ Drainage ↔ Disasters:** `rain` elevates basin runoff; may `TRIGGERS` `flood` when thresholds exceed.

**Policy ↔ Resources:** `EmergencyPlan` `ENABLES` shelter opening and resource allocation.

---

## 7. Dynamic city state

The city always has a **CityState** derived from a **TwinSnapshot** at an **Epoch**. Each entity has current / historical / predicted / risk **EntityState** vectors with health, confidence, version, and dependency ids.

See [STATE_MODEL.md](./STATE_MODEL.md).

---

## 8. Events, resources, decisions, experiments

| Model | Doc |
|---|---|
| Events & propagation | [EVENT_MODEL.md](./EVENT_MODEL.md) |
| Resources & deployment | [RESOURCE_MODEL.md](./RESOURCE_MODEL.md) |
| Decisions | [DECISION_MODEL.md](./DECISION_MODEL.md) |
| Digital experiments | [EXPERIMENT_MODEL.md](./EXPERIMENT_MODEL.md) |

---

## 9. Extensibility

New concepts require:

1. Add `EntityKind` + `EntityKindSpec` (or `RelationType` + `RelationSpec`)
2. Update dictionaries
3. Bump `ONTOLOGY_VERSION` minor/major appropriately
4. Add Neo4j constraints/indexes if uniqueness/query paths demand it
5. Provide connector mapping — never invent instances

**Forbidden:** synonyms as parallel kinds; silent rename of published kinds; fake entities for demos.

---

## 10. Compatibility with Milestone 1

| M1 concept | Ontology |
|---|---|
| `Asset` | Entity instance |
| `AssetType` | Mapped via `ASSET_TYPE_TO_ENTITY_KIND` |
| `GraphRelationType` | Subset; full set is `RelationType` |
| `DatasetVersion` | Same kind, enriched |
| Simulation/Decision ports | Unchanged fail-closed; schemas ready |

---

## 11. Non-goals (this version)

- Running physics solvers
- Training or invoking ML models
- Populating a demo city graph with synthetic nodes
