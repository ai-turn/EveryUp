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

EveryUp is a self-hosted tool for monitoring your Docker services in one place.
Run **Web** once on a dashboard server and one **Agent** on each server you
want to monitor. There is no large observability stack to set up.

| Part | What it does | Where it runs |
| --- | --- | --- |
| **Web** | Dashboard, users, alert rules, notification channels, history | Your dashboard server |
| **Agent** | Docker discovery, container state, logs, host metrics | Each server you monitor |

## Features

🟢 Built-in — works out of the box, no app code changes · 🔵 Optional — enable when needed

|  | Feature | Description |
| :-: | --- | --- |
| 🟢 | 💓 Health checks | Automatic Docker container discovery, container state and health |
| 🟢 | 🖥️ Infrastructure | Host CPU, memory, disk, and network metrics |
| 🟢 | 📜 Logs | Container stdout/stderr collection |
| 🟢 | 🌐 API status | Request status codes (method, path, status) parsed from access logs |
| 🟢 | 🔔 Notifications | Telegram, Discord, and Slack channels |
| 🔵 | ⚡ API latency & traces | eBPF sidecar — no app changes |
| 🔵 | 🔍 API headers & bodies | OpenTelemetry instrumentation — one app restart |

## Quick Start

This is the smallest setup: one Web and one Agent, both with Docker Compose.
On a single server you can run both side by side. Compose templates live in
[`web/docker-compose.yml`](web/docker-compose.yml) and
[`agent/docker-compose.yml`](agent/docker-compose.yml).

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

Open `http://WEB_SERVER_IP:3001` and create the first admin account. Done.

### 2. Create an Agent key

In the dashboard, open **Services** and click **Add Project**. Copy the API
key (`evup_svc_...`) shown after creation.

### 3. Add the Agent to the monitored server

Add an `everyup-agent` service to the Compose file on the server you want to
monitor. Your app containers need no configuration.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"   # Web address reachable from the Agent container
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

Within about 30 seconds the Agent shows as online in Web and the containers on
that server appear automatically. If something goes wrong, see
[Troubleshooting](#troubleshooting).

## Optional Features

### eBPF sidecar: API latency and traces

The default Agent reads method, path, and status from access logs. To see real
latency and traces, enable the `everyup-ebpf` sidecar included in the Agent
Compose file.

1. Uncomment the `everyup-ebpf` service in `agent/docker-compose.yml`.
2. Set `BEYLA_OPEN_PORT` to the ports your apps listen on, e.g. `"80,3000,8080"`.
3. Run `docker compose up -d` again.

This does not change your app code, Dockerfile, or app containers. eBPF
observes processes on the host to build traces, and the Agent attributes each
span to the matching Docker service. Requires Linux kernel 5.8+ with BTF. See
"Zero-Code Tracing" in [agent/README.md](agent/README.md) for details.

### OpenTelemetry instrumentation: request/response headers and bodies

To diagnose why a request failed, use app-side OpenTelemetry instrumentation.
It requires one app restart, but for Java and Node.js it attaches through a
Compose override without touching your code or Dockerfile.

In the web UI, open a project and run the **OTel instrumentation** action. It
generates a `docker-compose.everyup.yml` tailored to the detected Java/Node.js
runtimes. Restart your app with this override to collect request/response
headers and traces with real latency.

Automatic body capture is currently available for Node.js. Bodies are masked
inside the app before export, are admin-only in Web, and viewing is audited.
Java, Python, and manual SDKs can add masked body span events explicitly. For
the full setup, see the
[OTel API instrumentation guide](docs/OTEL_API_INSTRUMENTATION.md).

## What Gets Collected

### Default Agent

Collected with no app changes. The Agent mounts the Docker socket and
`/hostfs` read-only.

| Data | Source |
| --- | --- |
| Container up/down, name, image, state, events | Docker socket |
| stdout/stderr logs | `docker logs` |
| API request method, path, status (no latency) | Access-log parsing |
| Host CPU, memory, disk, network | `/hostfs` mount |

API status codes appear when the app or a proxy writes access logs to
stdout/stderr. Without access logs, container state, regular logs, and host
metrics are still collected.

### Optional: eBPF sidecar

| Data | Source |
| --- | --- |
| API traces with real latency | `everyup-ebpf` sidecar (eBPF) |
| method, path, status, duration | Host process observation |
| Many languages including Go, and HTTPS services | Grafana Beyla-based eBPF |

### Optional: app-side OpenTelemetry instrumentation

| Data | Source |
| --- | --- |
| Request/response headers | `http.*.header.*` span attributes |
| Request/response bodies | `*_body_masked` span events |
| App metrics (JVM memory, GC, custom counters) | App OTel -> Agent `:4318` |

## Troubleshooting

**The Agent does not show as online.**
`EVERYUP_WEB_BASE_URL` must be a Web address reachable from inside the Agent
container. Even on the same server, `localhost` inside the container may point
to the Agent itself, not Web. Use a Compose service name or a host-reachable IP.

**The Agent cannot read the Docker socket.**
This is a permission issue. The simplest fix is to add `user: "0:0"` to the
Agent service. To narrow socket access in production, use the
[Docker socket proxy guide](agent/docs/docker-socket-proxy.md).

**Logs are not showing up.**
Logs written only to a file inside the container are not visible to Docker, so
the Agent cannot collect them. Write app or proxy logs to stdout/stderr.

**Backups for production deployments.**
Back up `/app/data`. If you set `EVERYUP_ENCRYPTION_KEY`, keep that same
64-char hex key with your deployment secrets. A database backup alone cannot
restore encrypted Agent keys or notification secrets without the key.
See the [backup and restore guide](docs/BACKUP_RESTORE.md) for details.

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

**Networking.** The Agent reaches containers and logs through the mounted
Docker socket, so it works even from its own Compose project. The cleanest
setup is to put `everyup-agent` in the same Compose file as the app stack on
that server.

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

Prerequisites for source development: Docker, pnpm, Go 1.24 for Web, and Go
1.25 for Agent.

```bash
cd web/backend && go test ./...     # backend tests
cd web/frontend && pnpm build       # frontend build
cd agent && go test ./...           # agent tests
```
