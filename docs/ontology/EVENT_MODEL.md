# Event Model

**Canonical source:** `packages/ontology/src/events.ts`

---

## 1. Purpose

Events are first-class graph citizens. They declare **inputs**, **outputs**, **affected entities**, **propagation rules**, and **termination conditions**.

Kinds: `OperationalEvent`, `DisasterEvent`, `Incident` (+ taxonomy `HazardType`).

---

## 2. Event types

Includes (non-exhaustive of future extensions; extend via code):

Rain, Flood, Flash Flood, Fire, Wildfire, Power Failure, Road Closure, Accident, Earthquake, Heatwave, Cold Wave, Storm, Landslide, Communication Failure, Water Outage, Gas Leak, Hazardous Spill, Crowd Surge, Cyber Disruption, Construction Disruption, Epidemic Alert, Air Quality Emergency.

---

## 3. Spec schema

Each `EventTypeSpec` defines:

| Field | Content |
|---|---|
| typicalInputs | Required observations/parameters |
| typicalOutputs | Produced state deltas / flags |
| primaryAffectedKinds | Entity kinds in blast radius |
| propagationRules | Relation + maxHops + attenuation |
| terminationConditions | When phase → closed |

Phases: `forecast → onset → peak → ongoing → recovery → closed`.

---

## 4. Propagation examples

| Event | Rule sketch |
|---|---|
| flood | BLOCKS roads → access loss to hospitals (≤3 hops) |
| power_failure | POWERS/FEEDS cascade ≤6 hops to buildings/pumps/telecom |
| communication_failure | TRANSMITS degradation across sites |
| hazardous_spill | DRAINS_INTO storm network toward waterbodies |
| road_closure | BLOCKS segment; SERVES facilities lose access |

---

## 5. Honesty constraints

- No event instances without real observations or declared experiment scenario seeds  
- Flood **extents** require authoritative polygons or explicit modelled outputs with confidence — never invent  
- Partner CAD incidents use `EmergencyOperationsPort` when live  

---

## 6. Graph pattern

```
(:OperationalEvent|-:DisasterEvent|-:Incident)
  -[:OCCURS_IN]->(:TwinScope|:AdminArea)
  -[:AFFECTS_ENTITY]->(:Entity)
  -[:TRIGGERS]->(:OperationalEvent|:Incident)
  -[:BLOCKS|:CASCADES_TO]->(:Entity)
```
