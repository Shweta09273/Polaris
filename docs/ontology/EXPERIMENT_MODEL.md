# Experiment Model (Digital Experiments)

**Canonical source:** `packages/ontology/src/experiments.ts`

---

## 1. Principle

POLARIS does not merely “run simulations.” It executes **Digital Experiments**: controlled, comparable, assumption-explicit trials against a real twin snapshot.

---

## 2. Anatomy

| Element | Meaning |
|---|---|
| Scenario | Named assumptions + variables + optional event seeds |
| Initial State | `TwinSnapshot` via `INITIALIZES` |
| Variables | Typed experiment knobs |
| Actions | Interventions applied in experiment time |
| Timeline | `TimeInterval` horizon |
| Metrics | `MetricDefinition` keys |
| Result | `ExperimentResult` artifacts + metrics |
| Comparison | `COMPARED_TO` baseline experiment or observed state |
| Confidence | Result-level confidence |

---

## 3. Status flow

`draft → queued → running → succeeded|failed|cancelled → compared`

---

## 4. Business rules

- Never initialize from an empty fictional city  
- Assumptions are mandatory and visible  
- Metrics must be registered  
- Solvers plug in later; ontology stays fixed  

---

## 5. Graph pattern

```
(ex:Experiment)-[:INITIALIZES]->(snap:TwinSnapshot)
(ex)-[:MUTATES]->(e:Entity)
(ex)-[:PRODUCES_RESULT]->(res:ExperimentResult)
(ex)-[:COMPARED_TO]->(base:Experiment|CityState)
(sc:Scenario)<-[:PART_OF]-(ex)  // or soft link via properties until edge added
```

---

## 6. Relationship to Decision model

Experiments inform ExpectedOutcomes. Decisions may cite ExperimentResults via `EVIDENCED_BY`. Simulation engines (future) are adapters behind the Experiment port — not a separate ontology.
