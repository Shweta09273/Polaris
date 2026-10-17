# City Package Registry Specification

**Package:** `@polaris/registry`  
**Index:** `data/registry/index.json`

---

## Purpose

The registry is the authoritative local index of **installed** cities available to the Runtime. It is not a public package CDN (that is a later cloud registry service).

---

## Record schema

Each active city record includes:

| Field | Description |
|---|---|
| `citySlug` | Canonical id |
| `cityDisplayName` | Human label |
| `packageId` | Package ULID |
| `cityVersion` | City package version |
| `ontologyVersion` / `compilerVersion` | Traceability |
| `twinReadinessScore` | Twin readiness 0–100 |
| `cityReadinessScore` | City readiness 0–100 |
| `coverage` | Required/optional layer counts |
| `dataConfidence` | Derived confidence metric |
| `installedAt` / `lastUpdated` | Timestamps |
| `installedSizeBytes` | On-disk package size |
| `packagePath` | Path to `.polaris` |
| `mountDir` | Unpacked mount |
| `active` | Whether this is the current install |
| `previousVersions` | Up to 5 prior installs for rollback |

---

## Operations

- `list` / `search` / `get`
- `install` — upgrades deactivate prior active version and push to `previousVersions`
- `rollback` — restore latest previous version
- `uninstall` — deactivate; optional file delete

---

## Example Mission Control columns

| City | Twin Readiness | Coverage | Version | Last Updated | Installed Size | Data Confidence |
|---|---|---|---|---|---|---|
| Hyderabad | 62 | 4/7 req | 1.0.0+20260722 | ISO | 18 MB | 58% |

---

## Durability

Registry is file-backed JSON. Production hardening (SQLite/Postgres, multi-node lease) is documented as a known follow-up in the architecture review.
