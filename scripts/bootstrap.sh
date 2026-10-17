#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — update secrets before non-local use."
fi

pnpm install
pnpm infra:up

echo "Waiting for PostGIS..."
sleep 8
pnpm --filter @polaris/api exec curl -sf "http://127.0.0.1:${API_PORT:-4000}/health" || true

echo "Bootstrap complete. Run: pnpm dev"
