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
  <a href="#api-request-monitoring-optional">API Monitoring</a> -
  <a href="#what-gets-collected">What's Collected</a>
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

Monitor Docker services on your own servers without standing up a large
observability stack. You get a Web dashboard for **service health, logs, API
requests, infrastructure, and alerts** — fed by one lightweight Agent per server.

- Automatic Docker container discovery — no per-service config
- stdout/stderr log collection without changing application code
- API request data (method, path, status, duration)
- Host CPU, memory, disk, and network metrics
- Telegram, Discord, and Slack notifications

EveryUp has two parts:

| Part | What it does | Where it runs |
| --- | --- | --- |
| **Web** | Dashboard, users, alert rules, notification channels, history | Your dashboard server |
| **Agent** | Docker discovery, container state, logs, host metrics | Each server you monitor |

## Quick Start

> Run **Web** once, then drop the **Agent** into the Compose stack on each server
> you want to monitor. Compose templates also live in [`web/`](web/docker-compose.yml)
> and [`agent/`](agent/docker-compose.yml).

### 1. Start Web

On the dashboard server, create `docker-compose.yml`:

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

```bash
docker compose up -d
```

Open `http://WEB_SERVER_IP:3001` and create the first admin account.

### 2. Create an Agent key

In the dashboard, open **Services → Add** and create an Agent entry. Copy the API
key (`evup_svc_…`) shown after creation — it belongs to the Agent only.

### 3. Add the Agent to the monitored server

Add `everyup-agent` to that server's `docker-compose.yml` (next to your app
services if it already has a Compose file):

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"   # reachable from this server
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"        # key from step 2
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

```bash
docker compose up -d everyup-agent
```

The Agent appears online within ~30s and automatically finds the other containers
on that host. **Container health, logs, and host metrics now flow with no
per-service configuration.** For per-request API data, see the next section.

## API Request Monitoring (optional)

Per-request API data is collected through the EveryUp Agent image running in
`proxy` mode. Put it in front of the application service and route client traffic
through the proxy. This is the supported path for request/response capture;
stdout access-log parsing and app-side API capture modes are no longer supported.

```yaml
services:
  app:
    image: your-app:latest

  everyup-proxy:
    image: aiturn/everyup-agent:latest
    environment:
      EVERYUP_AGENT_MODE: "proxy"
      EVERYUP_PROXY_LISTEN_ADDR: ":8080"
      EVERYUP_PROXY_UPSTREAM_URL: "http://app:8080"
      EVERYUP_PROXY_OTLP_ENDPOINT: "http://everyup-agent:4318"
      EVERYUP_CAPTURE_ENABLED: "false"
      EVERYUP_CAPTURE_ROUTES: "/api/..."
    ports:
      - "8080:8080"
    restart: unless-stopped
```

The proxy forwards traffic unchanged and exposes `/health`. Body capture is
configured on the proxy path so route, status, latency, and masking policies have
one source of truth. Captured body events are hidden from non-admin users in the
trace API, admin body views are recorded in `audit_events`, and body-bearing
spans are retained for 7 days by default (`EVERYUP_RETENTION_BODYCAPTUREDAYS`).

> **Link logs to a request.** Print the trace id or request id in your logs so
> EveryUp can correlate proxy-captured requests with application logs.

## What Gets Collected

With the standard Agent, from the Docker socket and `/hostfs`:

| Data | Source |
| --- | --- |
| Container up/down, name, image, state, events | Docker socket |
| stdout/stderr logs | `docker logs` |
| Host CPU, memory, disk, network | `/hostfs` mount |

With the proxy-mode Agent in front of an app:

| Data | Source |
| --- | --- |
| API requests | Inline HTTP proxy |
| Request/response bodies | Proxy capture policy, off by default |

A service that writes logs only to a file inside the container cannot be seen by
the standard Agent. Write app logs to stdout for log collection.

## Documentation

| Document | What's inside |
| --- | --- |
| [web/README.md](web/README.md) | Web setup, environment variables, API areas, local development |
| [agent/README.md](agent/README.md) | Agent setup, full environment variable reference, Compose settings |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | Telegram / Discord / Slack channel credentials and configuration ([한국어](docs/NOTIFICATION_SETUP.ko.md)) |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backing up and restoring the `/app/data` directory ([한국어](docs/BACKUP_RESTORE.ko.md)) |
| [docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md) | Per-request API capture via OpenTelemetry auto-instrumentation, per language (한국어) |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | Linking logs to API requests with `request_id` / trace id (한국어) |
| [docs/OTEL_ONLY_MIGRATION.md](docs/OTEL_ONLY_MIGRATION.md) | Logs and traces are accepted via OpenTelemetry OTLP/HTTP only |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Feature, refactor, and bugfix history (한국어) |

## Reference

**Networking** — The Agent reaches containers and logs through the mounted Docker
socket, so it works even from its own Compose project. For the cleanest setup, put
`everyup-agent` in the same Compose file as the app stack on that server.

**Repository layout**

```text
web/                       # Web — Go API + SQLite + React dashboard
  docker-compose.yml
agent/                     # Agent — Docker discovery, logs, host metrics
  docker-compose.yml
docker-compose.yml         # root convenience (Web only)
```

**Development**

```bash
cd web/backend && go test ./...     # backend tests
cd web/frontend && pnpm build       # frontend build
cd agent && go test ./...           # agent tests
```
