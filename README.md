<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  Self-hosted uptime, infrastructure, logs, and alerting in one lightweight dashboard.
</p>

<p align="center">
  <a href="README.ko.md">한국어</a> ·
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
  <img src="https://img.shields.io/docker/pulls/aiturn/everyup" alt="Docker pulls">
</p>

<p align="center">
  <img src="docs/images/everyup-main.png" alt="EveryUp dashboard" width="100%">
</p>

EveryUp gives small teams and self-hosters a single place to watch service uptime, server resources, application logs, OpenTelemetry traces, and alert delivery. It runs as a Go binary with SQLite, so you can deploy it without Prometheus, Grafana, Elasticsearch, or a managed cloud stack.

## Why EveryUp?

- **One dashboard, fewer moving parts** - health checks, infra metrics, logs, API request inspection, and alerts live together.
- **Self-hosted by default** - your monitoring data stays on your own infrastructure.
- **Simple operations** - a single container, one SQLite database file, and automatic first-run secrets.
- **OpenTelemetry friendly** - ingest OTLP logs and traces from existing SDKs or auto-instrumentation.

## Features

| Area | What you get |
| --- | --- |
| **Uptime monitoring** | HTTP/TCP checks, uptime history, latency trends, incident detection |
| **Infrastructure metrics** | CPU, memory, disk, network, and process monitoring for local or SSH remote hosts |
| **Logs and traces** | Unified log viewer, level filtering, keyword search, OTLP/HTTP ingestion |
| **API request inspector** | Request/response visibility from OpenTelemetry SERVER spans with masking and sampling controls |
| **Alerting** | Telegram, Discord, Slack, and webhook channels with threshold-based rules |
| **Live updates** | WebSocket-powered metric streaming for responsive dashboards |

## Quick Start

The fastest path is Docker Compose. On first launch, open the app in your browser and create the admin account. Encryption keys and JWT secrets are generated automatically.

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

volumes:
  everyup-data:
```

```bash
docker compose up -d
```

Open `http://localhost:3001`.

Prefer a one-line Docker run?

```bash
docker run -d --name everyup -p 3001:3001 -v everyup-data:/app/data aiturn/everyup:latest
```

EveryUp publishes Docker images for `linux/amd64` and `linux/arm64`.

## Configuration

Most installations can start without a config file. Use environment variables only when you need to change ports, seed an admin account, move the database, or set a timezone.

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_SERVER_MODE` | `production` | Runtime mode: `development` or `production` |
| `EVERYUP_SERVER_PORT` | `3001` | HTTP server port |
| `EVERYUP_SERVER_ALLOWORIGINS` | same origin | CORS origins for separated frontend deployments |
| `EVERYUP_ADMIN_USERNAME` | unset | Creates or resets an admin account on startup |
| `EVERYUP_ADMIN_PASSWORD` | unset | Password for the seeded admin account |
| `EVERYUP_DATABASE_PATH` | `./data/monitoring.db` | SQLite database path |
| `TZ` | system default | Container timezone, for example `Asia/Seoul` |

> If `EVERYUP_ADMIN_USERNAME` and `EVERYUP_ADMIN_PASSWORD` are both set, EveryUp creates or resets that account on every startup. Leave them unset after initial setup unless you intentionally want that behavior.

## OpenTelemetry Ingestion

Create an API key from **Logs -> Service detail -> Integration**, then point your OpenTelemetry exporter at EveryUp:

```bash
export OTEL_SERVICE_NAME="my-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://your-everyup-server:3001/api/v1/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer everyup_your_api_key"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="none"
```

The OTLP/HTTP receiver accepts `/api/v1/otlp/v1/logs` and `/api/v1/otlp/v1/traces`.

## Data Backup

EveryUp stores application data in a single SQLite database file.

```bash
docker cp everyup:/app/data/monitoring.db ./monitoring.db.bak
```

## Local Development

Prerequisites: [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), and [pnpm](https://pnpm.io/installation).

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
```

Run the backend:

```bash
cd backend
go run ./cmd/server
```

Run the frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

Run backend tests:

```bash
cd backend
go test ./internal/api/handlers/ -v
```

## Project Layout

```text
everyup/
├── backend/       # Go, Fiber, SQLite, WebSocket, collectors
├── frontend/      # React, Vite, TypeScript, Tailwind CSS
├── docs/          # Setup guides, migration notes, product docs
└── docs/images/   # README and documentation images
```

## Documentation

| Document | Description |
| --- | --- |
| [backend/README.md](backend/README.md) | Backend API, configuration, and architecture notes |
| [frontend/README.md](frontend/README.md) | Frontend setup, environment variables, and routes |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | Telegram, Discord, and Slack setup |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API request logging and inspection guide |
| [docs/OTEL_ONLY_MIGRATION.md](docs/OTEL_ONLY_MIGRATION.md) | OpenTelemetry-only ingestion migration notes |

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/ai-turn/everyup/issues).

Before opening a pull request:

- Describe what changed and why.
- Run the relevant backend or frontend checks.
- Keep each pull request focused on one concern.

## License

MIT
