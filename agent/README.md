# EveryUp Agent

EveryUp Agent is the standalone sidecar that watches your Docker services and
host, then syncs their health, Docker stdout/stderr logs, events, and metrics to **EveryUp Web**. The agent
is a pure collector — all configuration that isn't about *collecting* (alert
rules, notification channels like Telegram, etc.) lives in the Web UI.

## Quick Start

**1. Create the agent in EveryUp Web**

In the Web dashboard go to the Services page → **추가하기 (Add)**, enter a name,
and copy the generated API key (`evup_svc_...`).

**2. Create `docker-compose.yml`**

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

**3. Create `.env`** and connect to Web:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://your-everyup-web:3001
EVERYUP_AGENT_API_KEY=evup_svc_...   # from step 1
```

**4. Add labels to the services you want monitored** (your existing `docker-compose.yml`)

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"              # ← that's it: up/down from the container's running state

  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"          # ← display name (defaults to the container name if omitted)
      everyup.health.url: "http://api:8080/health"   # ← optional: active HTTP probe
```

For a TCP-only service (postgres, redis, …):

```yaml
labels:
  everyup.enabled: "true"
  everyup.health.type: "tcp"
  everyup.health.port: "5432"
```

> **Only `everyup.enabled: "true"` is required.** With just that, the agent reports liveness (container running vs stopped) from Docker — no health endpoint needed. Add `everyup.health.url` (or `everyup.health.port`) to upgrade to active HTTP/TCP probing with response time and status codes. `everyup.service.name` is optional — defaults to the container name (a 12-char short ID if the container has no name).

**5. Run**

```bash
docker compose up -d
```

The agent auto-discovers any container with `everyup.enabled: "true"`, checks it
on the next 30-second tick, and appears online in Web within 30 seconds. **Each
discovered container is its own service card** (plus one for `EVERYUP_HEALTH_URL`
if set) — one agent commonly reports several services. When a container is
removed or relabeled, the agent stops reporting it and Web drops its card on the
next sync. Recreating a container (`docker compose up`) keeps the same card —
identity is a stable key (service name / compose service), not the container ID.
Notifications are sent by EveryUp Web based on the alert rules and channels you
configure there (Web UI → 알림).

It supports:

- Environment-based configuration
- HTTP and TCP health checks
- Docker label discovery for HTTP/TCP health targets
- Automatic Docker stdout/stderr log forwarding to EveryUp Web
- Container log-keyword and resource-threshold detection
- Host CPU, memory, and disk threshold detection
- Cooldown and recovery state tracking
- EveryUp Web enrollment, service health sync, host metrics sync, and event sync
- Generated OTel Collector sidecar config
- Optional external heartbeat ping for dead-man's-switch monitoring
- A standalone Docker image and compose example for sidecar deployment

## Run locally

```bash
cd agent
cp .env.example .env
go run ./cmd/everyup-agent
```

PowerShell example:

```powershell
$env:EVERYUP_WEB_SYNC_ENABLED="true"
$env:EVERYUP_WEB_BASE_URL="http://localhost:3001"
$env:EVERYUP_AGENT_API_KEY="evup_svc_..."
$env:EVERYUP_SERVICE_NAME="my-service"
$env:EVERYUP_HEALTH_URL="http://localhost:8080/health"
go run ./cmd/everyup-agent
```

## Environment

