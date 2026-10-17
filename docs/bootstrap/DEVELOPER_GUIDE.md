# Bootstrap Developer Guide

## Packages

| Package | Role |
|---|---|
| `@polaris/connector-sdk` | Retry, resumable download, checksum, connector contract |
| `@polaris/bootstrap` | Pipeline, registry, normalize, validate, DNA, report, CLI |
| `@polaris/ontology` | Canonical EntityKind / RelationType |
| `@polaris/cli` | `polaris` binary wrapper |

## Adding a connector

1. Implement `BootstrapConnector` (`discover` + `fetch`)
2. Register in `services/bootstrap/src/pipeline/bootstrap-city.ts` `connectors()`
3. Add/confirm `DATASET_REGISTRY` mapping
4. Add normalize path if producing entities
5. Never invent empty “demo” features

## Normalization rule

External schemas stop at `raw/`. Only `CanonicalEntity` / `CanonicalEdge` enter `twin/`.

## Tests

```bash
pnpm --filter @polaris/ontology test
pnpm --filter @polaris/bootstrap typecheck
```

## Large AOIs

Public Overpass is rate-limited. For megacities prefer Geofabrik PBF workers (`POLARIS_OVERPASS_URL` for self-hosted Overpass). Warnings are emitted when AOI area is large.
