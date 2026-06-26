# EveryUp Web

EveryUp Web is the dashboard and API server for EveryUp. It stores monitoring
history, manages users, receives Agent data, handles OTLP ingest, and sends
notifications based on the alert rules you configure.

```text
web/
  backend/    # Go API server, SQLite migrations, OTLP ingestion, alerting
  frontend/   # React/Vite dashboard
  Dockerfile  # Full-stack Web image, built from the repository root
```

## Docker

Run the dashboard without cloning the repository:

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

Open `http://localhost:3001` and create the first admin account.

## Compose Reference

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "3001:3001"
    volumes:
      - everyup-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  everyup-data:
    driver: local
```

This Compose file runs Web only. Run `agent/docker-compose.yml` on each server
you want to monitor.

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

## Main API Areas

Default prefix: `/api/v1`.

| Area | Examples |
| --- | --- |
| Health and auth | `GET /health`, `POST /auth/login`, `GET /auth/me` |
| Monitoring | `GET /services`, `GET /hosts`, `GET /dashboard/summary` |
| Logs and traces | `GET /logs`, `POST /otlp/v1/logs`, `POST /otlp/v1/traces` |
| Alerting | `GET /notifications/channels`, `GET /alert-rules` |
| Agent sync | `POST /agents/enroll`, `POST /agents/:agentId/services`, `POST /agents/:agentId/events`, `POST /agents/:agentId/metrics` |
| Agent service detail | `GET /agents/services/all`, `GET /agents/:agentId/services/:key/history`, `GET /agents/:agentId/services/:key/uptime`, `GET /agents/:agentId/services/:key/logs`, `GET /agents/:agentId/services/:key/requests` |

Agent sync and OTLP ingest use the per-Agent API key generated in Web from
**Services -> Add**. The Agent owns that key; monitored applications do not need
it.

## Main Views

| Route | Purpose |
| --- | --- |
| `/` | Dashboard summary, services, alerts, connected Agents |
| `/services` | Agent-reported services with health checks, logs, API requests, and infrastructure |
| `/infra` | Infrastructure resources |
| `/logs` | Logs and service log setup |
| `/alerts` | Notification channels and alert rules |
| `/settings` | System settings |

## Notes

Local runtime files such as backend data, frontend dependencies, and build output
are ignored by Git.