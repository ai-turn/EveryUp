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
  <img src="docs/images/everyup-main-en.png" alt="EveryUp dashboard" width="100%">
</p>

EveryUp gives small teams and self-hosters a single place to watch service uptime, server resources, application logs, OpenTelemetry traces, and alert delivery. It runs as a Go binary with SQLite, so you can deploy it without Prometheus, Grafana, Elasticsearch, or a managed cloud stack.

## Why EveryUp?

- **One dashboard, fewer moving parts** - health checks, infra metrics, logs, API request inspection, and alerts live together.
- **Self-hosted by default** - your monitoring data stays on your own infrastructure.
- **Simple operations** - start with one container and one persistent data volume instead of a separate monitoring stack.
- **OpenTelemetry friendly** - send OTLP logs and traces from existing SDKs, collectors, or auto-instrumentation.

## Features

| Area | What you get |
| --- | --- |
| **Uptime monitoring** | HTTP/TCP checks, uptime history, latency trends, incident detection |
| **Infrastructure metrics** | CPU, memory, disk, network, and process monitoring for local or SSH remote hosts |
| **Logs and traces** | Unified log viewer, level filtering, keyword search, OTLP/HTTP ingestion |
| **API request inspector** | Request/response visibility from OpenTelemetry SERVER spans with masking and sampling controls |
| **Alerting** | Telegram, Discord, Slack, and webhook channels with threshold-based rules |

## Quick Start

Docker Compose is the recommended way to start EveryUp. Clone the repository, start the checked-in compose file, then create the admin account in your browser. EveryUp generates its first-run encryption key and JWT secret automatically.

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
docker compose up -d
```

Open `http://localhost:3001`.

Copy `.env.example` to `.env` before starting Compose when you need to customize ports, admin seeding, or timezone. Published images support `linux/amd64` and `linux/arm64`.

## Run with Docker

Pull the published image when you want to run EveryUp without cloning the repository:

```bash
docker pull aiturn/everyup:latest
docker run -d --name everyup -p 3001:3001 -v everyup-data:/app/data aiturn/everyup:latest
```

Open `http://localhost:3001` and create the admin account.

## Configuration

Most installations can start without a config file. Docker Compose loads `.env` when present; use [`.env.example`](.env.example) as the starting point for overrides.

| Variable | Purpose |
| --- | --- |
| `EVERYUP_SERVER_PORT` | Change the exposed HTTP port |
| `EVERYUP_ADMIN_USERNAME` | Seed or reset the admin account on startup |
| `EVERYUP_ADMIN_PASSWORD` | Password paired with the seeded admin username |
| `EVERYUP_DATABASE_PATH` | Move the SQLite database path |
| `EVERYUP_ENCRYPTION_KEY` | Provide a production-managed 64-character hex encryption key |
| `TZ` | Set the container timezone, for example `Asia/Seoul` |

> If `EVERYUP_ADMIN_USERNAME` and `EVERYUP_ADMIN_PASSWORD` are both set, EveryUp creates or resets that account on every startup. Leave them unset after initial setup unless you intentionally want that behavior.

Separated frontend deployments may also need `EVERYUP_SERVER_ALLOWORIGINS`. See [`.env.example`](.env.example) and [backend/README.md](backend/README.md) for backend configuration details.

## Send Logs and Traces

Create an API key from **Logs -> Service detail -> Integration**, then point an OTLP/HTTP exporter at EveryUp:

```bash
export OTEL_SERVICE_NAME="{your-service-name}"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://your-everyup-server:3001/api/v1/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer {your-everyup-api-key}"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
```

The OTLP/HTTP receiver accepts `/api/v1/otlp/v1/logs` and `/api/v1/otlp/v1/traces`.

<sub>Metrics (`OTEL_METRICS_EXPORTER`) are not supported yet — leave it unset or set it to `none`.</sub>

## Data Backup

Back up the persistent data directory before upgrades or migrations. The default Docker setup keeps the SQLite database and generated encryption key material under `/app/data`; deployments that set `EVERYUP_ENCRYPTION_KEY` must retain that secret separately.

See [Backup and Restore](docs/BACKUP_RESTORE.md).

## Local Development

Prerequisites: [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), and [pnpm](https://pnpm.io/installation).

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
```

Run the backend in one terminal:

```bash
cd backend
go run ./cmd/server
```

Run the frontend in another terminal from the repository root:

```bash
cd frontend
pnpm install
pnpm dev
```

Component-specific setup and checks live in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

## Documentation

The guides below are the supported starting points. The `doc/` directory keeps design notes and implementation specs for contributors.

| Document | Description |
| --- | --- |
| [backend/README.md](backend/README.md) | Backend API, configuration, and architecture notes |
| [frontend/README.md](frontend/README.md) | Frontend setup, environment variables, and routes |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Data backup, encryption key retention, and restore flow |
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
