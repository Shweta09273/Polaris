# City Compiler Specification

**Package:** `@polaris/compiler`  
**Does not duplicate Bootstrap.** Bootstrap remains the SSOT for dataset acquisition and twin materialization.

---

## Pipeline

```
City Name
   ↓
Bootstrap Engine (M2) — boundary → connectors → normalize → graph → validate → twin → DNA → report
   ↓
Package Generation (.polaris PLRS envelope)
   ↓
Registry Installation
   ↓
Mount cache (Runtime)
```

---

## Progress phases

| Phase | Approx % | Meaning |
|---|---|---|
| `queued` | 0 | Job accepted |
| `bootstrap` | 5–55 | `bootstrapCity()` running |
| `packaging` | 65 | `packCity()` |
| `installing` | 85 | unpack + registry |
| `complete` | 100 | Ready to open |
| `failed` | — | Error recorded on job |

Async API: `compileCityAsync` → poll `GET /v1/compile/jobs/:jobId`.

---

## CLI

```bash
pnpm compile:city -- "Hyderabad, India"
# or
polaris compile city "Hyderabad, India"
```

---

## Honesty rules (inherited)

- No fabricated entities.
- Gated connectors remain plan-only.
- Readiness scores reflect real coverage.
