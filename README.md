<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  A self-hosted monitoring dashboard and lightweight Agent for Docker services.
</p>

<p align="center">
  <a href="README.ko.md">Korean</a> -
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> -
  <a href="#quick-start">Quick Start</a> -
  <a href="#compose-files">Compose Files</a> -
  <a href="#repository-layout">Repository Layout</a>
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

EveryUp helps you monitor Docker services on your own servers without setting up
a large observability stack.

It gives you:

- A Web dashboard for service health, logs, API requests, infrastructure, and alerts
- Automatic Docker container discovery from the Agent
- Docker stdout/stderr log collection without changing application code
- API request summaries parsed from stdout access logs
- Host CPU, memory, and disk monitoring
- Telegram, Discord, and Slack notifications configured in the Web UI

The default setup is intentionally simple: run Web, then add one Agent service to
the Docker Compose project on each server you want to monitor.

## Quick Start

EveryUp has two parts:

| Part | What it does | Where it runs |
| --- | --- | --- |
| Web | Dashboard, users, alert rules, notification channels, history | Your dashboard server |
| Agent | Docker discovery, container state, logs, API access-log parsing, host metrics | Each server you monitor |

Start Web first. After Web is running, create an Agent key in the dashboard and
add the Agent service to the Compose stack on the server you want to monitor.

### 1. Create the Web compose file

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

Start Web:

```bash
docker compose up -d
```

Open `http://localhost:3001` and create the first admin account. If Web is on a
remote server, open `http://WEB_SERVER_IP:3001` instead.

### 2. Create an Agent key in Web

In the Web dashboard, open **Services -> Add** and create an Agent entry. Copy the
API key shown after creation. It looks like this:

```text
evup_svc_...
```

This key belongs to the Agent. Your backend and frontend services do not need it.

### 3. Add the Agent service to the monitored server

On the server you want to monitor, add `everyup-agent` to that server's
`docker-compose.yml`. If the server already has an application Compose file, add
this service next to the existing services.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

Replace `EVERYUP_WEB_BASE_URL` with the Web URL reachable from this server, and
replace `EVERYUP_AGENT_API_KEY` with the key from step 2.

Start the Agent:

```bash
docker compose up -d everyup-agent
```

The Agent should appear online in Web within about 30 seconds. It automatically
finds Docker containers on the same Docker host. You do not need to add EveryUp
settings to each application service.

### 4. (Optional) Enable API request monitoring

Container health, logs, and host metrics work with steps 1–3 alone. To also see
per-request API data (method, path, status, duration), add **OpenTelemetry
auto-instrumentation** to the app you want to monitor and point it at the Agent's
telemetry gateway (`:4318`). Works on Linux/macOS/Windows, needs no API key in the
app (the Agent attaches its own), and captures metadata only — no bodies.

Add these environment variables to **your app service** (every language uses the same set):

```yaml
environment:
  OTEL_SERVICE_NAME: demo                              # must match the service name shown in EveryUp
  OTEL_EXPORTER_OTLP_ENDPOINT: http://everyup-agent:4318
  OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
  OTEL_TRACES_EXPORTER: otlp
  OTEL_METRICS_EXPORTER: none
  OTEL_LOGS_EXPORTER: none
```

Then enable auto-instrumentation per language (no application code):

#### Java — Spring Boot, Quarkus, Micronaut, …

1. Download the agent jar:
   ```bash
   curl -LO https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
   ```
2. Mount it and set the flag on the app service:
   ```yaml
   services:
     demo:
       environment:
         JAVA_TOOL_OPTIONS: "-javaagent:/otel/opentelemetry-javaagent.jar"
         # + the common env above
       volumes:
         - ./opentelemetry-javaagent.jar:/otel/opentelemetry-javaagent.jar:ro
   ```

#### Python — FastAPI, Django, Flask, …

1. Add to your image (Dockerfile / requirements):
   ```bash
   pip install opentelemetry-distro opentelemetry-exporter-otlp
   opentelemetry-bootstrap -a install
   ```
2. Start the app through the wrapper:
   ```yaml
   services:
     demo:
       command: ["opentelemetry-instrument", "python", "app.py"]   # or: opentelemetry-instrument uvicorn main:app --host 0.0.0.0
       environment:
         # the common env above
   ```

#### Node.js — Express, NestJS, Koa, Fastify, …

1. Add to your image:
   ```bash
   npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
   ```
2. Preload the register hook on the app service:
   ```yaml
   services:
     demo:
       environment:
         NODE_OPTIONS: "--require @opentelemetry/auto-instrumentations-node/register"
         # + the common env above
   ```

Finally, set `EVERYUP_API_CAPTURE_MODE=otlp` on the **Agent** so it stops parsing
stdout access logs into requests (otherwise the same request is counted twice).

More languages (Ruby, .NET, PHP, Go) and troubleshooting:
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md).

### Optional: download the compose templates

The same compose files are available in the repository if you prefer to download
instead of writing them manually:

```bash
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/agent/docker-compose.yml
```

## What You Get From Compose Only

With only the Agent service added, EveryUp can collect:

| Data | How it is collected |
| --- | --- |
| Container up/down | Docker socket |
| Container name, image, and state | Docker socket |
| Docker events | Docker socket |
| stdout/stderr logs | `docker logs` |
| API request summaries | Access-log lines found in stdout |
| Host CPU, memory, and disk | `/hostfs` mount |

This mode does not inspect application internals. It cannot see DB queries,
function names, or full trace trees unless the application is instrumented later.

## Logs And API Requests

Logs and API requests are collected from Docker stdout/stderr. Check what the
Agent can see with:

```bash
docker logs <container-name> --tail 100
```

Normal application logs shown there are stored as logs in Web.

API requests are created when stdout contains access-log lines with method, path,
status, and optionally duration. Supported examples:

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

If a service writes logs only to a file inside the container, Docker cannot show
those lines and EveryUp cannot collect them through the compose-only setup. Write
application logs or reverse-proxy access logs to stdout.

For per-request API data (method, path, status, duration), instrument the app with
OpenTelemetry — see [step 4 of the Quick Start](#4-optional-enable-api-request-monitoring).

## Networking Notes

The Agent can discover containers and read logs through the Docker socket even
when it runs from its own Compose file.

For the cleanest setup, put the `everyup-agent` service in the same Compose file
as the application stack on that server. If you keep it in a separate Compose
project, it can still collect Docker state and logs from the mounted Docker
socket.

## Compose Files

### Web only

Use this on the dashboard server:

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

### Agent only

Use this on each monitored server:

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

## Repository Layout

```text
.
  web/
    docker-compose.yml     # Web-only Compose file
    backend/               # Go API server, SQLite storage, telemetry ingest
    frontend/              # React dashboard
  agent/
    docker-compose.yml     # Agent-only Compose file
    internal/              # Agent implementation
  docker-compose.yml       # Web-only root convenience Compose file
```

## Development

Backend tests:

```bash
cd web/backend
go test ./...
```

Frontend build:

```bash
cd web/frontend
pnpm build
```

Agent tests:

```bash
cd agent
go test ./...
```