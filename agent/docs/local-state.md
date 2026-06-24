# Local State

EveryUp Agent stores local state under `EVERYUP_DATA_DIR` so alert behavior
survives container restarts.

## Files

| File | Format | Purpose |
|---|---|---|
| `agent-state.json` | JSON | Target health state and last alert timestamps |
| `audit.jsonl` | JSON Lines | Startup, alert, and recovery events |

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
  }
}
```

## `audit.jsonl`

Each line is one event. This keeps appends simple and makes the file easy to
ship into EveryUp Web. Events are flushed to Web over the connected-mode sync.

Example:

```jsonl
{"time":"2026-06-18T00:00:00Z","type":"agent_started","serviceName":"api","message":"Agent everyup-agent is running."}
{"time":"2026-06-18T00:01:00Z","type":"alert_sent","serviceName":"api","targetKey":"env:api","message":"http://api:8080/health failed: connection refused"}
```

Mount `EVERYUP_DATA_DIR` as a persistent volume in Docker Compose.
