# Coding Standards

## Languages

| Area | Language | Style |
|---|---|---|
| Apps & packages (TS) | TypeScript 5.x strict | ESLint + Prettier |
| Ingestion / geospatial | Python 3.12 | Ruff + mypy |
| IaC | HCL / YAML | `terraform fmt`, yamllint |
| SQL | Postgres dialect | Uppercase keywords optional; consistent migrations |

---

## TypeScript

- `"strict": true` everywhere
- Prefer `unknown` over `any`; narrow explicitly
- Exhaustive `switch` on discriminated unions
- No default exports in domain packages
- File names: `kebab-case.ts`; React components `PascalCase.tsx`
- Imports: domain ← application ← infrastructure (never reverse)

### NestJS modules

```
modules/<context>/
  domain/
  application/
  infrastructure/
  interface/
  <context>.module.ts
```

---

## Python

- Type hints on public functions
- Pydantic models for external payloads
- No silent `except:`
- Raster/vector ops via rasterio/geopandas — pin GDAL-compatible versions
- Connectors must be deterministic given the same source snapshot

---

## Testing

| Layer | What |
|---|---|
| Domain unit | Pure logic, no I/O |
| Application | Use cases with fakes for ports |
| Contract | Connector schemas vs real sample payloads |
| Integration | Testcontainers for Postgres/Neo4j where feasible |
| E2E | Critical operator paths only |

Fake **ports** in tests are encouraged. Fake **city datasets in the product** are forbidden.

---

## Logging & Observability

- Structured JSON logs
- Include `correlation_id`, `workspace_id`, `aoi_id` when present
- OpenTelemetry spans on connectors and API handlers
- Never log secrets or full auth tokens

---

## Git

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`
- Do not commit `data/raw/**` payloads (gitignored)

---

## UI

- Use design tokens only — no ad-hoc hex in features
- No new color without design-system update
- Empty states must explain missing DatasetVersions truthfully
