# Web Connected Mode

EveryUp Agent collects service health and host metrics; enabling Web sync lets
the Web dashboard display them in real time and send notifications based on its
alert rules. Web sync is the agent's primary purpose — without it the agent only
records checks to a local audit log.

If the Web connection fails temporarily, local checks and audit logging continue
and queued events are flushed once it recovers.

## Setup

### Step 1 — Create a service in the Web UI

1. Open the EveryUp Web dashboard
2. Click **추가하기** (Add) in the top-right of the Services page
3. Enter a name for this agent (e.g. `prod-server`)
4. Copy the generated API key — it looks like `evup_svc_a1b2c3...`

> The key is shown only once. Save it now; there is no way to retrieve it later.

### Step 2 — Configure the agent

Add these three variables to your agent's `.env`:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://your-everyup-web:3001   # URL of your Web instance
EVERYUP_AGENT_API_KEY=evup_svc_a1b2c3...            # key from Step 1
```

### Step 3 — Restart the agent

```bash
docker compose restart everyup-agent
```

The agent enrolls automatically on startup. Within 30 seconds, the service
appears as "online" in the Web dashboard.

## Configuration reference

| Variable | Default | Description |
|---|---|---|
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Enable Web enrollment and sync |
| `EVERYUP_WEB_BASE_URL` | — | URL of your EveryUp Web instance |
| `EVERYUP_AGENT_API_KEY` | — | API key generated from the Web UI |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | `30` | How often to push service state and events |

## API contract

Enrollment — called automatically on agent startup:

```http
POST /api/v1/agents/enroll
Authorization: Bearer <EVERYUP_AGENT_API_KEY>
Content-Type: application/json

{
  "agentName": "everyup-agent",
  "mode": "standalone",
  "version": "dev"
}
```

Response:

```json
{ "agentId": "agent_abc123" }
```

The agent stores `agentId` in memory and uses it for all subsequent sync calls.
The API key authenticates every request; the agent does not need to store it
between restarts because it re-enrolls on each startup.

Audit event sync:

```http
POST /api/v1/agents/{agentId}/events
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "agentId": "agent_123",
  "events": [
    {
      "time": "2026-06-18T00:00:00Z",
      "type": "agent_started",
      "message": "Agent everyup-agent is running."
    }
  ]
}
```

Host metrics sync — pushed periodically when `EVERYUP_HOST_METRICS_ENABLED` is on:

```http
POST /api/v1/agents/{agentId}/metrics
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "agentId": "agent_123",
  "cpuUsage": 12.5,
  "memTotal": 16.0,
  "memUsed": 6.4,
  "memUsage": 40.0,
  "diskTotal": 512.0,
  "diskUsed": 210.0,
  "diskUsage": 41.0,
  "recordedAt": "2026-06-18T00:00:00Z"
}
```

These feed the per-agent infrastructure view in the dashboard.

## Service mapping

Service mapping is discovery-driven locally (Docker labels, plus the optional
`EVERYUP_HEALTH_URL` target) and periodically synced to Web:

```http
POST /api/v1/agents/{agentId}/services
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "agentId": "agent_123",
  "agentName": "everyup-agent",
  "observedAt": "2026-06-18T00:00:00Z",
  "services": [
    {
      "key": "container_abc",
      "name": "api",
      "checkType": "http",
      "endpoint": "http://api:8080/health",
      "healthy": true,
      "seen": true,
      "silenced": false,
      "lastStatus": 200,
      "lastLatency": "12ms",
      "updatedAt": "2026-06-18T00:00:00Z"
    }
  ]
}
```

Mapping rules:

- `everyup.service.name` is the primary human-readable service name.
- The local target key is a stable identity (`everyup.service.name` → compose
  `project:service` → container name → container ID), so it survives container
  recreation; the container ID is only the Docker API handle for logs/stats.
- Web can map services to Agent targets by `name`, `key`, or future explicit
  labels.

## Logs & API requests (OTLP)

Logs and API-request (trace) data are **not** collected by the agent — your
application sends them over OTLP. They authenticate with the **same project key**
(`EVERYUP_AGENT_API_KEY`, `evup_svc_…`); there is no separate "log key".

Point your app's OTLP/HTTP exporter (or an OpenTelemetry Collector) at the Web
instance:

```
<EVERYUP_WEB_BASE_URL>/api/v1/otlp/v1/logs     # logs
<EVERYUP_WEB_BASE_URL>/api/v1/otlp/v1/traces   # spans → API requests
Authorization: Bearer <EVERYUP_AGENT_API_KEY>
```

For logs/requests to appear under a service on the dashboard, set the OTLP
`service.name` resource attribute to **exactly** match that agent service's name
(e.g. `OTEL_SERVICE_NAME=kdns-mini`). Telemetry whose `service.name` matches no
agent service is still stored, but is not shown under a card until a service with
that name exists. Data is tied to the project by `(agent_id, service.name)`.

> Optionally, the agent can generate an OpenTelemetry Collector config that does
> this for you — set `EVERYUP_OTEL_CONFIG_ENABLED=true` plus
> `EVERYUP_WEB_OTLP_ENDPOINT` and run the generated collector.

## Failure behavior

The agent keeps a bounded in-memory event queue. Failed sync attempts are retried
on the next interval. Local `audit.jsonl` remains the source of truth while Web
is unavailable.

## Web read APIs

EveryUp Web exposes JWT-protected read APIs for the dashboard:

```http
GET /api/v1/agents
GET /api/v1/agents/{agentId}/services
GET /api/v1/agents/{agentId}/events?limit=100
```
