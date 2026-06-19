# Runbooks

EveryUp Agent uses Markdown runbooks to attach consistent response steps to
alerts and `/explain` output. Built-in runbooks are embedded in the binary, and
custom `.md` files can be mounted through `EVERYUP_RUNBOOK_DIR`.

## Configuration

```bash
EVERYUP_RUNBOOK_ENABLED=true
EVERYUP_RUNBOOK_DIR=/etc/everyup/runbooks
```

## Format

Each runbook is a Markdown file with a small front matter block:

```markdown
---
name: Nginx 502 Upstream Failure
description: Reverse proxy cannot reach upstream.
severity: high
service_types: nginx,proxy,http
patterns: 502,bad gateway,upstream prematurely closed connection
auto_execute: false
---

## Steps

- Confirm the upstream container is running.
- Check Docker labels and network aliases.
- Read upstream logs before restarting.
```

| Field | Description |
|---|---|
| `name` | Human-readable runbook name |
| `description` | Short explanation shown in alerts |
| `severity` | Suggested risk level |
| `service_types` | Optional comma-separated hints matched against service name, check type, and endpoint |
| `patterns` | Comma-separated text patterns matched against incident text |
| `auto_execute` | Reserved; keep `false` |

## Built-in Runbooks

- HikariCP connection pool exhaustion
- Nginx 502 upstream failure
- Disk full
- Container restart loop

## Safety

Runbooks are advisory only. They do not execute actions. Any operational action
still goes through the approved action flow, and actions remain disabled by
default.
