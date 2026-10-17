# POLARIS Runtime Specification (Milestone 3)

**Package:** `@polaris/runtime`  
**Version:** 0.3.0  
**Modes:** Cloud Mode · Local Package Mode

---

## Purpose

The Runtime is the execution environment for every compiled city. It does **not** re-bootstrap datasets. It loads validated `.polaris` packages, mounts them into a cache, registers metadata services, and exposes APIs used by Mission Control.

Simulation, AI models, and the 3D twin engine are out of scope for M3.

---

## Responsibilities

| Responsibility | Behavior |
|---|---|
| Load city packages | `importPackage` / remount from installed path |
| Validate integrity | PLRS magic, checksums, HMAC, ontology major |
| Mount package | Unpack into `data/runtime-cache/mounts/<slug>/<version>/` |
| Register services | Twin entities, edges, City DNA, bootstrap report, boundary |
| Open Digital Twin | Metadata shell only (`openTwin`) — no 3D |
| Expose APIs | Via `@polaris/api` `/v1/cities/*`, `/v1/packages/*`, `/v1/runtime/*` |
| Track versions | Registry index + previousVersions (rollback) |
| Manage cache | Mount map in-process; remount if cache evicted |
| Support rollback | `CityRegistry.rollback` → remount prior package |
| Detect corruption | Entrypoint presence check vs manifest |

---

## Cloud Mode

```
User searches "Hyderabad"
        │
        ▼
  Registry search
        │
   ┌────┴────┐
   │ hit     │ miss
   ▼         ▼
 Mount    City Compiler
 Open     (Bootstrap → pack → install)
 Twin     Progress events → Mount → Open
```

Operators never manually download datasets. Compilation invokes the Milestone 2 Bootstrap Engine.

---

## Local Package Mode

```
Import Hyderabad.polaris
  → validate (magic, checksums, signature, compatibility)
  → copy into data/packages/
  → unpack mount
  → registry install
  → open twin metadata

Export active city
  → copy installed .polaris to target path
```

---

## Cache layout

```
data/
  packages/                 # immutable .polaris artifacts
  registry/index.json       # installed city index
  runtime-cache/mounts/
    <citySlug>/<cityVersion>/
      manifest.json
      twin/
      metadata/
      blobs/
```

---

## Failure modes

| Condition | Result |
|---|---|
| Bad magic (ZIP rename) | Reject |
| Checksum mismatch | Reject — tamper |
| HMAC fail | Reject |
| Ontology major mismatch | Reject |
| Missing mount but package OK | Remount |
| Missing package file | Error — reinstall/import required |

---

## Related

- [Package Format](./PACKAGE_FORMAT.md)
- [Registry](./REGISTRY.md)
- [Compiler](./COMPILER.md)
- [Versioning Policy](./VERSIONING_POLICY.md)
- [Package Lifecycle](./PACKAGE_LIFECYCLE.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
