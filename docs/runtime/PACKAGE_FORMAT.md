# POLARIS Package Format Specification (`.polaris`)

**Media type:** `application/vnd.polaris.package+plrs`  
**Format version:** `1.0`  
**Implementation:** `@polaris/package`

> **This is not a ZIP.** Renaming a `.zip` to `.polaris` must fail magic-byte validation.

---

## Wire envelope (PLRS)

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | Magic `PLRS` (`0x50 0x4C 0x52 0x53`) |
| 4 | 1 | Format major |
| 5 | 1 | Format minor |
| 6 | 1 | Flags (`1` = gzip payload) |
| 7 | 1 | Reserved |
| 8 | 4 | Header JSON length (BE) |
| 12 | N | Header JSON |
| 12+N | … | Payload (framed archive, optionally gzip) |

### Header JSON (minimum)

```json
{
  "format": "1.0",
  "packageId": "ULID",
  "citySlug": "hyderabad",
  "cityVersion": "1.0.0+20260722",
  "compression": "gzip",
  "contentRootSha256": "…",
  "manifestSha256": "…",
  "signatureAlgorithm": "hmac-sha256"
}
```

---

## Payload: framed archive

Entries are concatenated frames:

```
uint32 pathLen | uint32 dataLen | path UTF-8 | data bytes
```

Compression: `gzip` (default) or `identity`.

---

## Internal directory layout

```
manifest.json                 # full package manifest
checksums.sha256              # `sha256  path` lines
signature.json                # signature block
twin/
  entities.json
  edges.json
metadata/
  city-dna.json
  bootstrap-report.json
  boundary.geojson            # optional
provenance/                   # optional lineage artifacts
blobs/
  sha256/<hex>                # content-addressed copies
```

---

## Manifest fields

| Field | Purpose |
|---|---|
| `packageId` | ULID identity |
| `citySlug` / `cityDisplayName` | City identity |
| `cityVersion` | Semver + build date |
| `compilerVersion` | Producer compiler |
| `ontologyVersion` | Ontology SSOT version |
| `runtimeTarget` | Target runtime version |
| `builtAt` | ISO timestamp |
| `compression` | Codec |
| `compatibility` | Load policy |
| `twinReadinessScore` / `cityReadinessScore` | Bootstrap scores |
| `coverage` | Required/optional layer counts |
| `dependencies` | Declared package deps |
| `provenance` | Dataset keys + SPDX licenses |
| `checksums` | Per-blob SHA-256 + content root + manifest hash |
| `signature` | HMAC-SHA256 / Ed25519 / none |
| `incremental` | Optional delta base (reserved) |
| `entrypoints` | Logical paths for runtime |

---

## Checksums & tamper detection

1. Each blob path hashed with SHA-256.
2. `contentRootSha256` = SHA-256 of sorted `hash  path` lines.
3. `manifestSha256` = SHA-256 of manifest JSON without signature.
4. Header content root must match manifest.
5. Any mismatch → reject.

---

## Digital signatures

| Algorithm | Status |
|---|---|
| `hmac-sha256` | Supported (`POLARIS_PACKAGE_HMAC_SECRET`) |
| `ed25519` | Reserved (key material in M3.1) |
| `none` | Dev only; warn unless `allowUnsigned` |

HMAC covers `manifestSha256 || contentRootSha256` (concatenated updates).

---

## Compression strategy

- Default: gzip level 9 over the framed payload.
- Content-addressed blobs enable future deduplication across incremental updates.
- Incremental updates (`incremental` block) are schema-ready; delta apply is deferred.

---

## Compatibility policy

```ts
{
  minRuntimeMajor: 0,
  maxRuntimeMajor: 1,
  requireOntologyMajorMatch: true,
  allowSideBySide: true
}
```

Ontology **major** mismatch → load rejected.

---

## Dependency list

Declared as strings, e.g.:

- `@polaris/ontology@1.0.0`
- `@polaris/runtime@0.3.0`

Runtime currently enforces ontology major; full dependency resolver is future work.
