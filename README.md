<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  Self-hosted monitoring Web plus a lightweight AI Agent for Docker services, logs, metrics, traces, and ChatOps.
</p>

<p align="center">
  <a href="README.ko.md">한국어</a> ·
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
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

EveryUp started as a self-hosted monitoring dashboard and now ships as two clear parts:

- **EveryUp Web**: the central dashboard, API, SQLite storage, alert configuration, OTLP ingestion, and frontend UI.
- **EveryUp Agent**: a standalone sidecar agent that can run next to Docker services, discover containers by label, watch health/logs/resources, send Telegram ChatOps alerts, and optionally sync history back to EveryUp Web.

## Repository Layout

```text
everyup/
  web/
    backend/       # Go API server, SQLite migrations, OTLP ingestion
    frontend/      # React/Vite dashboard
    Dockerfile     # Full-stack Web image

  agent/           # Standalone EveryUp Agent
    cmd/
    internal/
    docs/
    compose.example.yml

  docs/            # Operator docs, changelog, roadmaps
  docker-compose.yml
  .env.example
```

This is a monorepo, but the deployable products are intentionally separate. Web and Agent can be released, installed, and secured independently.

## Quick Start

Docker Compose is the recommended way to start EveryUp Web:

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
docker compose up -d
```

Open `http://localhost:3001` and create the admin account.

Copy `.env.example` to `.env` before starting Compose when you need to customize ports, admin seeding, timezone, or Agent enrollment tokens.

To build the Web image from source:

```bash
docker build -f web/Dockerfile -t everyup:web-dev .
```

## EveryUp Agent

The Agent is optional. Add it when you want monitoring close to the workload, especially inside a private Docker host or internal network.

```bash
cd agent
go run ./cmd/everyup-agent
```

Start with [agent/README.md](agent/README.md), then use the compose and label guides:

- [Agent Docker labels](agent/docs/docker-labels.md)
- [Telegram ChatOps](agent/docs/chatops.md)
- [Web connected mode](agent/docs/web-connected-mode.md)
- [Runbooks](agent/docs/runbooks.md)
- [Incident memory and watchdog](agent/docs/incident-memory.md)

## Local Development

Prerequisites: [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), and [pnpm](https://pnpm.io/installation).

Run the Web backend:

```bash
cd web/backend
go run ./cmd/server
```

Run the Web frontend:

```bash
cd web/frontend
pnpm install
pnpm dev
```

Run the Agent tests:

```bash
cd agent
go test ./...
```

## Documentation

| Document | Description |
| --- | --- |
| [web/README.md](web/README.md) | Web backend, frontend, Docker, and local development |
| [agent/README.md](agent/README.md) | Agent setup, Docker discovery, ChatOps, Web sync, and local state |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Data backup, encryption key retention, and restore flow |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | Telegram, Discord, and Slack setup |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API request logging and inspection guide |
| [docs/roadmaps/EveryUp_Agent_Phase_Roadmap_v3.md](docs/roadmaps/EveryUp_Agent_Phase_Roadmap_v3.md) | Agent product roadmap |

## License

MIT
