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
  <a href="#api-headers--bodies-optional">API Bodies (optional)</a> -
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
- API status codes (method, path, status) parsed from access logs — no proxy, no code change
- Host CPU, memory, disk, and network metrics
- Telegram, Discord, and Slack notifications
- Optional: request/response **headers and bodies** via an inline proxy (opt-in)

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

### 2. Create an Agent key

In the dashboard, open **Services → Add** and create an Agent entry. Copy the API
key (`evup_svc_…`) shown after creation — it belongs to the Agent only.

### 3. Add the Agent to the monitored server

One Compose service enables **Tier 1** — container health, stdout/stderr logs,
host metrics, and **API status codes parsed from access logs**. No per-service
config, no traffic interception: the Agent only *reads* the Docker socket.

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
docker compose up -d
```

The Agent appears online within ~30s and discovers every container on the host —
health, logs, and host metrics flow with no per-service config. If an app emits
access logs (Nginx / Apache / JSON), its request method, path, and status code
show up in the **API** tab automatically — no proxy, no code change. Access logs
carry no latency, so duration shows as `—`; an app that emits no access logs
simply shows no API rows while everything else keeps working (graceful degrade).

That's the whole Tier 1 setup. For request/response **headers and bodies**,
instrument the app with OpenTelemetry (Tier 2 below).

## API Headers & Bodies (optional)

Tier 1 gives you status codes for free. **Tier 2** additionally captures full
traces with latency, plus request/response **headers and bodies** — for
diagnosing *why* a request failed (the offending payload, a missing field).

Tier 2 is delivered by **app-side OpenTelemetry instrumentation**: the app sends
spans (with the request/response data you choose to record) to the Agent's OTLP
gateway at `http://everyup-agent:4318`. No extra container, no traffic
interception. Per-language setup is in
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md).

- Open a request (API tab) or a log with a trace link → the **Trace** panel shows
  spans and a **Captured bodies** section. Bodies are **admin-only**; non-admins
  see them redacted, and every admin view is recorded in `audit_events`.
- Body-bearing spans are retained 7 days (`EVERYUP_RETENTION_BODYCAPTUREDAYS`).
  Mask or omit secrets and sensitive fields in your instrumentation before export.

> **Avoid double-counting.** A request appears once per source. When app-side OTel
> is enabled for a service, its access-log–derived Tier 1 rows cover the *same*
> requests — so the request list may show each one twice. Pick one source per
> service: rely on Tier 1 access logs *or* enable OTel, not both.

> **Link logs to a request.** Print the trace id in your logs so EveryUp can
> correlate traced requests with application logs.

> **Roadmap.** First-party SDKs and agent-based capture (eBPF) for
> zero-instrumentation header/body collection are planned.

## What Gets Collected

**Tier 1 — every Agent, no config, read-only** (Docker socket + `/hostfs`):

| Data | Source |
| --- | --- |
| Container up/down, name, image, state, events | Docker socket |
| stdout/stderr logs | `docker logs` |
| API requests — method, path, status (no latency) | Access-log parsing |
| Host CPU, memory, disk, network | `/hostfs` mount |

**Tier 2 — optional, opt-in** (app-side OpenTelemetry instrumentation):

| Data | Source |
| --- | --- |
| API requests + traces, with real latency | App OTel → Agent `:4318` |
| Request/response headers and bodies | Recorded in the app's instrumentation |

A service that writes logs only to a file inside the container cannot be seen by
the Agent. Write app logs to stdout for log collection. API status codes need the
app to emit access logs (Nginx / Apache / structured JSON); otherwise Tier 1 still
collects health, logs, and host metrics.

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
