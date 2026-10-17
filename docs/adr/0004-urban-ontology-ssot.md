# ADR-0004: Urban Ontology is the semantic single source of truth

- Status: Accepted
- Date: 2026-07-22

## Context

Milestone 1 introduced coarse `AssetType` and a small `GraphRelationType` set for scaffolding. The Decision Operating System requires a richer, stable vocabulary shared by PostGIS, Neo4j, APIs, and future AI/simulation.

## Decision

1. Introduce `@polaris/ontology` as the canonical Urban Ontology (v1.0.0).
2. Keep Milestone 1 `AssetType` as a deprecated compatibility layer mapped via `ASSET_TYPE_TO_ENTITY_KIND`.
3. Replace graph edge typing with full `RelationType` (`CONNECTED_TO` supersedes legacy `CONNECTS`).
4. Document state, event, resource, decision, and experiment models without implementing solvers or ML.

## Consequences

- One naming law across the platform
- Connectors and twin registry must emit `EntityKind`
- Simulation/AI remain fail-closed but schema-ready
