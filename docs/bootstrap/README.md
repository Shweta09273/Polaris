# Living City Bootstrap Engine

**Milestone:** 2  
**Package:** `@polaris/bootstrap`  
**CLI:** `polaris bootstrap city "<City>"`

---

## What it does

Given a city name, POLARIS resolves a real public boundary and orchestrates connectors to assemble a Living Digital Twin skeleton — normalized to the Urban Ontology — with validation, graph inference, City DNA, and an honest bootstrap report.

**It never fabricates missing layers.**

---

## Quick start

```bash
# from repo root
npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @polaris/connector-sdk build
npx pnpm@9.15.0 --filter @polaris/bootstrap exec tsx src/cli-entry.ts bootstrap city "Singapore"
```

Or:

```bash
pnpm bootstrap:city -- "Hyderabad, India"
```

Outputs under `data/bootstrap/<slug>-<id>/`:

- `boundary/` — city polygon
- `raw/<connector>/` — provenance-backed artifacts + checksums
- `normalized/` / `twin/` — ontology entities + edges
- `city-dna.json`
- `bootstrap-report.md` + `.json`

---

## Pipeline (10 steps)

1. Resolve city boundary (Nominatim → validated GeoJSON)
2. Identify required datasets (Dataset Registry)
3. Connector orchestration (retry, resumable downloads, checksums)
4. Normalize → EntityKind / RelationType
5. Validate geometry, IDs, licenses, confidence
6. Persist (filesystem always; PostGIS/Neo4j/… when wired)
7. Infer knowledge graph edges (ontology rules)
8. City DNA metrics (null when data missing)
9. Bootstrap report + readiness scores
10. CLI entrypoint

---

## Guides

- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Operator Guide](./OPERATOR_GUIDE.md)
- [Architecture Review](./ARCHITECTURE_REVIEW_M2.md)

---

## Design constraints

- Ontology (`@polaris/ontology`) is SSOT — connectors never leak raw schemas to APIs
- Utilities / traffic / live CAD remain partner ports
- GloFAS discharge ≠ floodplain polygons
- OSM critical facilities are completeness-capped
