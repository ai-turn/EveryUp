---
name: Disk Full
description: Host or container disk pressure is causing write failures.
severity: critical
service_types: host,docker,filesystem
patterns: no space left on device,disk full,ENOSPC,write failed
auto_execute: false
---

## Steps

- Check filesystem usage with df and identify the full mount.
- Inspect Docker logs, image layers, and old volumes before deleting anything.
- Rotate or truncate known safe logs according to the service policy.
- Restore service writes and monitor for recurring growth.
