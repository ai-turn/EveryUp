<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  Self-hosted monitoring dashboard + AI Agent that watches your Docker services automatically.
</p>

<p align="center">
  <a href="README.ko.md">한국어</a> ·
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#repository-layout">Repository Layout</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
</p>

<p align="center">
  <img src="docs/images/everyup-main-en.png" alt="EveryUp dashboard" width="100%">
</p>

## What is EveryUp?

A self-hosted tool for monitoring the services you run on your servers.

- **Instant Telegram/Discord/Slack alerts** when a service goes down — configured in the Web UI
- **Browser dashboard** for status, logs, and alert history
- **Auto-discovery** via Docker labels — no manual registration needed

No Prometheus, no Grafana, no heavy stack. One Docker Compose command and you're running.

## Two-part setup

EveryUp has two parts. **You only need one to get started.**

| | EveryUp Web | EveryUp Agent |
|---|---|---|
| What it does | Browser dashboard, alert rules, notification channels, history storage | Watches services in real time and syncs their health/metrics to Web |
| Requires | Docker | Docker + an EveryUp Web API key |
| Service registration | Add manually in the Web UI | Docker labels only — auto-discovered |
| Notifications | Sends Telegram/Discord/Slack from configured channels | Collects only — Web does the sending |
| Together? | Agent-discovered services show up in the Web dashboard | |

Start with **Web only**, then add the Agent when you want auto-discovery and server monitoring. All notification setup happens in the Web UI → 알림 menu.

## Prerequisites

- Docker 24+ and Docker Compose v2+
- (Agent only) An EveryUp Web API key from the Web UI (Services → 추가하기)
- (Notifications) A Telegram bot, Discord webhook, or Slack webhook → [Notification setup](docs/NOTIFICATION_SETUP.md)

## Quick Start

Pre-built images are published to Docker Hub, so **you don't need to clone the repo** — only Docker is required. Web and Agent each have their own Compose file; pull just the one you need.

### 1. Run the Web dashboard

Create a `docker-compose.yml`:

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "${EVERYUP_SERVER_PORT:-3001}:3001"
    volumes:
      - everyup-data:/app/data
    env_file:
      - path: .env
        required: false
    restart: unless-stopped

volumes:
  everyup-data:
    driver: local
```

```bash
docker compose up -d
```

Open `http://localhost:3001` → create an admin account → done.

