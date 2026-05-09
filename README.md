<p align="center">
  <img src="docs/images/everyup_logo.png" alt="EveryUp" width="96">
</p>

# EveryUp — Self-Hosted Monitoring Dashboard

<img src="docs/images/ascci.png" alt="EveryUp — self-hosted uptime and infrastructure monitoring" width="480">

Open-source uptime monitoring, server metrics, log collection, and alerting in one self-hosted dashboard.
No Prometheus, no Grafana, no cloud required — just a single binary and a SQLite file.

[한국어](README.ko.md) | **English**

[![Demo](https://img.shields.io/badge/Demo-live-brightgreen)](https://ai-turn.github.io/everyup/)
![License](https://img.shields.io/badge/license-MIT-blue)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![Docker Pulls](https://img.shields.io/docker/pulls/aiturn/everyup)

**[Live Demo →](https://ai-turn.github.io/everyup/)**

<img src="docs/images/everyup-main.png" alt="EveryUp Dashboard" width="100%">

---

## Table of Contents

- [Why EveryUp?](#why-everyup)
- [Features](#features)
- [Menu Guide](#menu-guide)
  - [Health Check](#health-check)
  - [Logs](#logs)
  - [Infra](#infra)
  - [Alerts](#alerts)
  - [Settings](#settings)
- [Quick Start](#quick-start)
  - [Docker](#docker)
  - [Docker Compose](#docker-compose)
  - [Local Development](#local-development)
- [Configuration](#configuration)
- [Data Backup](#data-backup)
- [OpenTelemetry Ingestion](#opentelemetry-ingestion)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Why EveryUp?

Most server monitoring tools solve one problem. EveryUp combines uptime checks, infrastructure metrics, log collection, and alerting into a **single self-hosted binary** — making it a lightweight open-source alternative to Uptime Kuma + Grafana + a log aggregator.

- **Zero external dependencies** — Go binary + SQLite, runs anywhere Docker runs
- **Privacy-first** — your monitoring data never leaves your own infrastructure
- **One dashboard** — health checks, server metrics, logs, and alerts in one place
- **Free and open source** — MIT licensed, self-hostable in minutes

---

## Features

| Feature | Description |
|---------|-------------|
| **Uptime Monitoring** | HTTP/TCP health checks, uptime tracking, latency trends |
| **Infrastructure** | Real-time CPU/memory/disk/network collection (local + SSH remote) |
| **API Request Inspector** | Per-request capture with configurable sampling, server-side masking, and body inspection |
| **Alerts** | Telegram / Discord / Slack integration, threshold-based rules |
| **Log Management** | Unified log viewer, trace correlation, OTLP log ingestion, and per-request HTTP inspector |
| **Real-time Streaming** | WebSocket-based live metric updates |

---

## Menu Guide

### Health Check

Periodically checks the availability of HTTP and TCP endpoints.

- **Scheduling**: Fixed interval or cron expression per service
- **Detail view**: Real-time metrics, response time chart, recent check history bar, and failure log
- **Incident detection**: Sends an alert when consecutive failures exceed the configured threshold

### Logs

Collects and displays logs from external services in a unified dashboard.

- **Log viewer**: Filter by level (error / warn / info / debug / trace), keyword search, and timeline view
- **API Request Inspector**: Per-service HTTP request/response capture — configurable sampling rate, errors-only mode, and header/body masking
- **Integration tab**: Generate API keys and view OpenTelemetry OTLP setup snippets
- **Capture settings**: Log level filter and API capture mode managed independently per service

**How data is sent to EveryUp:**

| What | How |
|------|-----|
| **Logs and traces** | Use OpenTelemetry auto-instrumentation or SDKs and export OTLP/HTTP to EveryUp. |
| **API request correlation** | EveryUp projects OTel SERVER spans with HTTP attributes into the API request inspector. |

OTLP uses the API key shown in the **Integration** tab of each log service.

### Infra

Collects real-time server resource usage and records historical trends.

- **Local collection**: Collects CPU, memory, disk, and network directly from the host running the agent
- **SSH remote collection**: Collects metrics from remote servers via SSH — no agent installation required
- **Detail view**: Radial gauges (live) + trend charts (time-series) + process list
- **Credential security**: SSH passwords and private keys are encrypted with AES-256-GCM before being stored in the database. The encryption key is auto-generated on first run and never exposed through the API.

### Alerts

Sends notifications to external channels when thresholds are exceeded or incidents occur.

- **Channels**: Telegram, Discord, Slack, and Webhook — multiple channels can be registered simultaneously
- **Rules**: Conditions include health check down, infra CPU/memory/disk thresholds, and log error/warn events
- **History**: Browse send success/failure records by channel and timeline

### Settings

Manages system-wide configuration for your EveryUp instance.

- **Account**: Change the admin password
- **Data retention**: Configure retention periods for logs, metrics, and alert history
- **Collection interval**: Set the infra metric collection and storage intervals
- **Theme**: Toggle between light and dark mode

---

## Quick Start

No pre-configuration needed. On first launch, create your admin account directly in the browser. Encryption keys and JWT secrets are auto-generated on first run.

Supports `linux/amd64` and `linux/arm64` — Docker automatically pulls the correct variant.

### Docker

```bash
docker pull aiturn/everyup:latest
```

```bash
docker run -d \
  --name everyup \
  -p 3001:3001 \
  -v everyup-data:/app/data \
  aiturn/everyup:latest
```

### Docker Compose

**1.** Create `.env` — all variables are optional. Skip this file entirely if the defaults are fine.

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Or create it manually with the variables you want to override:

```dotenv
# EVERYUP_SERVER_PORT=3001
# EVERYUP_ADMIN_USERNAME=admin
# EVERYUP_ADMIN_PASSWORD=changeme
# TZ=Asia/Seoul
```

> If `EVERYUP_ADMIN_USERNAME` and `EVERYUP_ADMIN_PASSWORD` are both set, EveryUp creates or resets that admin account on every startup. Leave them unset after the initial setup unless you intentionally want to pre-seed or reset the admin login.

**2.** Create `docker-compose.yml`:

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
```

**3.** Start:

```bash
docker compose up -d
```

Open **http://localhost:3001** and create your admin account.

---

### Local Development

**Prerequisites:** [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation)

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
```

**Backend**
```bash
cd backend
go run ./cmd/server
# → http://localhost:3001
```

> Copy `.env.example` to `.env` before running if you need custom CORS settings for local dev (port 5173).
> - Linux / macOS: `cp .env.example .env`
> - Windows (PowerShell): `Copy-Item .env.example .env`
> - Windows (CMD): `copy .env.example .env`

**Frontend**
```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:5173
```

**Run backend tests**
```bash
cd backend
go test ./internal/api/handlers/ -v
```

**Project Structure**
```
everyup/
├── frontend/      # React + Vite + TypeScript + Tailwind CSS
├── backend/       # Go (Fiber) + SQLite + WebSocket
```

---

## Configuration

All `config.json` values can be overridden with `EVERYUP_`-prefixed environment variables.

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `EVERYUP_SERVER_MODE` | `production` | Run mode: `development` or `production` |
| `EVERYUP_SERVER_PORT` | `3001` | Server port |
| `EVERYUP_SERVER_ALLOWORIGINS` | *(same-origin)* | Allowed CORS origins (e.g. `https://your-domain.com`) |
| `EVERYUP_ADMIN_USERNAME` | *(unset)* | Creates or resets an admin account on startup |
| `EVERYUP_ADMIN_PASSWORD` | *(unset)* | Password for the admin account above |
| `EVERYUP_DATABASE_PATH` | `./data/monitoring.db` | SQLite file path |
| `TZ` | System default | Timezone (e.g. `America/New_York`) |

See [backend/README.md](backend/README.md) for the full configuration reference.

---

## Data Backup

All EveryUp data is stored in a single SQLite file.

```bash
# Inspect volume location
docker volume inspect everyup-data

# Backup to your local machine (safe while the container is running)
docker cp everyup:/app/data/monitoring.db ./monitoring.db.bak
```

---

## OpenTelemetry Ingestion

Use OpenTelemetry auto-instrumentation or SDKs to send logs and traces to EveryUp over OTLP/HTTP.

**1. Get an API key**

In the EveryUp dashboard, go to **Logs -> Service detail -> Integration** tab to generate an API key.

**2. Configure OTLP**

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

---

## Documentation

| Document | Description |
|----------|-------------|
| [backend/README.md](backend/README.md) | Backend API and configuration reference |
| [frontend/README.md](frontend/README.md) | Frontend dev setup and page structure |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | Telegram, Discord & Slack channel setup guide |

---

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/ai-turn/everyup/issues).

When submitting a Pull Request:
- Include a brief description of what changed and why
- Run `go test ./internal/api/handlers/ -v` and confirm tests pass
- Keep changes focused — one concern per PR

---

## License

MIT
