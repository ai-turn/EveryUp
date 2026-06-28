# EveryUp Agent

EveryUp Agent is the lightweight collector that runs on a server you want to
monitor. It discovers Docker containers automatically, reads stdout/stderr logs,
parses access-log lines into API request summaries, collects host metrics, and
syncs everything to EveryUp Web.

Alert rules, notification channels, and dashboard behavior are configured in Web.
The Agent only collects and forwards data.

## Quick Start

Add one `everyup-agent` service to the Docker Compose file on the server you want
to monitor. You do not need to add EveryUp settings to each application service.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
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
docker compose up -d everyup-agent
```

The Agent should appear online in Web within about 30 seconds.

## What Works Without App Changes

With only the Agent service running, EveryUp can collect:

- Container running/stopped state
- Docker events
- Docker stdout/stderr logs
- API request summaries parsed from stdout access logs
- Host CPU, memory, disk, and network metrics

Your application containers do not need the EveryUp Web URL or Agent API key.

## Logs And API Requests

The Agent reads Docker stdout/stderr. Check what it can see with:

```bash
docker logs <container-name> --tail 100
```

Normal application logs shown there are stored as logs in Web.

API request records are created when stdout contains access-log lines with method,
path, status, and optionally duration:

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

If logs are written only to files inside the container, Docker cannot show them
and the Agent cannot collect them in compose-only mode. Configure the application
or reverse proxy to write logs to stdout.

## Networking Notes

The Agent discovers containers through the mounted Docker socket. It can run in
the same Compose file as your application or in a separate Compose project on the
same Docker host.

## Compose Settings

Only the three `yes` rows are required; everything else has a working default.

**Web connection (connected mode)**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | yes | `false` | Enables Web enrollment and sync |
| `EVERYUP_WEB_BASE_URL` | yes | | EveryUp Web base URL reachable from the Agent host |
| `EVERYUP_AGENT_API_KEY` | yes | | API key generated in Web from Services -> Add (deprecated alias: `EVERYUP_WEB_ENROLLMENT_TOKEN`) |
| `EVERYUP_WEB_AGENT_ID` | no | | Web-side agent id; set automatically on enrollment |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | no | `30` | How often services, events, and host metrics sync to Web |
| `EVERYUP_WEB_OTLP_ENDPOINT` | no | | OTLP endpoint advertised for telemetry push |

**General**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Agent instance name |
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Default service name for the agent's own checks |
| `EVERYUP_DATA_DIR` | no | `/data` | Where agent state (`agent-state.json`, `audit.jsonl`) is stored |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Minimum seconds between repeat alerts for the same target |
| `EVERYUP_HEALTH_URL` | no | | Absolute URL to health-check (single-target mode; usually Docker discovery is used instead) |

**Docker discovery & logs**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers automatically |
| `EVERYUP_DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Docker socket path inside the container |
| `EVERYUP_DOCKER_LOGS_ENABLED` | no | `true` | Forward containers' stdout/stderr logs to Web |
| `EVERYUP_DOCKER_LOGS_TAIL_LINES` | no | `100` | Max Docker log lines read per service on each check tick |
| `EVERYUP_EXCLUDE` | no | | Comma-separated container names to exclude from discovery |
| `EVERYUP_API_CAPTURE_MODE` | no | `accesslog` | API request source: `accesslog` (parse stdout), `otlp` (app sends via OpenTelemetry), or `off` |

**Host metrics (CPU / memory / disk / network)**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_HOST_METRICS_ENABLED` | no | `true` | Collect host CPU/memory/disk/network from the `/hostfs` mount |
| `EVERYUP_HOST_METRICS_ROOT` | no | `/hostfs` | Mount point of the host filesystem (reads `/proc`, `/proc/net/dev`) |
| `EVERYUP_HOST_DISK_PATH` | no | `/hostfs` | Path used for disk usage stats |
| `EVERYUP_HOST_CPU_PERCENT` | no | `0` | Host CPU% **alert** threshold; `0` disables host-resource alerting (does not affect collection) |
| `EVERYUP_HOST_MEMORY_PERCENT` | no | `0` | Host memory% alert threshold; `0` disables |
| `EVERYUP_HOST_DISK_PERCENT` | no | `0` | Host disk% alert threshold; `0` disables |

**OTel collector & telemetry gateway**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_OTEL_CONFIG_ENABLED` | no | `false` | Generate an OTel collector config on startup |
| `EVERYUP_OTEL_CONFIG_PATH` | no | `/etc/everyup/generated/otel-config.yaml` | Where the generated OTel config is written |
| `EVERYUP_OTEL_CONF_DIR` | no | `/etc/everyup/conf.d` | Directory scanned for OTel config fragments |
| `EVERYUP_OTEL_FILELOG_PATHS` | no | | Comma-separated file paths for the OTel filelog receiver |
| `EVERYUP_TELEMETRY_GATEWAY_ENABLED` | no | `true` | Run the in-agent OTLP gateway that forwards telemetry to Web |
| `EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR` | no | `:4318` | Listen address for the in-agent OTLP gateway |

**Heartbeat watchdog**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_HEARTBEAT_URL` | no | | External heartbeat (dead-man's switch) URL to ping |
| `EVERYUP_HEARTBEAT_TOKEN` | no | | Token sent with the heartbeat ping |
| `EVERYUP_HEARTBEAT_INTERVAL_SECONDS` | no | `60` | Heartbeat ping interval |

## Local Development

```bash
cd agent
go run ./cmd/everyup-agent
```

For local development, pass the same values shown above through your shell or IDE
run configuration.

## Related Docs

- [Docker Socket Proxy](docs/docker-socket-proxy.md)
- [Web Connected Mode](docs/web-connected-mode.md)
- [Heartbeat Watchdog](docs/heartbeat-watchdog.md)
- [Local State](docs/local-state.md)