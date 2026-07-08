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
  <a href="#what-gets-collected">What's Collected</a> -
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24%2F1.25-00ADD8?logo=go" alt="Go 1.24 / 1.25">
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
- API status codes (method, path, status) parsed from access logs — no proxy, no code change
- Host CPU, memory, disk, and network metrics
- Telegram, Discord, and Slack notifications
- Optional: request/response **headers** and supported **body capture** via app-side OpenTelemetry (opt-in)

EveryUp has two parts:

| Part | What it does | Where it runs |
| --- | --- | --- |
| **Web** | Dashboard, users, alert rules, notification channels, history | Your dashboard server |
| **Agent** | Docker discovery, container state, logs, host metrics | Each server you monitor |

## Quick Start

> Run **Web** once, then drop a single **Agent** service into the Compose stack on
> each server you want to monitor. The Agent is read-only and needs no traffic
> changes. Compose templates also live in [`web/`](web/docker-compose.yml) and
> [`agent/`](agent/docker-compose.yml).

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

> **Production note.** Back up `/app/data`. If you set
> `EVERYUP_ENCRYPTION_KEY`, keep that same 64-char hex key with your deployment
> secrets; a database backup alone cannot restore encrypted Agent keys or
> notification secrets without the matching key material.

### 2. Create an Agent key

In the dashboard, open **Projects** (the Services page) and click **Add
Project**. Copy the API key (`evup_svc_…`) shown after creation — it belongs to
the Agent only.

### 3. Add the Agent to the monitored server

One Compose service gets you container health, stdout/stderr logs, host metrics,
and **API status codes parsed from access logs**. No per-service config, no
traffic interception: the Agent only *reads* the Docker socket.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
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
docker compose up -d
```

If the Agent cannot read `/var/run/docker.sock` on your host, either run it with
`user: "0:0"` or use the Docker socket proxy pattern in
[agent/docs/docker-socket-proxy.md](agent/docs/docker-socket-proxy.md).

The Agent comes online within ~30s and auto-discovers every container — health,
logs, host metrics, and API status codes flow with **no app changes**. (What's
collected and how is detailed in "What Gets Collected" below.)

> **Optional — latency & full traces, still no app changes.** Uncomment the
> `everyup-ebpf` sidecar in the Agent compose, set `BEYLA_OPEN_PORT` to your app
> ports, and `docker compose up -d`. It uses eBPF to trace services on the host —
> all languages including Go, HTTPS included — with no app restart and no code.
> The Agent attributes each span to the right service automatically. See
> "Zero-Code Tracing" in
> [agent/README.md](agent/README.md).

### 4. (Optional) Request/response headers & bodies

This is the one step that touches your app, and it is how EveryUp captures richer
request/response details for diagnosing *why* a request failed. The Agent ships a
ready-made OpenTelemetry bundle (Java agent jar + Node.js bootstrap) in a shared
volume; in the web UI, open a project and use the **OTel instrumentation** action
to generate a `docker-compose.everyup.yml` override for detected Java/Node.js
runtimes, then restart your app once with it.

The bundled setup captures headers and full traces with real latency. Automatic
body capture is currently available for Node.js; Java, Python, and manual SDKs
can add masked body span events explicitly. Bodies are masked inside the app
before export and are admin-only in Web (viewing is audited). Full walkthrough,
the span contract, and language notes:
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md).

## What Gets Collected

**Automatically, from every Agent — no config, read-only** (Docker socket + `/hostfs`):

| Data | Source |
| --- | --- |
| Container up/down, name, image, state, events | Docker socket |
| stdout/stderr logs | `docker logs` |
| API requests — method, path, status (no latency) | Access-log parsing |
| Host CPU, memory, disk, network | `/hostfs` mount |

**With the optional eBPF sidecar — still no app changes:**

| Data | Source |
| --- | --- |
| API traces with real latency, all languages + HTTPS | `everyup-ebpf` sidecar (eBPF) |

**With one restart of the app (bundled OTel instrumentation):**

| Data | Source |
| --- | --- |
| Request/response headers | `http.*.header.*` span attributes |
| Request/response bodies (Node auto-capture, other runtimes by manual span events; masked, admin-only) | `*_body_masked` span events |
| App metrics — JVM memory, GC, custom counters | App OTel → Agent `:4318` |

A service that writes logs only to a file inside the container cannot be seen by
the Agent. Write app logs to stdout for log collection. API status codes need the
app to emit access logs (Nginx / Apache / structured JSON); otherwise the Agent
still collects health, logs, and host metrics.

## Documentation

| Document | What's inside |
| --- | --- |
| [web/README.md](web/README.md) | Web setup, environment variables, API areas, local development |
| [agent/README.md](agent/README.md) | Agent setup, full environment variable reference, Compose settings |
| [agent/docs/docker-socket-proxy.md](agent/docs/docker-socket-proxy.md) | Stricter Docker socket access for production Agent deployments |
| [agent/docs/web-connected-mode.md](agent/docs/web-connected-mode.md) | How Agent enrollment and Web sync work |
| [agent/docs/host-metrics.md](agent/docs/host-metrics.md) | Host CPU, memory, disk, and network collection details |
| [agent/docs/otel-collector.md](agent/docs/otel-collector.md) | Optional OTel collector configuration generated by the Agent |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | Telegram / Discord / Slack channel credentials and configuration ([한국어](docs/NOTIFICATION_SETUP.ko.md)) |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backing up and restoring the `/app/data` directory ([한국어](docs/BACKUP_RESTORE.ko.md)) |
| [docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md) | Capturing request/response headers and bodies via OpenTelemetry, per language ([한국어](docs/OTEL_API_INSTRUMENTATION.ko.md)) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Historical feature, refactor, and bugfix notes |

## Reference

**Networking** — The Agent reaches containers and logs through the mounted Docker
socket, so it works even from its own Compose project. For the cleanest setup, put
`everyup-agent` in the same Compose file as the app stack on that server.

**Repository layout**

```text
web/
  backend/                 # Go 1.24 API server, SQLite migrations, OTLP ingest
  frontend/                # React 19 / Vite dashboard
  docker-compose.yml       # Web-only Compose template
agent/
  cmd/                     # Agent entrypoint
  docs/                    # Agent deployment and operations notes
  instrumentation/         # Bundled app-side OTel helpers
  docker-compose.yml       # Agent Compose template
docs/                      # User docs, backup/restore, notifications, OTel guide
docker-compose.yml         # root convenience Compose file (Web only)
```

**Development**

Prerequisites for source development: Docker, pnpm, Go 1.24 for Web, and Go 1.25
for Agent.

```bash
cd web/backend && go test ./...     # backend tests
cd web/frontend && pnpm build       # frontend build
cd agent && go test ./...           # agent tests
```
