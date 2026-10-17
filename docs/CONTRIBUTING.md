# Contributing to POLARIS

## Principles

1. **No fake data.** If a source is missing, document it and extend an interface.
2. **Architecture first.** Changes respect bounded contexts and hexagonal boundaries.
3. **Provenance always.** Ingested or derived data must carry source, license, version, and time.
4. **Small, reviewable PRs.** Prefer vertical slices within one context.

---

## Development Workflow

1. Create a branch: `feat/<context>-<change>`, `fix/…`, `docs/…`, `chore/…`
2. Implement with tests at the appropriate layer
3. Run `pnpm lint && pnpm typecheck && pnpm test`
4. Update docs if behavior or architecture changes
5. Open a PR with:
   - Summary of why
   - Context(s) touched
   - Data sources / licenses affected
   - Screenshots for UI
   - Explicit note if simulation/AI scope was touched (should be rare before M5/M6)

---

## Adding a Connector

1. Copy `services/connectors/_template`
2. Implement `DatasetConnectorPort`
3. Declare license + attribution in connector manifest
4. Add schema under `data/schemas/`
5. Register in ingestion worker catalog
6. Document in `docs/datasets/DATASET_RESEARCH.md`
7. Add contract tests with **recorded fixtures from real responses** (scrubbed), never hand-invented geometries presented as production data

---

## Code Review Bar

- Domain purity preserved (no framework types in `domain/`)
- Errors are typed and observable
- No secrets committed
- Migrations reversible where possible
- UI matches design system tokens

---

## Security

- Report vulnerabilities privately to the maintainers
- Never commit `.env`, keys, or raw partner datasets to git

---

## License

By contributing, you agree that your contributions are licensed under Apache-2.0.
