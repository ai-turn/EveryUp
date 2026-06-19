# Web Connected Mode

EveryUp Agent can run standalone, but Phase 8 introduces a connection contract
for EveryUp Web.

This is intentionally optional. If Web sync fails, local checks, Telegram
alerts, ChatOps, and local audit logs continue to work.

## Configuration

```bash
EVERYUP_WEB_SYNC_ENABLED=false
EVERYUP_WEB_BASE_URL=https://everyup.example.com
EVERYUP_WEB_ENROLLMENT_TOKEN=everyup_enroll_...
EVERYUP_WEB_AGENT_ID=
EVERYUP_WEB_SYNC_INTERVAL_SECONDS=30
```

| Variable | Default | Description |
|---|---|---|
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Enables enrollment, service sync, and audit event sync |
| `EVERYUP_WEB_BASE_URL` | empty | EveryUp Web base URL |
| `EVERYUP_WEB_ENROLLMENT_TOKEN` | empty | Bearer token used for enrollment and event sync |
| `EVERYUP_WEB_AGENT_ID` | empty | Optional existing agent ID to skip enrollment |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | `30` | Service and audit sync interval |

## API contract

On EveryUp Web, set the same token as:

```bash
EVERYUP_AGENT_ENROLLMENT_TOKEN=everyup_enroll_...
```

Enrollment:

```http
POST /api/v1/agents/enroll
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "agentName": "everyup-agent",
  "mode": "standalone",
  "version": "dev"
}
```

Expected response:

```json
{
  "agentId": "agent_123"
}
```

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

## Service mapping

Service mapping is label-driven locally and periodically synced to Web:

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

- `everyup.service.name` is the primary human-readable service key.
- Docker container ID is used as the local target key.
- Web can map services to Agent targets by `name`, `key`, or future explicit
  labels.

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
