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

## Environment Variables

Web runs with working defaults and needs no env vars for a basic setup. The ones
below matter for production, networking, and automation.

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_SERVER_PORT` | `3001` | Dashboard/API port |
| `EVERYUP_SERVER_MODE` | `production` | `development` enables verbose errors and stack traces |
| `EVERYUP_SERVER_ALLOWORIGINS` | | CORS allowed origins; set when the frontend is served from another domain (e.g. `https://app.example.com`) |
| `EVERYUP_DATABASE_PATH` | `./data/monitoring.db` | SQLite file path (the Docker image persists `/app/data`) |
| `EVERYUP_ENCRYPTION_KEY` | auto-generated | 64-char hex (32 bytes) AES key for secrets (Agent API keys, notification channels). **Set this in production** so secrets survive a DB restore; otherwise a key is generated and stored in the DB |
| `EVERYUP_ADMIN_USERNAME` | | Create the first admin on startup without the setup UI (headless provisioning) |
| `EVERYUP_ADMIN_PASSWORD` | | Required with `EVERYUP_ADMIN_USERNAME`; minimum 8 characters |
| `EVERYUP_RETENTION_METRICS` | `7d` | Health-check metric retention |
| `EVERYUP_RETENTION_LOGS` | `3d` | Log retention |
| `EVERYUP_RETENTION_SYSTEMMETRICS` | `7d` | Host metric retention |
| `EVERYUP_RETENTION_APIREQUESTSDAYS` | `14` | API request retention (days) |
| `EVERYUP_ALERTS_CONSECUTIVEFAILURES` | `3` | Consecutive failures before a service is marked down |

Any `config.json` key can also be overridden by an env var: uppercase it and
replace dots with underscores, prefixed with `EVERYUP_`. For example
`system.storeInterval` → `EVERYUP_SYSTEM_STOREINTERVAL`,
`server.host` → `EVERYUP_SERVER_HOST`.

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