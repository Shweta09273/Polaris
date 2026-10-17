# Environment Setup

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ (22 LTS recommended) |
| pnpm | 9+ |
| Python | 3.12+ |
| Docker Desktop | 4.30+ with ≥ 8 GB RAM to containers |
| Git | 2.40+ |

Optional: `gdal` / `osmium-tool` for local geospatial debugging.

---

## 1. Clone

```bash
git clone <repo-url> polaris
cd polaris
```

---

## 2. Environment files

```bash
cp .env.example .env
```

Edit `.env` — especially change all default passwords before exposing ports beyond localhost.

---

## 3. Install JavaScript workspace

```bash
pnpm install
```

---

## 4. Python worker (optional until M2)

```bash
cd apps/ingestion-worker
python -m venv .venv
# Windows
.venv\Scripts\activate
# Unix
source .venv/bin/activate
pip install -e ".[dev]"
```

---

## 5. Start infrastructure

```bash
pnpm infra:up
# equivalent: docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Services:

| Service | URL |
|---|---|
| PostGIS | `localhost:5432` |
| TimescaleDB | `localhost:5433` |
| Neo4j Browser | http://localhost:7474 |
| Redis | `localhost:6379` |
| NATS | `localhost:4222` |
| MinIO API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |
| Keycloak | http://localhost:8080 |
| OpenSearch | http://localhost:9200 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

---

## 6. Run applications

```bash
pnpm dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000/health  

---

## 7. Verify

```bash
pnpm typecheck
curl http://localhost:4000/health
```

---

## Troubleshooting

| Symptom | Action |
|---|---|
| Docker disk full | Prune images; DEM/imagery must not land in git |
| Neo4j won't start | Ensure memory ≥ 2 GB for container |
| Port conflicts | Adjust ports in `.env` and compose override |
| pnpm engine errors | Upgrade Node to 22 LTS |

---

## Air-gapped / government note

Keycloak, MinIO, Neo4j, PostGIS, and Grafana are all self-hostable. External connectors still need controlled egress or pre-staged object storage mirrors.