| Variable | Required | Default | Description |
|---|---:|---|---|
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Agent instance name |
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Name for the `EVERYUP_HEALTH_URL` target. Has no effect when using Docker label discovery only. |
| `EVERYUP_DATA_DIR` | no | `/data` | Local state and audit directory |
| `EVERYUP_HEALTH_URL` | no | | Single HTTP URL to monitor directly — **leave empty when using Docker label discovery.** Setting this creates an additional service card in the dashboard named after `EVERYUP_SERVICE_NAME`. |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Re-record cooldown for repeated failures |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers with EveryUp labels |
| `EVERYUP_DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Docker Engine socket path |
| `EVERYUP_DOCKER_LOGS_ENABLED` | no | `true` | Forward labeled containers' stdout/stderr logs to EveryUp Web through OTLP |
| `EVERYUP_DOCKER_LOGS_TAIL_LINES` | no | `100` | Max Docker log lines read per service on each check tick; capped at 1000 |
| `EVERYUP_OTEL_CONFIG_ENABLED` | no | `false` | Generate Collector config on startup (enable with otel-collector sidecar) |
| `EVERYUP_OTEL_CONFIG_PATH` | no | `/etc/everyup/generated/otel-config.yaml` | Generated Collector config path |
| `EVERYUP_OTEL_CONF_DIR` | no | `/etc/everyup/conf.d` | Reserved override directory |
| `EVERYUP_OTEL_FILELOG_PATHS` | no | Docker container logs | Comma-separated filelog include paths |
| `EVERYUP_WEB_OTLP_ENDPOINT` | no | | EveryUp Web OTLP endpoint for the generated collector to push logs/traces (authenticated with `EVERYUP_AGENT_API_KEY`) |
| `EVERYUP_WEB_SYNC_ENABLED` | no | `false` | Enable Web enrollment, service sync, host metrics sync, and event sync |
| `EVERYUP_WEB_BASE_URL` | no | | EveryUp Web base URL |
| `EVERYUP_AGENT_API_KEY` | no | | API key generated from the Web UI (Services → 추가하기) |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | no | `30` | Web service and event sync interval |
| `EVERYUP_HEARTBEAT_URL` | no | | Optional external heartbeat URL |
| `EVERYUP_HEARTBEAT_TOKEN` | no | | Optional bearer token for heartbeat requests |
| `EVERYUP_HEARTBEAT_INTERVAL_SECONDS` | no | `60` | Heartbeat ping interval |
| `EVERYUP_HOST_METRICS_ENABLED` | no | `true` | Enable host resource threshold checks |
| `EVERYUP_HOST_METRICS_ROOT` | no | `/hostfs` | Host filesystem root used for `/proc` reads |
| `EVERYUP_HOST_DISK_PATH` | no | `/hostfs` | Path used for disk usage threshold |
| `EVERYUP_HOST_CPU_PERCENT` | no | | Host CPU alert threshold |
| `EVERYUP_HOST_MEMORY_PERCENT` | no | | Host memory alert threshold |
| `EVERYUP_HOST_DISK_PERCENT` | no | | Host disk alert threshold |

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

### Logs and OTLP traces (same key)

Docker stdout/stderr logs are forwarded by the agent automatically for labeled containers when `EVERYUP_DOCKER_LOGS_ENABLED=true`.

For application traces and SDK-emitted logs, OTLP ingest uses the **same** `EVERYUP_AGENT_API_KEY`; there is no separate key. Point your app's OTLP exporter at `<EVERYUP_WEB_BASE_URL>/api/v1/otlp` with `Authorization: Bearer <EVERYUP_AGENT_API_KEY>`, and set the OTLP `service.name` to match an agent service's name so logs/requests line up under that card.

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

## Web connected mode

Connect the agent to your EveryUp Web instance so the browser dashboard shows
real-time service health, logs, and infrastructure metrics, and so Web can send
notifications based on its alert rules.

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

Health checks still run and audit events are still written locally even if the
Web connection is temporarily unavailable; they are flushed once it recovers.

See [Web Connected Mode](docs/web-connected-mode.md) for the full API contract.

## OTel Collector sidecar

> Forwards logs/traces to EveryUp Web's OTLP endpoint. Set
> `EVERYUP_WEB_OTLP_ENDPOINT`; the generated config authenticates with your
> `EVERYUP_AGENT_API_KEY` automatically (no separate key). Also usable with
> external OTLP backends.

The agent generates a Collector config at `EVERYUP_OTEL_CONFIG_PATH`. Use
[compose.example.yml](compose.example.yml) to run the agent with an
`otel/opentelemetry-collector-contrib` sidecar.

See [OTel Collector Sidecar](docs/otel-collector.md) for details.

## Heartbeat Watchdog

Set `EVERYUP_HEARTBEAT_URL` to ping an external dead-man's-switch service on a
fixed interval. This helps detect when the Agent host itself is down. If a token
is set, the request includes `Authorization: Bearer <token>`.

See [Heartbeat Watchdog](docs/heartbeat-watchdog.md) for details.

## Local state

The agent writes health state and audit events under `EVERYUP_DATA_DIR`.

- `agent-state.json`: target health state and last alert time
- `audit.jsonl`: startup, alert, and recovery audit events

Mount this directory as a persistent volume so cooldown/recovery state survives
container restarts.

See [Local State](docs/local-state.md) for file formats.

## Build

```bash
go build ./cmd/everyup-agent
docker build -t everyup-agent:dev .
```
