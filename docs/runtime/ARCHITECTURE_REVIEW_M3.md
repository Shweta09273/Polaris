# Architecture Review — Milestone 3 Runtime & Package System

Reviewed as: Principal Platform Architect · Distributed Systems Engineer · GIS Architect · Security Engineer · DevOps Lead · CTO

**Verdict:** M3 establishes a production-*oriented* foundation for city distribution. It is not yet multi-tenant SaaS-hard; remaining weaknesses are listed with mitigations.

---

## Strengths

1. **Not a ZIP rename** — PLRS magic + framed payload + content-addressed blobs.
2. **Bootstrap reuse** — Compiler wraps M2; no duplicated connector logic.
3. **Honesty preserved** — Readiness/coverage come from real bootstrap reports.
4. **Checksum + HMAC** — Tamper detection path exists; unsigned packages warn.
5. **Registry rollback** — Side-by-side previousVersions enable recovery.
6. **Clear UX split** — Cloud compile vs local import/export.

---

## Weaknesses & revisions applied / planned

### Principal Platform Architect

| Weakness | Severity | Mitigation |
|---|---|---|
| In-memory compile job map lost on API restart | Medium | Persist jobs to `data/registry/jobs.json` in M3.1; for M3 document as single-node |
| Registry is flat JSON (no transactions) | Medium | Atomic write via temp+rename (add); Postgres-backed registry for SaaS |
| No tenancy / org isolation on packages | High (SaaS) | Deferred — local single-operator model for academic/MVP; design multi-tenant store later |

**Revision now:** Document single-node assumption; atomic registry save already uses full rewrite.

### Distributed Systems Engineer

| Weakness | Severity | Mitigation |
|---|---|---|
| No distributed lock on install | Medium | Single-writer local process; add file lock in M3.1 |
| Mount cache not shared across API replicas | High (scale-out) | Content-addressed mounts on shared volume / object store |
| Compile jobs not cancellable | Low | Add AbortSignal through bootstrap in M3.1 |

### GIS Architect

| Weakness | Severity | Mitigation |
|---|---|---|
| Package does not yet embed CRS / tile pyramid | Medium | Entrypoints include boundary GeoJSON; tile packs deferred with 3D engine |
| Large AOIs still depend on Overpass limits | High (ops) | Inherited from M2 — Geofabrik PBF path remains follow-up |

### Security Engineer

| Weakness | Severity | Mitigation |
|---|---|---|
| HMAC shared secret (not asymmetric) | Medium | Ed25519 reserved in schema; ship keyring in M3.1 |
| Path traversal on import path from API | Medium | **Revised:** resolve + require `.polaris` suffix; still require operator-trusted API |
| Unsigned packages allowed by default | Medium | Env flag; production docs require `POLARIS_ALLOW_UNSIGNED_PACKAGES=false` |
| No package size / zip-bomb limits on framed expand | Medium | Add max framed size guard (implement below) |

### DevOps Lead

| Weakness | Severity | Mitigation |
|---|---|---|
| Artifacts gitignored but disk growth unbounded | Medium | Retention policy script; document purge of old previousVersions |
| No Prometheus metrics for compile duration | Low | Add counters in M3.1 |

### CTO

| Weakness | Severity | Mitigation |
|---|---|---|
| Cloud “search Hyderabad” does not query remote catalog | Medium | Local registry only; remote package registry is M4+ product surface |
| Login/OIDC not wired to open-city | Medium | Keycloak exists from M1; authorize compile routes in auth milestone |

---

## Production-grade bar for M3 exit

- [x] Official non-ZIP format with manifest, checksums, provenance, licenses, signatures
- [x] Runtime load/validate/mount/rollback/corruption detect
- [x] Registry with readiness/coverage/version/size/confidence
- [x] Compiler wraps bootstrap → package → install
- [x] Mission Control shell for search/registry/progress (no 3D)
- [x] Docs for runtime, format, registry, compiler, versioning, lifecycle, developers
- [ ] Remote signed package CDN
- [ ] Ed25519 trust store
- [ ] Multi-tenant isolation

M3 exits as a **solid local/runtime foundation**. SaaS distribution hardening continues without redesigning M1/M2.
