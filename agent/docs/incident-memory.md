# Incident Memory

EveryUp Agent can store local incident and command history in SQLite. This
memory is used to compare recurring incidents and draft postmortem notes without
requiring EveryUp Web.

## Configuration

```bash
EVERYUP_MEMORY_ENABLED=true
EVERYUP_MEMORY_PATH=/data/incident-memory.db
```

| Variable | Default | Description |
|---|---|---|
| `EVERYUP_MEMORY_ENABLED` | `true` | Enables SQLite incident memory |
| `EVERYUP_MEMORY_PATH` | `/data/incident-memory.db` | SQLite database path |

## Schema

`incidents`:

- `started_at`
- `resolved_at`
- `service_name`
- `target_key`
- `severity`
- `status`
- `message`
- `fingerprint`
- `metadata_json`

`command_history`:

- `time`
- `chat_id`
- `command`
- `message`

## Recorded Events

- `alert_sent` creates an open incident.
- `recovery_sent` resolves the latest open incident for the target.
- `chatops_command` stores accepted command history.

## ChatOps

`/memory <service>` searches recent incidents by service, target key,
fingerprint, and message tokens.

`/postmortem <service>` drafts a lightweight postmortem from the latest recorded
incident and similar history.

## Safety

Memory writes are best-effort. If SQLite is unavailable, local monitoring,
alerts, ChatOps, OTel, and Web sync continue to run.
