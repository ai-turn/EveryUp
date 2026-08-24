# Heartbeat Watchdog

The EveryUp Docker collector can ping an external heartbeat URL so a separate
service can notice when the Docker host is down.

This is a lightweight dead-man's-switch integration, not a full central
watchdog. The Docker collector sends the heartbeat while it is alive; the
external service owns timeout detection and escalation.

## Configuration

```bash
EVERYUP_HEARTBEAT_URL=https://watchdog.example.com/ping/agent-123
EVERYUP_HEARTBEAT_TOKEN=
EVERYUP_HEARTBEAT_INTERVAL_SECONDS=60
```

| Variable | Default | Description |
|---|---|---|
| `EVERYUP_HEARTBEAT_URL` | empty | Enables heartbeat ping when set |
| `EVERYUP_HEARTBEAT_TOKEN` | empty | Optional bearer token |
| `EVERYUP_HEARTBEAT_INTERVAL_SECONDS` | `60` | Ping interval |

## Request

```http
GET <EVERYUP_HEARTBEAT_URL>
Authorization: Bearer <token>
```

The `Authorization` header is only sent when `EVERYUP_HEARTBEAT_TOKEN` is set.
Any non-2xx response is treated as a heartbeat failure and written to the local
audit log.

## Failure Behavior

Heartbeat failures do not stop local monitoring, Web sync, or OTel forwarding.
They are logged as `heartbeat_failed` audit events.
