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

> Run **Web** once, then drop the **Agent + Proxy** into the Compose stack on each
> server you want to monitor — one stack enables every feature. Compose templates
> also live in [`web/`](web/docker-compose.yml) and [`agent/`](agent/docker-compose.yml).

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

### 3. Add the Agent + Proxy to the monitored server

This single Compose stack enables **every** EveryUp feature: container health,
logs, and host metrics (Agent) plus API requests, traces, and request/response
bodies (Proxy). Client traffic enters through the proxy, which forwards it to your
app unchanged and ships telemetry to the Agent's OTLP gateway.

```yaml
services:
  app:
    image: your-app:latest        # your application
    # No published ports — traffic enters through everyup-proxy below.

  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent  # the proxy reaches it as everyup-agent:4318
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

  everyup-proxy:
    image: aiturn/everyup-agent:latest   # same image, proxy mode
    environment:
      EVERYUP_AGENT_MODE: "proxy"
      EVERYUP_PROXY_LISTEN_ADDR: ":8080"
      EVERYUP_PROXY_UPSTREAM_URL: "http://app:8080"        # ← your app's service:port
      EVERYUP_PROXY_OTLP_ENDPOINT: "http://everyup-agent:4318"
      EVERYUP_PROXY_SERVICE_NAME: "app"                    # name this traffic shows under
      EVERYUP_CAPTURE_ENABLED: "true"                      # capture request/response bodies
      EVERYUP_CAPTURE_ROUTES: "/api/..."                   # which routes to capture
      EVERYUP_CAPTURE_ON_STATUS: "400-599"                 # keep bodies for errors; use "200-599" for all
      EVERYUP_CAPTURE_ON_SLOW_MS: "3000"                   # ...or for requests slower than this
      EVERYUP_CAPTURE_EXCLUDE_ROUTES: "/login,/auth,/payment,/upload"
    ports:
      - "8080:8080"     # clients hit the proxy; it forwards to app:8080
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

```bash
docker compose up -d
```

The Agent appears online within ~30s and discovers the other containers on the
host (health, logs, host metrics flow with no per-service config). Point your
clients at the proxy's `:8080` instead of the app, and **API requests, traces,
and captured bodies appear in the dashboard.** Already have nginx/TLS in front?
Point its upstream at `everyup-proxy:8080` instead of publishing `8080`.

**How body capture works**

- Bodies are kept only for requests matching `CAPTURE_ON_STATUS` **or**
  `CAPTURE_ON_SLOW_MS` — by default errors (`400-599`) and slow requests. A normal
  `200` still appears as a request and trace; its body is skipped unless you widen
  `CAPTURE_ON_STATUS` to `200-599`.
- Open a request (API tab) or a log with a trace link → the **Trace** panel shows
  spans and a **Captured bodies** section. Bodies are **admin-only**; non-admins
  see them redacted, and every admin view is recorded in `audit_events`.
- Secrets in `CAPTURE_MASK_KEYS` are masked best-effort; body-bearing spans are
  retained 7 days (`EVERYUP_RETENTION_BODYCAPTUREDAYS`). Keep sensitive routes in
  `CAPTURE_EXCLUDE_ROUTES`. The `card` regex preset can match long digit runs
  (e.g. millisecond timestamps) — drop it from `EVERYUP_CAPTURE_REGEX_PRESET` if
  that causes false positives.

**Behind an existing nginx (reverse-proxy chaining)**

If nginx already fronts your app, don't publish the proxy's port. Chain it
*between* nginx and your backend, with a `backup` so the proxy can never take your
API down — if it dies, nginx falls straight through to the backend.

```nginx
# in http {} — proxy is primary, backend is the fallback
upstream app_upstream {
    server everyup-proxy:8080 max_fails=2 fail_timeout=10s;  # normal: through the proxy
    server app:8080 backup;                                  # proxy down: direct to backend
}

# in server {} — only the backend-API location changes
location /api {
    proxy_pass http://app_upstream;
    proxy_next_upstream error timeout http_502 http_503 http_504;  # retry backend on failure
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Only the backend-API `location` changes; static/frontend routes stay direct.
nginx keeps terminating TLS and forwards plaintext, so the proxy just parses JSON.
Drop the proxy's `ports:` mapping (nginx reaches it over the Docker network as
`everyup-proxy:8080`), then `nginx -t && nginx -s reload`.

> **Deeper traces (optional).** The proxy already produces one server span per
> request. To also capture in-app spans (DB, external calls), point your app's
> OpenTelemetry exporter at `http://everyup-agent:4318`. Note: running app-side
> OTel *and* the proxy makes each request appear twice in the request list.

> **Link logs to a request.** Print the trace id in your logs so EveryUp can
> correlate proxy-captured requests with application logs.

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
| API requests + traces | Inline HTTP proxy |
| Request/response bodies | Proxy capture policy (errors/slow by default) |

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
