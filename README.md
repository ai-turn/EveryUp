<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  A self-hosted monitoring dashboard and lightweight Agent for Docker services.
</p>

<p align="center">
  <a href="README.ko.md">한국어</a> -
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> -
  <a href="#quick-start">Quick Start</a> -
  <a href="#compose-files">Compose Files</a> -
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

EveryUp helps you monitor the services running on your own servers without
setting up a large observability stack.

It gives you:

- A Web dashboard for health, logs, API requests, infrastructure, and alerts
- A lightweight Agent that discovers Docker containers automatically
- Docker stdout/stderr log collection without changing your application code
- Host CPU, memory, and disk monitoring
- Telegram, Discord, and Slack notifications configured in the Web UI
- A local OTLP/HTTP gateway for applications that already emit OpenTelemetry

The default setup is intentionally simple: use Docker Compose, run Web, then run
an Agent on each server you want to monitor.

## Quick Start

EveryUp has two parts:

| Part | What it does | Where it runs |
| --- | --- | --- |
| Web | Dashboard, users, alert rules, notification channels, history | Your dashboard server |
| Agent | Docker discovery, health checks, logs, host metrics, OTLP forwarding | Each server you monitor |

You can start with Web first, then add the Agent when you are ready to collect
real server data.

### 1. Start Web

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

Open `http://localhost:3001` and create the first admin account.

If Web is running on a remote server, open `http://WEB_SERVER_IP:3001` instead.
Make sure that address is reachable from the server where the Agent will run.

### 2. Create an Agent key

In the Web dashboard, open **Services -> Add** and create an Agent entry. Copy the
API key shown after creation. It looks like this:

```text
evup_svc_...
```

This key belongs to the Agent. Your backend and frontend services do not need it.

### 3. Start the Agent

Run this on the server you want to monitor:

```bash
mkdir everyup-agent && cd everyup-agent
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/agent/docker-compose.yml
```

Open `docker-compose.yml` and replace only these values:

```yaml
environment:
  EVERYUP_WEB_SYNC_ENABLED: "true"
  EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"
  EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
  EVERYUP_TELEMETRY_GATEWAY_ENABLED: "true"
```

Then start the Agent:

```bash
docker compose up -d
```

The Agent should appear online in Web within about 30 seconds.

With just the Agent running, EveryUp can collect Docker container state, Docker
events, stdout/stderr logs, and host metrics through the read-only Docker socket.
No EveryUp environment settings are required in your existing application
containers.

### 4. Add labels to services you want to monitor

Add Docker labels to the containers that should become services in EveryUp.

For basic liveness and logs:

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "worker"
```

For an HTTP health check:

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.url: "http://api:8080/health"
```

For a TCP health check:

```yaml
services:
  postgres:
    image: postgres:16
    labels:
      everyup.enabled: "true"
      everyup.service.name: "postgres"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"
```

Only `everyup.enabled: "true"` is required. Add `everyup.health.url` or
`everyup.health.port` when you want active checks with response time and status
codes.

## Networking Notes

The Agent can discover containers, read logs, and track basic liveness through
the Docker socket even when it runs from its own Compose file.

Active HTTP checks need network access from the Agent to the target service. For
example, `http://api:8080/health` works only when the Agent can resolve `api` on
the same Docker network.

Common options:

- Put the `everyup-agent` service in the same Compose file as your application
- Attach the Agent to the same external Docker network as your application
- Use a reachable host or IP address in `everyup.health.url`

## Compose Files

### Web only

Use this on the dashboard server:

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

### Agent only

Use this on each monitored server:

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
      EVERYUP_TELEMETRY_GATEWAY_ENABLED: "true"
    expose:
      - "4318"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
    driver: local
```

The Agent OTLP gateway is available inside the same Compose network at
`http://everyup-agent:4318`. Publish port `4318` only when applications outside
that network need to send OTLP to the Agent.

## Repository Layout

```text
.
  web/
    docker-compose.yml     # Web-only Compose file
    backend/               # Go API server, SQLite storage, OTLP ingestion
    frontend/              # React dashboard
  agent/
    docker-compose.yml     # Agent-only Compose file
    internal/              # Agent implementation
  docker-compose.yml       # Web-only root convenience Compose file
```

## Development

Backend tests:

```bash
cd web/backend
go test ./...
```

Frontend build:

```bash
cd web/frontend
pnpm build
```

Agent tests:

```bash
cd agent
go test ./...
```