# Package Lifecycle

```
Compile / Import
      │
      ▼
 Validate (magic, checksums, signature, compatibility)
      │
      ▼
 Store artifact → data/packages/<slug>-<version>.polaris
      │
      ▼
 Install registry record (active)
      │
      ▼
 Mount → data/runtime-cache/mounts/...
      │
      ▼
 Open twin metadata (Mission Control)
      │
      ├── Export copy for offline transfer
      ├── Upgrade → previousVersions push → new active
      ├── Rollback → restore previous mount
      └── Uninstall → deactivate (+ optional delete)
```

## Incremental updates (schema-ready)

Manifest may declare:

```json
"incremental": {
  "baseCityVersion": "1.0.0+20260101",
  "baseContentRootSha256": "…",
  "deltaBlobKeys": ["blobs/sha256/…"]
}
```

Apply/delta merge is **not** implemented in M3; full packages are always produced.

## Corruption recovery

1. `GET /v1/cities/:slug/integrity`
2. If mount damaged but package intact → remount
3. If package checksum fails → re-import or recompile
