# EveryUp Agent

EveryUp Agent is the lightweight collector that runs on a server you want to
monitor. It discovers Docker containers, checks service health, reads
stdout/stderr logs, collects host metrics, and syncs everything to EveryUp Web.

Alert rules, notification channels, and dashboard behavior are configured in Web.
The Agent only collects and forwards data.

## Quick Start

Use Docker Compose and configure the Agent directly in `docker-compose.yml`.
You do not need to add EveryUp settings to your existing backend or frontend
services.

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

Create the API key in EveryUp Web from **Services -> Add**, replace
`EVERYUP_AGENT_API_KEY`, then start the Agent:

```bash
docker compose up -d
```

The Agent should appear online in Web within about 30 seconds.

## What Works Without App Changes

With only the Agent container running, EveryUp can collect:

- Docker container running/stopped state
- Docker events
- Docker stdout/stderr logs for labeled containers
- Host CPU, memory, and disk metrics

Your application containers do not need the EveryUp Web URL or Agent API key.

## Docker Discovery

Add labels to services you want monitored.

Basic liveness and logs:

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "worker"
```

HTTP health check:

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.url: "http://api:8080/health"
```

TCP health check:

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

The Agent can discover containers and read logs through the Docker socket even
when it runs from its own Compose file.

Active HTTP checks need network access from the Agent to the target service. A
URL like `http://api:8080/health` works only when the Agent can resolve `api` on
the same Docker network. If the Agent runs separately, use a reachable host/IP URL
or attach the Agent to the application's Docker network.

## OTLP Gateway

Applications that already emit OpenTelemetry can send traces or SDK logs to the
Agent gateway:

```text
OTLP endpoint: http://everyup-agent:4318
Protocol: http/protobuf
Paths: /v1/logs and /v1/traces
```

The application still does not need the EveryUp Web URL or API key. The Agent
owns those values and forwards telemetry to Web.

## Compose Settings

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | yes | `false` | Enables Web enrollment and sync |
| `EVERYUP_WEB_BASE_URL` | yes | | EveryUp Web base URL reachable from the Agent host |
| `EVERYUP_AGENT_API_KEY` | yes | | API key generated in Web from Services -> Add |
| `EVERYUP_TELEMETRY_GATEWAY_ENABLED` | no | `true` | Enables the local OTLP/HTTP gateway |
| `EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR` | no | `:4318` | Local OTLP/HTTP gateway listen address |
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Agent instance name |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers with EveryUp labels |
| `EVERYUP_DOCKER_LOGS_ENABLED` | no | `true` | Forward labeled containers' stdout/stderr logs to Web |
| `EVERYUP_DOCKER_LOGS_TAIL_LINES` | no | `100` | Max Docker log lines read per service on each check tick |
| `EVERYUP_HOST_METRICS_ENABLED` | no | `true` | Enable host resource checks |

## Local Development

```bash
cd agent
go run ./cmd/everyup-agent
```

For local development, pass the same values shown above through your shell or IDE
run configuration.

## Related Docs

- [Docker Label Discovery](docs/docker-labels.md)
- [Docker Socket Proxy](docs/docker-socket-proxy.md)
- [Web Connected Mode](docs/web-connected-mode.md)
- [Heartbeat Watchdog](docs/heartbeat-watchdog.md)
- [Local State](docs/local-state.md)