---
name: Container Restart Loop
description: Container keeps exiting, restarting, or failing health checks.
severity: medium
service_types: docker,container
patterns: restarting,exited,unhealthy,health check failed,container restart
auto_execute: false
---

## Steps

- Read recent container logs and identify the first fatal error.
- Check environment variables, mounted files, and dependent services.
- Verify health check endpoint timing and startup grace period.
- Use approved restart only after the root symptom is understood.
