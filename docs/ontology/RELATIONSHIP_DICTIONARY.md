# Relationship Dictionary

**Canonical source:** `packages/ontology/src/relationships.ts`  
**Count:** see `RELATION_TYPES` (stable contract)

---

## Conventions

| Field | Meaning |
|---|---|
| Type | `SCREAMING_SNAKE` Neo4j relationship type |
| Direction | Subject -[TYPE]-> Object unless undirected |
| Cascade | If true, eligible for impact propagation |
| Inverse | Optional paired type |

---

## Vocabulary

### Structural / spatial

| Type | Meaning | Cascade |
|---|---|---|
| LOCATED_IN | Resides in container | no |
| CONTAINS | Inverse containment | no |
| ADJACENT_TO | Neighbor | yes |
| OVERLAPS | Partial intersection | yes |
| BOUND_BY | Delimited by boundary | no |
| PART_OF | Component of aggregate | yes |
| COMPOSED_OF | Aggregate has parts | yes |
| CONNECTED_TO | Network adjacency | yes |
| INTERSECTS | Crossing/meeting | yes |

### Network flow

| Type | Meaning | Cascade |
|---|---|---|
| FLOWS_TO | Directed flow | yes |
| DRAINS_INTO | Drainage destination | yes |
| FEEDS | Upstream feeds downstream | yes |
| SUPPLIES | Provides commodity/service | yes |
| POWERS | Electrical (or equiv.) power | yes |
| TRANSMITS | Signal/power carriage | yes |
| ROUTES_TO | Logical/scheduled routing | yes |

### Service / function

| Type | Meaning | Cascade |
|---|---|---|
| SERVES / SERVED_BY | Service coverage | yes |
| PROVIDES | Offers capability | no |
| REQUIRES | Hard prerequisite | yes |
| SUPPORTS | Soft enablement | yes |
| ENABLES | Makes operation possible | yes |
| PROTECTS | Hazard reduction | yes |
| GUARDS | Security protection | no |
| TREATS | Healthcare relation | no |
| EDUCATES | Education relation | no |

### Dependency / cascade

| Type | Meaning | Cascade |
|---|---|---|
| DEPENDS_ON | Operational dependence | yes |
| CRITICAL_FOR | Critical upstream | yes |
| BLOCKS | Prevents flow/access | yes |
| CONSTRAINS | Limits options/capacity | yes |
| AFFECTS | General influence | yes |
| IMPACTS | Assessed impact | yes |
| CASCADES_TO | Explicit cascade edge | yes |
| EXPOSES | Increases exposure | yes |
| VULNERABLE_TO | Vulnerability link | yes |
| MITIGATES | Risk reduction | yes |

### Control / ownership

| Type | Meaning | Cascade |
|---|---|---|
| OWNED_BY | Legal ownership | no |
| OPERATED_BY | Operator | no |
| CONTROLLED_BY | Command/control | yes |
| MANAGED_BY | Administrative management | no |
| GOVERNED_BY | Governing body | no |
| REGULATED_BY | Policy constraint | yes |
| FUNDED_BY | Sponsor | no |
| ASSIGNED_TO | Assignment | no |

### Observation / evidence

| Type | Meaning | Cascade |
|---|---|---|
| MONITORED_BY | Monitoring agency/sensor | no |
| OBSERVED_BY | Observation link | no |
| MEASURES | Sensor measures entity | no |
| DERIVED_FROM | Lineage | no |
| EVIDENCED_BY | Claim support | no |
| VERSION_OF | Version lineage | no |

### Event dynamics

| Type | Meaning | Cascade |
|---|---|---|
| TRIGGERED_BY / TRIGGERS | Trigger links | yes |
| CAUSED_BY / CAUSES | Causal links | yes |
| OCCURS_IN | Event location scope | no |
| AFFECTS_ENTITY | Event→entity | yes |
| TERMINATES | Ends another event | no |
| SUPERSEDES | Replaces prior record | no |

### Resources / logistics

| Type | Meaning | Cascade |
|---|---|---|
| DEPLOYED_TO | Deployment target | no |
| STAGED_AT | Staging location | no |
| CONSUMES | Consumes stock | no |
| ALLOCATED_TO | Capacity reservation | no |
| CREWED_BY | Crew assignment | no |
| EQUIPPED_WITH | Equipment carriage | no |
| STORED_AT | Stock location | no |

### Decision / experiment

| Type | Meaning | Cascade |
|---|---|---|
| RECOMMENDS | Decision→Action | no |
| ACTS_ON | Action→Entity | no |
| USES_RESOURCE | Action/Decision→Resource | no |
| EXPECTED_TO | →ExpectedOutcome | no |
| EVALUATED_BY | →Evaluation | no |
| EXPLAINS | →Explanation | no |
| COMPARED_TO | Baseline/alternative | no |
| INITIALIZES | Experiment→Snapshot | no |
| MUTATES | Experiment→Entity state | no |
| PRODUCES_RESULT | Experiment→Result | no |

### Temporal

| Type | Meaning | Cascade |
|---|---|---|
| PRECEDES / FOLLOWS | Ordering | no |
| DURING | Within interval | no |
| VALID_DURING | Fact validity | no |

---

## Ambiguity policy

| Prefer | Avoid |
|---|---|
| DEPENDS_ON | vague RELATED_TO |
| POWERS vs SUPPLIES | conflating electricity with water |
| BLOCKS | using AFFECTS for hard closures |
| CASCADES_TO | inventing ad-hoc IMPACT_PATH edges |
| AFFECTS_ENTITY | overloading AFFECTS for instance links |

Full specs (arity, inverses, domain hints): `RELATION_SPECS` in code.
