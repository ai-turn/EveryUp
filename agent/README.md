# EveryUp Agent

EveryUp Agent is the lightweight collector that runs on a server you want to
monitor. It discovers Docker containers automatically, reads stdout/stderr logs,
collects host metrics, and syncs everything to EveryUp Web. API status codes are
derived by parsing access-log lines out of the logs it already collects — no
proxy, no app changes. Request/response headers and bodies are an optional Tier 2
feature delivered by app-side OpenTelemetry instrumentation.

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
- API status codes (method, path, status) parsed from access logs
- Host CPU, memory, disk, and network metrics

Your application containers do not need the EveryUp Web URL or Agent API key.

## Logs And API Requests

The Agent reads Docker stdout/stderr and stores those lines as logs in Web. Check
what it can see with:

```bash
docker logs <container-name> --tail 100
```

API status codes are extracted from those same logs: lines that parse as access
logs (Nginx / Apache / structured JSON) are emitted as synthetic OTel SERVER
spans, which Web projects into the **API** tab. There is no latency in access
logs, so duration is unknown; an app that emits no access logs simply shows no
API rows while logs and metrics keep flowing.

For real latency without touching your apps, enable the eBPF sidecar (below).
For request/response **headers and bodies**, instrument the app with
OpenTelemetry pointed at the Agent's OTLP gateway (`http://everyup-agent:4318`).
See [docs/OTEL_API_INSTRUMENTATION.md](../docs/OTEL_API_INSTRUMENTATION.md).

If logs are written only to files inside the container, Docker cannot show them
and the Agent cannot collect them in compose-only mode. Configure the application
or reverse proxy to write logs to stdout.

## Zero-Code Tracing (eBPF, Optional)

The compose file ships a commented `everyup-ebpf` service
([Grafana Beyla](https://grafana.com/oss/beyla-ebpf/)). Uncomment it, set
`BEYLA_OPEN_PORT` to the ports your apps listen on, and `docker compose up -d`
— no app changes, no restarts of your services. It captures real SERVER spans
(method, path, status, **latency**) for every listening process, all languages
including Go, HTTPS included.

How it fits together: Beyla sends spans to the Agent's OTLP gateway, tagged
`everyup.source=ebpf`. The Agent maps each span to a service by the
instrumented process's PID (via Docker) and renames it accordingly; spans it
cannot match — `docker-proxy`, host processes, the sidecar itself — are dropped
so they never appear as phantom services. Services covered by real spans stop
receiving synthetic access-log spans automatically (no double counting).

Notes:

- Requires a Linux kernel 5.8+ with BTF (`/sys/kernel/btf/vmlinux` exists).
  Docker Desktop's VM qualifies.
- `privileged` + `pid: host` are inherent to eBPF instrumentation — the sidecar
  reads process memory to trace requests. Skip this block if that is not
  acceptable for your host; everything else keeps working.
- eBPF sees sizes only, never payloads: headers and bodies still require
  app-side OpenTelemetry (see above).
- A service freshly (re)started may drop its first seconds of spans until the
  Agent's next PID refresh (one check interval).

## App Instrumentation (Headers/Bodies, One Restart)

eBPF (above) needs zero changes but only sees method/path/status/latency. For
**headers and bodies** the app itself must be instrumented — still no code or
Dockerfile changes, just env vars and one restart:

1. In the agent compose, uncomment the `everyup-instrumentation` volume (two
   marked lines) and `docker compose up -d`. The agent fills the volume with
   the OTel Java agent and a Node.js bundle.
2. Add an override next to **your app's** compose file and restart once:

```yaml
# docker-compose.everyup.yml — docker compose -f compose.yml -f docker-compose.everyup.yml up -d
volumes:
  everyup-instrumentation:
    external: true

services:
  your-java-api:
    volumes: ["everyup-instrumentation:/everyup:ro"]
    environment:
      JAVA_TOOL_OPTIONS: "-javaagent:/everyup/java/opentelemetry-javaagent.jar"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://everyup-agent:4318"
      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf"
      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS: "content-type,user-agent,accept"
      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS: "content-type"

  your-node-api:
    volumes: ["everyup-instrumentation:/everyup:ro"]
    environment:
      NODE_OPTIONS: "--require /everyup/node/register.js"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://everyup-agent:4318"
      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf"
      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST: "content-type,user-agent,accept"
      # Bodies (opt-in): masked and truncated inside the app before export.
      # EVERYUP_CAPTURE_BODIES: "true"
      # EVERYUP_BODY_MAX_BYTES: "8192"
```

Notes:

- The agent's telemetry gateway attributes spans to the right service
  automatically; sensitive headers (authorization, cookie, ...) are masked at
  ingest regardless of what you list.
- Body capture (`EVERYUP_CAPTURE_BODIES`) is Node-only today and masks the
  fields in `EVERYUP_MASKED_BODY_FIELDS` (password, token, ... by default)
  before anything leaves the app. Viewing bodies in the web UI is admin-only
  and audited.
- The app and agent must share a Docker network for `everyup-agent:4318` to
  resolve, or point the endpoint at a published gateway port instead.
- The override **sets** `JAVA_TOOL_OPTIONS` / `NODE_OPTIONS`. If your app
  already uses either variable, append the EveryUp flags to the existing value
  instead of replacing it.
- Java/Node versions: JVM 8+, Node 18+.

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
| `TZ` | no | `UTC` | Timezone for the agent's own log lines (e.g. `Asia/Seoul`); synced data always carries zone info regardless |
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Agent instance name |
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Default service name for the agent's own checks |
| `EVERYUP_DATA_DIR` | no | `/data` | Where agent state (`agent-state.json`, `audit.jsonl`) is stored |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Minimum seconds between repeat alerts for the same target |
| `EVERYUP_HEALTH_URL` | no | | Absolute URL to health-check (single-target mode; usually Docker discovery is used instead) |

Captured body events (delivered by app-side OpenTelemetry) are stored as span
events. The Web backend hides those bodies from non-admin users, audits admin
views, and removes body-bearing spans after `EVERYUP_RETENTION_BODYCAPTUREDAYS`
days (default 7).

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