# EveryUp Agent

EveryUp Agent is the standalone sidecar agent for local monitoring, alerting,
ChatOps, and optional EveryUp Web sync.

## Quick Start

Two required values. Everything else has a working default.

**1. Create `docker-compose.yml`**

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    env_file:
      - path: .env
        required: false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
    driver: local
```

**2. Create `.env`** and set at least:

```bash
EVERYUP_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...   # from BotFather
EVERYUP_TELEGRAM_CHAT_IDS=123456789            # your chat ID
```

Don't have a Telegram bot yet? Follow [docs/NOTIFICATION_SETUP.ko.md](../docs/NOTIFICATION_SETUP.ko.md) (or the [English version](../docs/NOTIFICATION_SETUP.md)) to create one in under 5 minutes.

**3. Add labels to the services you want monitored** (your existing `docker-compose.yml`)

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"          # ← required: display name in alerts and dashboard
      everyup.health.type: "http"
      everyup.health.url: "http://api:8080/health"
```

For a TCP-only service (postgres, redis, …):

```yaml
labels:
  everyup.enabled: "true"
  everyup.service.name: "postgres"         # ← required: without this, raw container ID is shown
  everyup.health.type: "tcp"
  everyup.health.port: "5432"
```

> **`everyup.service.name` is required.** Omitting it causes the agent to fall back to the container's short ID (e.g. `a3b4c5d6e7f8`) as the service name.

**4. Run**

```bash
docker compose up -d
```

Or add the agent service directly to your existing compose file instead:

```yaml
  everyup-agent:
    image: aiturn/everyup-agent:latest   # or `build: ./agent` to build from source
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data

volumes:
  everyup-agent-data:
```

Telegram sends a startup message within seconds. The agent auto-discovers any
container with `everyup.enabled: "true"` and starts checking it on the next
30-second tick.

It supports:

- Environment-based configuration
- Telegram startup and health-check alerts
- HTTP health checks
- Docker label discovery for HTTP/TCP health targets
- Basic cooldown and recovery notifications
- Generated OTel Collector sidecar config
- Optional EveryUp Web enrollment, service mapping sync, host metrics sync, and audit event sync
- Optional OpenAI-compatible LLM incident summaries with masking
- Telegram ChatOps `/status`, `/services`, `/logs`, `/explain`, and `/silence`
- Markdown Runbook suggestions for common incidents
- Optional external heartbeat ping for dead-man's-switch monitoring
- SQLite incident memory with similar incident search and postmortem drafts
- Host CPU, memory, and disk threshold alerts
- Approved action flow for dry-run `/restart`
- A standalone Docker image and compose example for sidecar deployment

## Run locally

```bash
cd agent
cp .env.example .env
go run ./cmd/everyup-agent
```

PowerShell example:

```powershell
$env:EVERYUP_TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
$env:EVERYUP_TELEGRAM_CHAT_IDS="123456789"
$env:EVERYUP_SERVICE_NAME="my-service"
$env:EVERYUP_HEALTH_URL="http://localhost:8080/health"
go run ./cmd/everyup-agent
```

## Environment

