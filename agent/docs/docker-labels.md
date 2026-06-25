# Docker Label Discovery

EveryUp Agent discovers containers when `EVERYUP_DOCKER_DISCOVERY_ENABLED=true`
and the Docker socket is mounted read-only.

## Labels

| Label | Required | Description |
|---|---:|---|
| `everyup.enabled` | yes | Enables discovery when set to `true`, `1`, `yes`, or `on` |
| `everyup.service.name` | no | Display name in alerts. Defaults to the container name |
| `everyup.health.type` | no | `http` or `tcp`. Defaults to `http` |
| `everyup.health.url` | no | Explicit HTTP URL or TCP `host:port` endpoint |
| `everyup.health.host` | no | TCP host override. Defaults to the container name |
| `everyup.health.scheme` | no | HTTP scheme. Defaults to `http` |
| `everyup.health.port` | sometimes | Port used to build HTTP/TCP endpoint when `health.url` is absent |
| `everyup.health.path` | no | HTTP path. Defaults to `/health` |
| `everyup.alert.logs.keywords` | no | Comma-separated log keywords that should trigger alerts |
| `everyup.alert.logs.lines` | no | Number of recent log lines to scan. Defaults to `100`, max `500` |
| `everyup.alert.cpu.percent` | no | Container CPU percentage threshold |
| `everyup.alert.memory.percent` | no | Container memory percentage threshold |

**Only `everyup.enabled` is required.** With nothing else, the agent reports
liveness straight from the Docker container state (running = up, exited/dead =
down) — no health endpoint to expose. Adding `everyup.health.url` (or
`everyup.health.port`) upgrades a service to active HTTP/TCP probing, which also
captures response time and status codes.

## Liveness (no health endpoint)

The simplest setup — the agent watches whether the container is running:

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"
```

`State == running` reports healthy; `exited`/`dead`/`created` report down with the
Docker status line (e.g. `Exited (137) 2m ago`) as the reason. A removed
container (`docker compose down`) drops off the dashboard rather than showing as
down.

## HTTP examples

Use an explicit URL when the service already has a stable internal endpoint.

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.type: "http"
      everyup.health.url: "http://api:8080/health"
```

Or let the agent build the URL from parts.

```yaml
services:
  web:
    image: my-web:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "web"
      everyup.health.port: "3000"
      everyup.health.path: "/ready"
```

## TCP example

```yaml
services:
  postgres:
    image: postgres:16
    labels:
      everyup.enabled: "true"
      everyup.service.name: "postgres"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"
```

## Log keyword example

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.url: "http://api:8080/health"
      everyup.alert.logs.keywords: "ERROR,FATAL,panic"
      everyup.alert.logs.lines: "200"
```

When a keyword is found in recent Docker logs, the agent records an `alert_sent`
audit event with `source=log_keyword` and syncs it to EveryUp Web, which decides
whether to notify. Repeated matches use the normal
`EVERYUP_ALERT_COOLDOWN_SECONDS` cooldown.

## Resource threshold example

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "worker"
      everyup.health.type: "tcp"
      everyup.health.port: "9090"
      everyup.alert.cpu.percent: "85"
      everyup.alert.memory.percent: "90"
```

Resource checks use Docker's `/stats?stream=false` endpoint. Threshold alerts
share the normal alert cooldown and are recorded with `source=resource_threshold`.

## Security

Mounting `/var/run/docker.sock` gives broad visibility into Docker. The MVP
uses a read-only socket mount, and the next hardening step is a
docker-socket-proxy compose example that exposes only the container list API.
Log keyword detection uses Docker's container logs API, so deployments that use
it must allow that endpoint too. Resource threshold detection uses Docker's
container stats API.
