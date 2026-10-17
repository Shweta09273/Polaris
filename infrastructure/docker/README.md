# Docker foundation

Compose file: `infrastructure/docker/docker-compose.yml`

```bash
cp .env.example .env
pnpm infra:up
pnpm infra:ps
pnpm infra:logs
pnpm infra:down
```

## Services

PostGIS, TimescaleDB, Neo4j, Redis, NATS, MinIO (+ bucket init), Keycloak, OpenSearch, Prometheus, Grafana.

## Notes

- Default passwords are for **localhost only**
- Imagery/DEM payloads must land in MinIO / `data/` — never in git
- Keycloak realm import for `polaris` realm is Milestone 2 work
