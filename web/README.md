# EveryUp Web

EveryUp Web is the central dashboard and API surface for EveryUp. It combines a
Go backend, SQLite storage, OTLP ingestion, alert configuration, Agent sync APIs,
and a React dashboard.

```text
web/
  backend/    # Go API server, SQLite migrations, OTLP ingestion, alerting
  frontend/   # React/Vite dashboard
  Dockerfile  # Full-stack Web image, built from the repository root
```

## Run Locally

Start the backend:

```bash
cd web/backend
go run ./cmd/server
```

Start the frontend in another terminal:

```bash
cd web/frontend
pnpm install
pnpm dev
```

The frontend expects the backend at `http://localhost:3001` and proxies
`/api/v1` during development.

## Checks

Backend:

```bash
cd web/backend
go test ./...
```

Frontend:

```bash
cd web/frontend
pnpm build
```

## Docker

Run the dashboard without cloning (pre-built image):

```bash
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

`web/docker-compose.yml` runs Web only, `agent/docker-compose.yml` runs the Agent,
and the root `docker-compose.yml` runs both together on one host.

Build the full Web image from source:

```bash
docker build -f web/Dockerfile -t everyup:web-dev .
```

## Configuration

Use the root `.env.example` for Docker Compose overrides. Common Web variables:

| Variable | Purpose |
| --- | --- |
| `EVERYUP_SERVER_PORT` | HTTP port, default `3001` |
| `EVERYUP_SERVER_ALLOWORIGINS` | CORS allowlist for separated frontend deployments |
| `EVERYUP_DATABASE_PATH` | SQLite database path |
| `EVERYUP_ENCRYPTION_KEY` | Production-managed encryption key |
| `EVERYUP_ADMIN_USERNAME` | Optional admin account seed/reset username |
| `EVERYUP_ADMIN_PASSWORD` | Optional admin account seed/reset password |
| ~~`EVERYUP_AGENT_ENROLLMENT_TOKEN`~~ | Removed — agents now use per-service API keys generated from the Web UI |
| `VITE_API_BASE_URL` | Frontend API base path, usually `/api/v1` |
| `VITE_API_TARGET` | Backend target for Vite dev proxy |
| `VITE_USE_MOCK` | Enable mock data for frontend-only development |

## Main API Areas

Default prefix: `/api/v1`.

| Area | Examples |
| --- | --- |
| Health and auth | `GET /health`, `POST /auth/login`, `GET /auth/me` |
| Monitoring | `GET /services`, `GET /hosts`, `GET /dashboard/summary` |
| Logs and traces | `GET /logs`, `POST /otlp/v1/logs`, `POST /otlp/v1/traces` |
| Alerting | `GET /notifications/channels`, `GET /alert-rules` |
| Agent sync | `POST /agents/enroll`, `POST /agents/:agentId/services`, `POST /agents/:agentId/events`, `POST /agents/:agentId/metrics` |
| Agent dashboard | `GET /agents`, `GET /agents/:agentId/services`, `GET /agents/:agentId/events` |
| Agent service detail | `GET /agents/services/all`, `GET /agents/:agentId/services/:key/history`, `GET /agents/:agentId/services/:key/uptime`, `GET /agents/:agentId/services/:key/logs`, `GET /agents/:agentId/services/:key/requests` |

Agent sync endpoints (`/agents/enroll`, `/agents/:id/services`, etc.) require
`Authorization: Bearer <EVERYUP_AGENT_API_KEY>` — the per-agent key generated
from the Web UI (Services → 추가하기), validated against the `agents` table.
This is the **supported** key path.

OTLP ingest endpoints (`POST /otlp/v1/logs`, `/otlp/v1/traces`) authenticate with
the **same** per-agent key (`EVERYUP_AGENT_API_KEY`, validated against the `agents`
table) — no separate key. Logs/traces are tied to a service by
`(agent_id, service.name)`. A legacy log-type `services` key is still accepted as a
fallback but is no longer provisionable in the UI.

## Main Views

| Route | Purpose |
| --- | --- |
| `/` | Dashboard summary, services, alerts, connected Agents |
| `/services` | Agent-reported services — health checks, logs, API requests, and infrastructure per service |
| `/infra` | Infrastructure resources |
| `/logs` | Unified logs and service log setup |
| `/alerts` | Notification channels and alert rules |
| `/settings` | System settings |

## Notes

- Local runtime files such as `web/backend/config.json`, `web/backend/data/`,
  `web/frontend/.env`, `web/frontend/node_modules/`, and `web/frontend/dist/`
  are ignored.