| Variable | Required | Default | Description |
|---|---:|---|---|
| `EVERYUP_TELEGRAM_BOT_TOKEN` | yes | | Telegram bot token |
| `EVERYUP_TELEGRAM_CHAT_IDS` | yes | | Comma-separated Telegram chat IDs |
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Agent instance name |
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Name for the `EVERYUP_HEALTH_URL` target. Has no effect when using Docker label discovery only. |
| `EVERYUP_DATA_DIR` | no | `/data` | Local state and audit directory |
| `EVERYUP_HEALTH_URL` | no | | Single HTTP URL to monitor directly — **leave empty when using Docker label discovery.** Setting this creates an additional service card in the dashboard named after `EVERYUP_SERVICE_NAME`. |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Re-alert cooldown |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers with EveryUp labels |
| `EVERYUP_DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Docker Engine socket path |
| `EVERYUP_OTEL_CONFIG_ENABLED` | no | `false` | Generate Collector config on startup (enable with otel-collector sidecar) |
| `EVERYUP_OTEL_CONFIG_PATH` | no | `/etc/everyup/generated/otel-config.yaml` | Generated Collector config path |
| `EVERYUP_OTEL_CONF_DIR` | no | `/etc/everyup/conf.d` | Reserved override directory |
| `EVERYUP_OTEL_FILELOG_PATHS` | no | Docker container logs | Comma-separated filelog include paths |
| `EVERYUP_WEB_OTLP_ENDPOINT` | no | | Optional EveryUp Web OTLP endpoint |
| `EVERYUP_WEB_API_KEY` | no | | Optional EveryUp Web API key for OTLP forward |
| `EVERYUP_WEB_SYNC_ENABLED` | no | `false` | Enable Web enrollment, service sync, host metrics sync, and audit event sync |
| `EVERYUP_WEB_BASE_URL` | no | | EveryUp Web base URL |
| `EVERYUP_AGENT_API_KEY` | no | | API key generated from the Web UI (Services → 추가하기) |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | no | `30` | Web service and audit sync interval |
| `EVERYUP_LLM_BASE_URL` | no | | OpenAI-compatible API base URL |
| `EVERYUP_LLM_API_KEY` | no | | LLM API key |
| `EVERYUP_LLM_MODEL` | no | | LLM model; required when base URL is set |
| `EVERYUP_LLM_TIMEOUT_SECONDS` | no | `8` | LLM timeout before raw-alert degrade |
| `EVERYUP_LLM_MAX_TOKENS` | no | `500` | LLM summary token budget |
| `EVERYUP_TELEGRAM_API_BASE` | no | `https://api.telegram.org` | Telegram API base URL |
| `EVERYUP_CHATOPS_ENABLED` | no | `true` | Enable Telegram getUpdates command polling |
| `EVERYUP_RUNBOOK_ENABLED` | no | `true` | Enable built-in and custom Runbook suggestions |
| `EVERYUP_RUNBOOK_DIR` | no | `/etc/everyup/runbooks` | Custom Markdown Runbook directory |
| `EVERYUP_HEARTBEAT_URL` | no | | Optional external heartbeat URL |
| `EVERYUP_HEARTBEAT_TOKEN` | no | | Optional bearer token for heartbeat requests |
| `EVERYUP_HEARTBEAT_INTERVAL_SECONDS` | no | `60` | Heartbeat ping interval |
| `EVERYUP_MEMORY_ENABLED` | no | `true` | Enable SQLite incident memory |
| `EVERYUP_MEMORY_PATH` | no | `/data/incident-memory.db` | SQLite incident memory path |
| `EVERYUP_HOST_METRICS_ENABLED` | no | `true` | Enable host resource threshold checks |
| `EVERYUP_HOST_METRICS_ROOT` | no | `/hostfs` | Host filesystem root used for `/proc` reads |
| `EVERYUP_HOST_DISK_PATH` | no | `/hostfs` | Path used for disk usage threshold |
| `EVERYUP_HOST_CPU_PERCENT` | no | | Host CPU alert threshold |
| `EVERYUP_HOST_MEMORY_PERCENT` | no | | Host memory alert threshold |
| `EVERYUP_HOST_DISK_PERCENT` | no | | Host disk alert threshold |
| `EVERYUP_ACTIONS_ENABLED` | no | `false` | Enable approved ChatOps actions |
| `EVERYUP_ACTION_DRY_RUN` | no | `true` | Confirm actions without executing them |
| `EVERYUP_ACTION_ALLOWLIST` | no | | Comma-separated actions allowed, such as `restart` |
| `EVERYUP_ACTION_CONFIRM_TTL_SECONDS` | no | `300` | Confirmation token lifetime |

## API key (connected mode)

`EVERYUP_AGENT_API_KEY` is the only key you need. Generate it in the Web UI
(**Services → 추가하기**; it looks like `evup_svc_...`) and enable web sync:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://your-everyup-web:3001
EVERYUP_AGENT_API_KEY=evup_svc_...
```

The agent sends it as `Authorization: Bearer` on the connected-mode sync endpoints
(`/agents/enroll`, `/agents/:id/services|events|metrics`); the backend validates it
against the `agents` table.

> `EVERYUP_WEB_ENROLLMENT_TOKEN` is the deprecated name for `EVERYUP_AGENT_API_KEY`
> and is still accepted as a fallback.

### Legacy: OTLP forward (`EVERYUP_WEB_API_KEY`)

`EVERYUP_WEB_API_KEY` + `EVERYUP_WEB_OTLP_ENDPOINT` are leftovers from a previous
architecture. OTLP log/trace ingest authenticates against a separate **log-service**
API key, and the current build has **no UI or API route to create one** — so these
variables are not usable as-is. Use connected mode (above) instead.

## Docker discovery

Mount the Docker socket read-only and add labels to services that should be
monitored.

```yaml
services:
  everyup-agent:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - everyup-agent-data:/data

  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.type: "http"
      everyup.health.url: "http://api:8080/health"

  postgres:
    image: postgres:16
    labels:
      everyup.enabled: "true"
      everyup.service.name: "postgres"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"

