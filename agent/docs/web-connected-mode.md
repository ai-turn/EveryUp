# Web Connected Mode

Web connected mode lets the Agent sync discovered containers, Docker logs, API
access-log summaries, events, and host metrics to EveryUp Web.

## Compose Setup

Set the Web connection values directly on the `everyup-agent` service in
`docker-compose.yml`:

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

Create the key in Web from **Services -> Add**, replace
`EVERYUP_AGENT_API_KEY`, then restart the Agent. It enrolls automatically and
appears online within about 30 seconds.

## Required Values

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Enable Web enrollment and sync |
| `EVERYUP_WEB_BASE_URL` | | EveryUp Web base URL reachable from the Agent host |
| `EVERYUP_AGENT_API_KEY` | | API key generated in Web from Services -> Add |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | `30` | Service/event/metric sync interval |

`EVERYUP_WEB_ENROLLMENT_TOKEN` is the deprecated name for
`EVERYUP_AGENT_API_KEY` and is still accepted as a fallback.

## Logs And API Requests

Docker stdout/stderr logs are forwarded automatically for containers on the same
Docker host.

API requests are created from access-log lines found in Docker stdout. The Agent
recognizes common formats such as:

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

If the access log is written only to a file inside the container, configure the
application or reverse proxy to also write it to stdout.

## API Contract

The Agent syncs to these Web endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/agents/enroll` | Register or refresh an Agent |
| `POST /api/v1/agents/:agentId/services` | Upsert discovered container state |
| `POST /api/v1/agents/:agentId/events` | Flush local Agent events |
| `POST /api/v1/agents/:agentId/metrics` | Send host metrics |
| `POST /api/v1/otlp/v1/logs` | Forward Docker logs encoded by the Agent |
| `POST /api/v1/otlp/v1/traces` | Forward API request records encoded by the Agent |

Authentication uses `Authorization: Bearer <EVERYUP_AGENT_API_KEY>`.

## Identity

Docker-discovered services use a stable identity based on Docker Compose metadata
when available, then container name, then container ID. Recreating a Compose
service keeps the same service card when the Compose project and service names
stay the same.