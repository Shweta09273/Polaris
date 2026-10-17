# Decision Model

**Canonical source:** `packages/ontology/src/decisions.ts`

---

## 1. Principle

Every recommendation is an object — not a chat message and not a naked score.

```
Decision
  → Actions
  → Resources
  → Expected Outcome
  → Confidence
  → Risk
  → Cost
  → Time
  → Explanation
  → Evaluation
```

---

## 2. Objects

| Object | Role |
|---|---|
| Decision | Container with objective, status, scores |
| Action | Typed operation with parameters & targets |
| ExpectedOutcome | Metric expectations + horizon |
| Explanation | Grounded narrative + citations |
| Evaluation | Post-hoc scores vs baseline |

Statuses: draft → proposed → approved/rejected → executing → completed (or cancelled/expired).

---

## 3. Validity gates

A Decision presented to operators **must**:

1. `RECOMMENDS` ≥ 1 Action  
2. `EXPLAINS` with citations to entities and/or DatasetVersions  
3. Declare numeric `confidence` and `riskScore`  
4. Declare `cost` and `etaMinutes`  
5. `ACTS_ON` real twin entities (or explicit TwinScope)  

Invalid decisions are queryable (see reasoning.cypher R5).

---

## 4. Graph pattern

```
(d:Decision)-[:RECOMMENDS]->(a:Action)-[:ACTS_ON]->(e:Entity)
(d)-[:USES_RESOURCE]->(r:ResourceAsset|VehicleResource|…)
(d)-[:EXPECTED_TO]->(o:ExpectedOutcome)
(d)-[:EXPLAINS]->(x:Explanation)
(d)-[:EVALUATED_BY]->(v:Evaluation)
```

---

## 5. Non-goals now

- No ML ranking implementation  
- No LLM generation required to exist in schema  
- Method on Explanation may be `model_deferred` until Milestone 6