> To change the port or pre-seed an admin account, create a `.env` alongside the compose file (see [Configuration](#configuration)).

### 2. Run the Agent — auto-discovery + server monitoring (optional)

The Agent runs on the server you want to monitor — not the Web dashboard server. It connects to Web with an API key and syncs the health, events, and host metrics it collects; Web sends any notifications. On **that** server, create a `docker-compose.yml`:

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    env_file:
      - path: .env
        required: false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
    driver: local
```

Then connect it to the Web dashboard:

1. Web dashboard → **Services** → click **추가하기 (Add)** → name it → copy the API key (`evup_svc_...`)
2. Create a `.env` next to the compose file:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://WEB_SERVER_IP:3001    # URL of the Web dashboard, reachable from this server
EVERYUP_AGENT_API_KEY=evup_svc_...                # key from step 1
```

```bash
docker compose up -d
```

The service shows online in the dashboard within 30 seconds. Configure who gets notified — and on which channel — in the Web UI → 알림 menu.

### 3. Tell the Agent what to watch

Add `everyup.enabled: "true"` to any container you want monitored (in your own `docker-compose.yml`):

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"              # ← that's it: up/down from the container's running state

  # Optional: add a health endpoint to upgrade to active HTTP/TCP probing
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"          # ← display name (defaults to the container name if omitted)
      everyup.health.url: "http://api:8080/health"

  postgres:
    image: postgres:16
    labels:
      everyup.enabled: "true"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"
```

The Agent auto-discovers labeled containers within the next 30-second check. No Web UI registration needed. **Each labeled container becomes its own service card** (plus one card for `EVERYUP_HEALTH_URL` if set), so a single Agent can report many services.

> **Only `everyup.enabled: "true"` is required.** With just that, the Agent tracks liveness (container running vs stopped) from Docker — no health endpoint needed. Add `everyup.health.url` (or `everyup.health.port`) to upgrade a service to active HTTP/TCP probing with response time and status codes. `everyup.service.name` is optional — it defaults to the container name (a 12-char short ID if the container has no name).

### Both on one host (single Compose file)

To run Web + Agent together on one machine, create a single `docker-compose.yml` — they share a Docker network, so the Agent reaches the dashboard at `http://everyup:3001` automatically (no IP needed):

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "${EVERYUP_SERVER_PORT:-3001}:3001"
    volumes:
      - everyup-data:/app/data
    env_file:
      - path: .env
        required: false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    profiles:
      - agent
    depends_on:
      everyup:
        condition: service_healthy
    env_file:
      - path: .env
        required: false
    environment:
      EVERYUP_WEB_BASE_URL: "http://everyup:3001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-data:
    driver: local
  everyup-agent-data:
    driver: local
```

```bash
docker compose up -d                    # web only
docker compose --profile agent up -d    # web + agent
```

## Configuration

Web and Agent are configured independently — they run on different servers in the typical setup. Each has its own `.env.example`.

### EveryUp Web

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_SERVER_PORT` | `3001` | Port the dashboard listens on |
| `EVERYUP_SERVER_ALLOWORIGINS` | _(empty)_ | CORS allowed origins — only needed if you call the API from a different domain |
| `EVERYUP_ADMIN_USERNAME` | _(unset)_ | Pre-seed admin account on startup; leave blank to create via browser on first visit |
| `EVERYUP_ADMIN_PASSWORD` | _(unset)_ | Pre-seed admin password (min 8 chars) |
| `EVERYUP_DATABASE_PATH` | `./data/monitoring.db` | SQLite database path (inside the container) |
| `EVERYUP_ENCRYPTION_KEY` | _(auto-generated)_ | 64-char hex AES-256-GCM key; auto-generated and stored on first run if unset |
| `TZ` | `Asia/Seoul` | Container timezone |

Full template: [`web/.env.example`](web/.env.example)

### EveryUp Agent

**Web sync (required)** — connecting the Agent (monitored server) to the Web dashboard (separate server):

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Enable syncing with the EveryUp Web dashboard |
| `EVERYUP_WEB_BASE_URL` | _(empty)_ | Dashboard URL reachable from **this** server, e.g. `http://192.168.1.10:3001` |
| `EVERYUP_AGENT_API_KEY` | _(empty)_ | API key from Web UI → Services → Add (`evup_svc_...`) |

**Commonly used:**

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_AGENT_NAME` | `everyup-agent` | Agent display name |
| `EVERYUP_SERVICE_NAME` | `local-service` | Used only together with `EVERYUP_HEALTH_URL` — the name for that single URL target. Has no effect when using Docker label discovery only. |
| `EVERYUP_HEALTH_URL` | _(empty)_ | Single HTTP URL to monitor directly (no Docker labels needed). **Leave empty when using Docker label discovery.** Setting this creates an extra service card named after `EVERYUP_SERVICE_NAME`. |
| `EVERYUP_HOST_CPU_PERCENT` | _(disabled)_ | Host CPU alert threshold (0–100) |
| `EVERYUP_HOST_MEMORY_PERCENT` | _(disabled)_ | Host memory alert threshold (0–100) |
| `EVERYUP_HOST_DISK_PERCENT` | _(disabled)_ | Host disk alert threshold (0–100) |

> Notifications (Telegram/Discord/Slack) are configured in the Web UI → 알림 menu, not on the agent.

Full template: [`agent/.env.example`](agent/.env.example)

## Repository Layout

```text
everyup/
  web/
    backend/             # Go API server, SQLite, OTLP ingestion, alert engine
    frontend/            # React/Vite dashboard
    Dockerfile           # Full-stack Web image
    docker-compose.yml   # Web only (pre-built image)
    .env.example         # Web config template

  agent/                 # Standalone EveryUp Agent
    cmd/                 # Entry point
    internal/            # Core packages
    docs/                # Per-feature Agent docs
    docker-compose.yml   # Agent only (pre-built image)
    .env.example         # Agent config template
    compose.example.yml  # Build-from-source / OTLP collector template

  docs/                  # Operator docs, changelog, roadmaps
  docker-compose.yml     # Web + Agent combined (single host)
  .env.example
```

## Local Development

For contributors or anyone who wants to modify the source.

**Prerequisites:** [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation)

Run the Web backend:

```bash
cd web/backend
go run ./cmd/server
```

Run the Web frontend (separate terminal):

```bash
cd web/frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Run Agent tests:

```bash
cd agent
go test ./...
```

## Documentation

| Document | Contents |
| --- | --- |
| [agent/README.md](agent/README.md) | Agent setup, Docker labels, Web sync |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | **How to create a Telegram bot**, Discord, Slack |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Data backup and restore |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API request logging guide |
| [web/README.md](web/README.md) | Web backend and frontend details |

## License

MIT
