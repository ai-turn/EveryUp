# Telegram ChatOps

EveryUp Agent supports read-only Telegram ChatOps through Telegram
`getUpdates` long polling.

## Configuration

```bash
EVERYUP_CHATOPS_ENABLED=true
EVERYUP_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
EVERYUP_TELEGRAM_CHAT_IDS=123456789,-100123456789
```

`EVERYUP_TELEGRAM_CHAT_IDS` is both the outbound notification list and the
ChatOps allowlist. Messages from any other chat ID are ignored.

## Commands

| Command | Description |
|---|---|
| `/status` | Show aggregate service health counts |
| `/services` | List discovered services and latest known state |
| `/logs <service> [lines]` | Show recent Docker logs for a discovered container |
| `/explain <service>` | Explain the latest state for a service; uses LLM when configured |
| `/memory <service>` | Show similar incidents from local SQLite memory |
| `/postmortem <service>` | Draft a postmortem from the latest recorded incident |
| `/silence <service> <duration> [reason]` | Suppress alerts for a service temporarily |
| `/restart <service>` | Request an approved restart action |
| `/confirm <token>` | Confirm a pending action |
| `/actions` | List pending actions |
| `/help` | Show supported commands |

The first ChatOps milestone intentionally starts with read-only commands.
`/silence` changes alert state, so the agent records it in `audit.jsonl` and
caps duration at 7 days. Use durations accepted by Go such as `10m`, `1h`, or
`2h30m`.

`/logs` only works for services discovered from Docker labels. It uses Docker's
container logs API through the mounted Docker socket and caps the requested line
count at 200.

`/memory` and `/postmortem` require `EVERYUP_MEMORY_ENABLED=true`. They read the
local SQLite database at `EVERYUP_MEMORY_PATH`; no Web connection is required.

## Audit

Accepted commands are appended to `audit.jsonl` as `chatops_command` events.
Log reads are recorded as `chatops_logs_read`, and silence creation is logged as
`silence_created`. Action requests and confirmations are recorded as
`action_requested` and `action_confirmed`. Accepted command responses are also
stored in SQLite command history when incident memory is enabled. Rejected chat
IDs are logged locally but do not receive a response.
