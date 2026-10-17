# Dynamic City State Model

**Canonical source:** `packages/ontology/src/state.ts`

---

## 1. Principle

The Living Twin always has a **current city state**. Entities are not static geometries; they carry versioned state facets.

---

## 2. State kinds

| Kind | Meaning |
|---|---|
| `current` | Best known present state |
| `historical` | Immutable past vector |
| `predicted` | Forward estimate (model/rules; confidence required) |
| `risk` | Risk-oriented projection (likelihood × consequence) |

---

## 3. EntityState vector

Every `EntityState` includes:

| Field | Meaning |
|---|---|
| entityId / entityKind | Subject |
| stateKind | current \| historical \| predicted \| risk |
| version | Monotonic per entity+kind |
| observedAt / validFrom / validTo | Temporal validity |
| variables | Kind-specific state map |
| health | 0..100 (+ optional components) |
| risk | score, likelihood, consequence, hazardKeys, horizon |
| confidence | 0..1 + method |
| dependencyIds | Immediate cascade neighbors |
| datasetVersionId / twinSnapshotId | Provenance anchors |

---

## 4. CityState

Aggregate over a `TwinScope` at an `Epoch`:

- coverageRatio of entities with current state  
- aggregateHealth / aggregateRisk / confidence  
- openEventIds  
- backing `snapshotId`  

CityState is **derived**, never hand-painted without a TwinSnapshot.

---

## 5. Health score guidance

| Range | Interpretation |
|---|---|
| 90–100 | Nominal |
| 70–89 | Watch |
| 40–69 | Degraded |
| 1–39 | Critical |
| 0 | Failed / offline |

Current state must not omit health — use explicit component unknowns.

---

## 6. Business rules

See `STATE_BUSINESS_RULES` in code. Highlights:

- Predicted/risk require confidence.method and horizon  
- Historical is immutable; corrections supersede  
- Dependencies listed for cascade UI even before pathfinding  

---

## 7. Storage binding

| Field | Store |
|---|---|
| EntityState node | Neo4j `:EntityState` + PostGIS/JSON optional |
| High-rate variables | Timescale via ObservationSeries |
| Snapshot package | Object storage + TwinSnapshot metadata |
