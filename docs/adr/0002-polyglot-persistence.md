# ADR-0002: Separate geometry, graph, time series, and object stores

- Status: Accepted
- Date: 2026-07-22

## Context

Cascading impact queries need relationship traversal; maps need spatial indexes; sensors need hypertables; imagery needs object storage.

## Decision

- PostGIS: geometries + twin attributes
- Neo4j: relationships
- TimescaleDB: observations
- S3/MinIO: rasters, extracts, models
- Shared ULID identifiers across stores

## Consequences

Eventual consistency between stores; clearer scaling and query fitness.
