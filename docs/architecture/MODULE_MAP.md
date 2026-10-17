# Module Map

| Path | Responsibility |
|---|---|
| `apps/web` | Mission-control UI |
| `apps/api` | Core platform API |
| `apps/gateway` | Edge BFF / proxy |
| `apps/ingestion-worker` | Prefect/Python pipelines |
| `packages/domain` | Pure domain + ports (re-exports ontology) |
| `packages/ontology` | Urban Ontology SSOT |
| `packages/contracts` | DTOs / events |
| `packages/design-system` | UI tokens + primitives |
| `packages/spatial` | CRS / bbox utilities |
| `packages/config` | Runtime config loader |
| `services/connectors/*` | One public source each |
| `services/knowledge-graph` | Graph ports |
| `services/twin-registry` | Asset registry ports |
| `services/simulation` | Simulation port (fail-closed) |
| `services/decision-engine` | Decision port (fail-closed) |
| `services/auth` | OIDC adapter port |
| `infrastructure/docker` | Local dependency stack |
| `infrastructure/kubernetes` | Cluster manifests |
| `infrastructure/terraform` | Cloud IaC (future modules) |
| `docs/*` | Architecture, datasets, design, roadmap |
