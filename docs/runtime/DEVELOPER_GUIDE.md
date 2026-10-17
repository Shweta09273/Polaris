# Developer Guide — Runtime & Packages

## Prerequisites

- Node ≥ 20
- `pnpm` (or `npx pnpm@9.15.0`)
- Optional: infra from M1 for full Bootstrap connectors

## Install & build

```bash
npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @polaris/package build
npx pnpm@9.15.0 --filter @polaris/registry build
npx pnpm@9.15.0 --filter @polaris/runtime build
npx pnpm@9.15.0 --filter @polaris/compiler build
npx pnpm@9.15.0 --filter @polaris/api build
```

## Compile a city (Cloud pipeline)

```bash
pnpm compile:city -- "Vatican City"
```

Produces:

- Bootstrap workdir under `data/bootstrap/…`
- Package under `data/packages/<slug>-<version>.polaris`
- Registry entry in `data/registry/index.json`
- Mount under `data/runtime-cache/mounts/…`

## Package CLI

```bash
pnpm --filter @polaris/cli exec tsx src/polaris.ts package validate ./Hyderabad.polaris
pnpm --filter @polaris/cli exec tsx src/polaris.ts package import ./Hyderabad.polaris
pnpm --filter @polaris/cli exec tsx src/polaris.ts package export hyderabad ./Hyderabad.polaris
pnpm --filter @polaris/cli exec tsx src/polaris.ts cities list
```

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/runtime/status` | Runtime health |
| GET | `/v1/cities` | Installed cities |
| GET | `/v1/cities/search?q=` | Search registry |
| POST | `/v1/cities/open` | Cloud open / compile |
| POST | `/v1/cities/compile` | Start compile job |
| GET | `/v1/compile/jobs/:id` | Progress |
| POST | `/v1/packages/import` | Import `.polaris` |
| POST | `/v1/packages/validate` | Validate without install |
| POST | `/v1/cities/:slug/export` | Export package |
| POST | `/v1/cities/:slug/rollback` | Rollback version |

## Mission Control

```bash
pnpm --filter @polaris/api dev
pnpm --filter @polaris/web dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:4000`.

## Signing

```bash
# .env
POLARIS_PACKAGE_HMAC_SECRET=replace-me
POLARIS_ALLOW_UNSIGNED_PACKAGES=false
```

## Tests

```bash
pnpm --filter @polaris/package test
```
