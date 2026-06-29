# EveryUp Agent

EveryUp Agent is the lightweight collector that runs on a server you want to
monitor. It discovers Docker containers automatically, reads stdout/stderr logs,
collects host metrics, and syncs everything to EveryUp Web. API request
collection is handled by the Agent image running in proxy mode, not by stdout
access-log parsing.

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
- Host CPU, memory, disk, and network metrics

Your application containers do not need the EveryUp Web URL or Agent API key.

## Logs And API Requests

The Agent reads Docker stdout/stderr and stores those lines as logs in Web. Check
what it can see with:

```bash
docker logs <container-name> --tail 100
```

API request records are not derived from stdout access logs anymore. Put the
EveryUp Agent image in `proxy` mode in front of the app when you want request
metadata, and enable body capture there when the route/status/latency policy
allows it.

```yaml
services:
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
| `EVERYUP_AGENT_MODE` | no | `agent` | Runtime mode: `agent` for host/container telemetry, `proxy` for inline API collection |
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Agent instance name |
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Default service name for the agent's own checks |
| `EVERYUP_DATA_DIR` | no | `/data` | Where agent state (`agent-state.json`, `audit.jsonl`) is stored |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Minimum seconds between repeat alerts for the same target |
| `EVERYUP_HEALTH_URL` | no | | Absolute URL to health-check (single-target mode; usually Docker discovery is used instead) |

**Proxy mode**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_AGENT_MODE` | yes | `agent` | Set to `proxy` to run the inline API proxy |
| `EVERYUP_PROXY_LISTEN_ADDR` | no | `:8080` | Address the proxy listens on |
| `EVERYUP_PROXY_UPSTREAM_URL` | yes | | Absolute backend URL that receives proxied traffic |
| `EVERYUP_PROXY_SERVICE_NAME` | no | `EVERYUP_SERVICE_NAME` | Service name used on proxy-generated spans |
| `EVERYUP_PROXY_OTLP_ENDPOINT` | no | `http://everyup-agent:4318` | OTLP/HTTP endpoint that receives proxy spans |
| `EVERYUP_CAPTURE_ENABLED` | no | `false` | Enables request/response body events; API metadata spans are still sent |
| `EVERYUP_CAPTURE_ROUTES` | yes for body capture | | Comma-separated route allowlist such as `/api/...`; empty captures no bodies |
| `EVERYUP_CAPTURE_EXCLUDE_ROUTES` | no | `/login,/auth,/payment,/upload` | Routes excluded from body capture |
| `EVERYUP_CAPTURE_MAX_BODY_BYTES` | no | `8192` | Max bytes copied from each request/response body |
| `EVERYUP_CAPTURE_ON_STATUS` | no | `400-599` | Status codes that keep captured body events |
| `EVERYUP_CAPTURE_ON_SLOW_MS` | no | `3000` | Latency threshold that keeps captured body events |
| `EVERYUP_CAPTURE_MASK_KEYS` | no | `password,token,secret,authorization,cookie,set-cookie` | JSON keys masked before export |
| `EVERYUP_CAPTURE_REGEX_PRESET` | no | `rrn,phone,email,card` | Regex masking presets applied to copied body text |

Captured body events are exported as masked span events. The Web backend hides
those event bodies from non-admin users, audits admin views, and removes
body-bearing spans after `EVERYUP_RETENTION_BODYCAPTUREDAYS` days (default 7).

**Docker discovery & logs**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers automatically |
| `EVERYUP_DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Docker socket path inside the container |
| `EVERYUP_DOCKER_LOGS_ENABLED` | no | `true` | Forward containers' stdout/stderr logs to Web |
| `EVERYUP_DOCKER_LOGS_TAIL_LINES` | no | `100` | Max Docker log lines read per service on each check tick |
| `EVERYUP_EXCLUDE` | no | | Comma-separated container names to exclude from discovery |

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