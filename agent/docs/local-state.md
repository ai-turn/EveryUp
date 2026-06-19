# Local State

EveryUp Agent stores local state under `EVERYUP_DATA_DIR` so alert behavior
survives container restarts.

## Files

| File | Format | Purpose |
|---|---|---|
| `agent-state.json` | JSON | Target health state, last alert timestamps, and silence records |
| `audit.jsonl` | JSON Lines | Startup, alert, recovery, suppressed-alert, and send-failure events |
| `incident-memory.db` | SQLite | Incident history, recovery state, and accepted ChatOps command history |

## `agent-state.json`

The state file is written through a temporary file and replace step. It is safe
to back up while the agent is running, though a very recent check may not yet be
reflected in the backup.

Example:

```json
{
  "version": 1,
  "targets": {
    "env:api": {
      "lastAlertAt": "2026-06-18T00:00:00Z",
      "wasHealthy": false,
      "seenResult": true,
      "updatedAt": "2026-06-18T00:00:30Z"
    }
  },
  "silences": {
    "env:api": {
      "until": "2026-06-18T01:00:00Z",
      "reason": "maintenance",
      "createdAt": "2026-06-18T00:00:00Z"
    }
  },
  "actions": {
    "ab12cd34": {
      "token": "ab12cd34",
      "type": "restart",
      "serviceKey": "container-id",
      "serviceName": "api",
      "status": "pending",
      "dryRun": true,
      "createdAt": "2026-06-18T00:00:00Z",
      "expiresAt": "2026-06-18T00:05:00Z"
    }
  }
}
```

Silence records are written by Telegram ChatOps `/silence`. Expired silence
records are ignored and removed during alert evaluation.
Pending actions are written by `/restart` and updated by `/confirm`.

## `audit.jsonl`

Each line is one event. This keeps appends simple and makes the file easy to
ship into EveryUp Web later.

Example:

```jsonl
{"time":"2026-06-18T00:00:00Z","type":"agent_started","serviceName":"api","message":"Agent everyup-agent is running."}
{"time":"2026-06-18T00:01:00Z","type":"alert_sent","serviceName":"api","targetKey":"env:api","message":"http://api:8080/health failed: connection refused"}
```

Mount `EVERYUP_DATA_DIR` as a persistent volume in Docker Compose.

## `incident-memory.db`

When `EVERYUP_MEMORY_ENABLED=true`, the agent creates a SQLite database at
`EVERYUP_MEMORY_PATH`. The default path is `/data/incident-memory.db`.

Tables:

- `incidents`: alert start time, optional recovery time, service name, target key,
  status, message, fingerprint, and metadata.
- `command_history`: accepted ChatOps command, chat ID, response, and timestamp.

The database backs `/memory <service>` and `/postmortem <service>`.
