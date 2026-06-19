# EveryUp Agent

EveryUp Agent is the standalone sidecar agent for local monitoring, alerting,
ChatOps, and optional EveryUp Web sync.

It supports:

- Environment-based configuration
- Telegram startup and health-check alerts
- HTTP health checks
- Docker label discovery for HTTP/TCP health targets
- Basic cooldown and recovery notifications
- Generated OTel Collector sidecar config
- Optional EveryUp Web enrollment, service mapping sync, and audit event sync
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
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Name shown in alerts |
| `EVERYUP_DATA_DIR` | no | `/data` | Local state and audit directory |
| `EVERYUP_HEALTH_URL` | no | | HTTP URL to check |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Re-alert cooldown |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers with EveryUp labels |
| `EVERYUP_DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Docker Engine socket path |
| `EVERYUP_OTEL_CONFIG_ENABLED` | no | `true` | Generate Collector config on startup |
| `EVERYUP_OTEL_CONFIG_PATH` | no | `/etc/everyup/generated/otel-config.yaml` | Generated Collector config path |
| `EVERYUP_OTEL_CONF_DIR` | no | `/etc/everyup/conf.d` | Reserved override directory |
| `EVERYUP_OTEL_FILELOG_PATHS` | no | Docker container logs | Comma-separated filelog include paths |
| `EVERYUP_WEB_OTLP_ENDPOINT` | no | | Optional EveryUp Web OTLP endpoint |
| `EVERYUP_WEB_API_KEY` | no | | Optional EveryUp Web API key for OTLP forward |
| `EVERYUP_WEB_SYNC_ENABLED` | no | `false` | Enable Web enrollment, service sync, and audit event sync |
| `EVERYUP_WEB_BASE_URL` | no | | EveryUp Web base URL |
| `EVERYUP_WEB_ENROLLMENT_TOKEN` | no | | Bearer token for Web enrollment/sync |
| `EVERYUP_WEB_AGENT_ID` | no | | Existing Agent ID to skip enrollment |
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

The agent generates a Collector config at `EVERYUP_OTEL_CONFIG_PATH`. Use
[compose.example.yml](compose.example.yml) to run the agent with an
`otel/opentelemetry-collector-contrib` sidecar.

See [OTel Collector Sidecar](docs/otel-collector.md) for details.

## Web connected mode

When `EVERYUP_WEB_SYNC_ENABLED=true`, the agent enrolls with EveryUp Web and
periodically sends discovered service mappings and audit events. Local
operation continues even when Web sync fails.

See [Web Connected Mode](docs/web-connected-mode.md) for the API contract.

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
