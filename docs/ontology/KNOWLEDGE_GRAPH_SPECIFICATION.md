# Knowledge Graph Specification

**Store:** Neo4j 5.x  
**Ontology:** POLARIS Urban Ontology 1.0.0  
**Service:** `services/knowledge-graph`

---

## 1. Label strategy

Every node carries:

1. **`Entity`** — universal label for constraints/indexes
2. **Canonical kind label** — e.g. `Hospital`, `RoadSegment` (equals `EntityKind`)
3. **Facet labels** (optional) — `Transport`, `NetworkEdge`, `Facility`, `Resource`, `Event`, `TwinMeta`, …

Facet labels are defined in `EntityKindSpec.neo4jLabels`.

```cypher
CREATE (h:Entity:Hospital:Healthcare:Facility {
  id: $id,
  entity_kind: 'Hospital',
  aoi_id: $aoiId,
  name: $name,
  lifecycle_phase: 'active',
  dataset_version_id: $dv,
  created_at: datetime(),
  updated_at: datetime()
});
```

---

## 2. Relationship types

All types are listed in `@polaris/ontology` `RELATION_TYPES`.  
Cascade-relevant types are flagged in `RELATION_SPECS.cascadeRelevant`.

Common edge properties:

| Property | Type | Meaning |
|---|---|---|
| `id` | string | Edge ULID |
| `dataset_version_id` | string | Provenance |
| `confidence` | float 0..1 | Optional |
| `weight` | float | Impedance / strength |
| `derived` | boolean | Rule-generated edge |
| `method` | string | How edge was asserted |
| `updated_at` | datetime | Last change |

---

## 3. Constraints & indexes

Apply in order:

1. `services/knowledge-graph/schema/constraints.cypher`
2. `services/knowledge-graph/schema/indexes.cypher`

Critical uniqueness: `Entity.id`, `DatasetVersion.id`, `TwinSnapshot.id`, `Decision.id`, `Experiment.id`, `MetricDefinition.metric_key`, `HazardType.hazard_key`.

---

## 4. Projection rules (PostGIS → Neo4j)

| PostGIS | Neo4j |
|---|---|
| `twin.entities` row | Node `:Entity:<Kind>` |
| `twin.entity_links` row | Relationship `[:TYPE]` |
| geometry | Not duplicated by default; optional `geom_wgs84` WKT for lightweight reasoning |
| observations | Metadata node `ObservationSeries` only; points stay in Timescale |

Shared `id` ULID is mandatory.

---

## 5. Traversal catalog

See `services/knowledge-graph/examples/traversals.cypher`:

1. Hospital dependency neighborhood  
2. Facilities impacted by blocked roads  
3. Substation outage cascade  
4. Drainage path to waterbody  
5. Decision evidence neighborhood  
6. Experiment lineage  

---

## 6. Graph reasoning (declarative)

See `services/knowledge-graph/examples/reasoning.cypher`:

- Spatial overlap → `VULNERABLE_TO` flood  
- Faulted power → `CASCADES_TO` buildings  
- Road closure → derived `AFFECTS_ENTITY` hospitals  
- Pump offline → basin cascade  
- Decision completeness validation query  

These are **rule projections**, not ML.

---

## 7. Multi-scope twins

| Scope | Primary label |
|---|---|
| City AOI | `TwinScope` |
| Airport | `Airport` (+ contained `Runway`) |
| Port | `Seaport` / `PortTerminal` |
| Campus | `Campus` / `UniversityCampus` |
| Industrial park | `IndustrialPark` |
| Military | `MilitaryBase` (classification required) |
| Smart district / nation subunit | `SmartDistrict` |

All use the same relationship vocabulary.

---

## 8. Governance

- No orphan `:Entity` without `entity_kind`
- No relationship type outside `RELATION_TYPES`
- Derived edges must set `derived: true`
- Deletes are soft at registry level; graph removals are versioned via snapshots