volumes:
  everyup-agent-data:
```

See [Docker Label Discovery](docs/docker-labels.md) for the full label spec.

For production hardening, see [Docker Socket Proxy](docs/docker-socket-proxy.md).

## OTel Collector sidecar

> **Legacy.** This forwards telemetry to EveryUp Web's OTLP endpoint, which needs
> the `EVERYUP_WEB_API_KEY` log-service key — not provisionable in the current
> build (see [API key](#api-key-connected-mode)). Kept for reference / external
> OTLP backends.

The agent generates a Collector config at `EVERYUP_OTEL_CONFIG_PATH`. Use
[compose.example.yml](compose.example.yml) to run the agent with an
`otel/opentelemetry-collector-contrib` sidecar.

See [OTel Collector Sidecar](docs/otel-collector.md) for details.

## Web connected mode

Connect the agent to your EveryUp Web instance so the browser dashboard shows
real-time service health, logs, and infrastructure metrics alongside Telegram
alerts.

**Setup:**

1. In the Web dashboard, go to the Services page and click **추가하기** (Add)
2. Enter a name for this agent and copy the generated API key (`evup_svc_...`)
3. Add three lines to your agent `.env`:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://your-everyup-web:3001
EVERYUP_AGENT_API_KEY=evup_svc_...
```

4. Restart the agent — it connects automatically and appears online within 30 seconds.

Local Telegram alerts, ChatOps, and audit logs continue to work even if the Web
connection is unavailable.

See [Web Connected Mode](docs/web-connected-mode.md) for the full API contract.

## LLM incident summaries

Set `EVERYUP_LLM_BASE_URL`, `EVERYUP_LLM_API_KEY`, and `EVERYUP_LLM_MODEL` to
add an AI summary to failure alerts. If the provider fails or times out, the
raw alert still sends.

See [LLM Incident Summary](docs/llm-summary.md) for setup and masking details.

## Telegram ChatOps

When `EVERYUP_CHATOPS_ENABLED=true`, the agent polls Telegram for commands from
allowed chat IDs. Supported commands include `/status`, `/services`,
`/logs <service> [lines]`, `/explain <service>`, `/memory <service>`,
`/postmortem <service>`, and `/silence <service> <duration> [reason]`.

See [Telegram ChatOps](docs/chatops.md) for command details.

## Runbooks

The agent includes built-in Markdown runbooks for HikariCP, Nginx 502, disk
full, and container restart symptoms. Matching suggestions are appended to
failure alerts and `/explain` responses. Add custom `.md` files under
`EVERYUP_RUNBOOK_DIR` to extend the library.

See [Runbooks](docs/runbooks.md) for the file format.

## Heartbeat Watchdog

Set `EVERYUP_HEARTBEAT_URL` to ping an external dead-man's-switch service on a
fixed interval. This helps detect when the Agent host itself is down. If a token
is set, the request includes `Authorization: Bearer <token>`.

See [Heartbeat Watchdog](docs/heartbeat-watchdog.md) for details.

## Incident Memory

The agent stores alert, recovery, and command history in SQLite. Use
`/memory <service>` to search similar incidents and `/postmortem <service>` to
draft a lightweight postmortem from the latest recorded incident.

See [Incident Memory](docs/incident-memory.md) for schema and behavior.

## Approved actions

Actions use a two-step flow. `/restart <service>` creates a token and
`/confirm <token>` approves it. Actions are disabled by default and dry-run by
default.

See [Approved Actions](docs/approved-actions.md) for safety details.

## Local state

The agent writes alert state and audit events under `EVERYUP_DATA_DIR`.

- `agent-state.json`: target health state, last alert time, and future silence data
- `audit.jsonl`: startup, alert, and recovery audit events
- `incident-memory.db`: SQLite incident and command history

Mount this directory as a persistent volume so cooldown/recovery state survives
container restarts.

See [Local State](docs/local-state.md) for file formats.

## Build

```bash
go build ./cmd/everyup-agent
docker build -t everyup-agent:dev .
```
