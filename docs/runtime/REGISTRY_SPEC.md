# POLARIS City Registry Specification

**Status:** Normative for Milestone 3  
**Implementation:** `@polaris/registry`  
**Store:** `data/registry/index.json`

## Purpose

Authoritative inventory of **installed** city packages on a node (cloud workspace or local workstation).

## Record schema

Each active city:

| Field | Description |
|-------|-------------|
| `citySlug` / `cityDisplayName` | Identity |
| `packageId` | ULID from manifest |
| `cityVersion` | Package city version |
| `ontologyVersion` / `compilerVersion` | Compatibility provenance |
| `twinReadinessScore` / `cityReadinessScore` | From bootstrap report |
| `coverage` | Required/optional layer counts |
| `dataConfidence` | Weighted readiness blend |
| `installedAt` / `lastUpdated` | Timestamps |
| `installedSizeBytes` | On-disk package size |
| `packagePath` / `mountDir` | Local paths |
| `active` | Only one active version per slug |
| `previousVersions[]` | Up to 5 prior installs for rollback |

## Operations

- `list` / `search` / `get`
- `install` — demotes prior active; retains history
- `rollback` — restores latest previousVersions entry
- `uninstall` — marks inactive; optional file delete

## UI expectations

Installed Cities panel must show at least:

- Twin Readiness
- Coverage
- Version
- Last Updated
- Installed Size
- Data Confidence
