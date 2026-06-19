# Approved Actions

EveryUp Agent supports approved actions through a two-step ChatOps flow. Actions
are disabled by default.

## Configuration

```bash
EVERYUP_ACTIONS_ENABLED=false
EVERYUP_ACTION_DRY_RUN=true
EVERYUP_ACTION_ALLOWLIST=restart
EVERYUP_ACTION_CONFIRM_TTL_SECONDS=300
```

| Variable | Default | Description |
|---|---|---|
| `EVERYUP_ACTIONS_ENABLED` | `false` | Enables action requests |
| `EVERYUP_ACTION_DRY_RUN` | `true` | Confirms actions without executing them |
| `EVERYUP_ACTION_ALLOWLIST` | empty | Comma-separated action allowlist, for example `restart` |
| `EVERYUP_ACTION_CONFIRM_TTL_SECONDS` | `300` | Confirmation token lifetime |

## Restart flow

```text
/restart api
```

The agent creates a pending action and returns a token.

```text
/confirm ab12cd34
```

If the token is still pending and not expired, the agent confirms the action.
When `EVERYUP_ACTION_DRY_RUN=true`, no container is restarted. When dry-run is
disabled, the agent calls Docker's container restart API for the discovered
container.

```text
/actions
```

Lists pending actions.

## Safety

- Actions are disabled by default.
- `restart` must be explicitly listed in `EVERYUP_ACTION_ALLOWLIST`.
- Confirmation tokens expire.
- Every request and confirmation is recorded in `audit.jsonl`.
- `/restart` only works for services discovered from Docker labels.
