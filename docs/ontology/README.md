# POLARIS Urban Ontology — Index

**Ontology version:** 1.0.0  
**Package:** `@polaris/ontology`  
**Status:** Semantic foundation (no simulation / ML execution)

This ontology is the **single source of truth** for entity kinds, relationships, city state, events, resources, decisions, and digital experiments across PostgreSQL/PostGIS, Neo4j, APIs, and future AI/simulation services.

---

## Documents

| Document | Purpose |
|---|---|
| [URBAN_ONTOLOGY_SPECIFICATION.md](./URBAN_ONTOLOGY_SPECIFICATION.md) | Master semantic model & domain catalog |
| [KNOWLEDGE_GRAPH_SPECIFICATION.md](./KNOWLEDGE_GRAPH_SPECIFICATION.md) | Neo4j labels, constraints, traversals |
| [ENTITY_DICTIONARY.md](./ENTITY_DICTIONARY.md) | Canonical entity kinds |
| [RELATIONSHIP_DICTIONARY.md](./RELATIONSHIP_DICTIONARY.md) | Canonical relationship vocabulary |
| [STATE_MODEL.md](./STATE_MODEL.md) | Dynamic city / entity state |
| [EVENT_MODEL.md](./EVENT_MODEL.md) | Events, propagation, termination |
| [RESOURCE_MODEL.md](./RESOURCE_MODEL.md) | Deployable resources & logistics |
| [DECISION_MODEL.md](./DECISION_MODEL.md) | Decision objects & chain |
| [EXPERIMENT_MODEL.md](./EXPERIMENT_MODEL.md) | Digital experiments |

## Code SSOT

```
packages/ontology/src/
  domains.ts
  entities.ts
  relationships.ts
  state.ts
  events.ts
  resources.ts
  decisions.ts
  experiments.ts
```

Neo4j DDL & examples:

```
services/knowledge-graph/schema/
services/knowledge-graph/examples/
```

## Naming Law

1. **One canonical name** per concept (`RoadSegment`, not `road` / `Street` / `highway_segment`).
2. Milestone 1 `AssetType` values map into `EntityKind` via `ASSET_TYPE_TO_ENTITY_KIND` — do not extend `AssetType`.
3. Relationship types are `SCREAMING_SNAKE` and stable API contracts.
4. Attributes are `snake_case` in storage; TypeScript uses the same strings in specs.

## Extensibility scopes

Beyond cities, the same ontology covers **Airports, Railways, Ports, Industrial Parks, Campuses, Military Bases, Smart Districts / future Smart Nations** via `TwinScope` specializations (`Campus`, `MilitaryBase`, `SmartDistrict`, `Airport`, `Seaport`, `IndustrialPark`).
