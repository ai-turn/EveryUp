# Web Connected Mode

Web connected mode lets the Agent sync discovered services, events, host metrics,
Docker logs, and OTLP telemetry to EveryUp Web.

## Compose Setup

Set the Web connection values directly on the `everyup-agent` service in
`docker-compose.yml`:

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
      EVERYUP_TELEMETRY_GATEWAY_ENABLED: "true"
    expose:
      - "4318"
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

## Logs And OTLP

Docker stdout/stderr logs are forwarded automatically for labeled containers
when Docker log forwarding is enabled.

Applications that already emit OTLP can send telemetry to the Agent gateway:

```text
Endpoint: http://everyup-agent:4318
Protocol: http/protobuf
Paths: /v1/logs and /v1/traces
```

The Agent forwards telemetry to Web using its own `EVERYUP_AGENT_API_KEY`, so
applications do not need the EveryUp Web URL or key.

## API Contract

The Agent syncs to these Web endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/agents/enroll` | Register or refresh an Agent |
| `POST /api/v1/agents/:agentId/services` | Upsert discovered service health |
| `POST /api/v1/agents/:agentId/events` | Flush local Agent events |
| `POST /api/v1/agents/:agentId/metrics` | Send host metrics |
| `POST /api/v1/otlp/v1/logs` | Forward OTLP logs |
| `POST /api/v1/otlp/v1/traces` | Forward OTLP traces |

Authentication uses `Authorization: Bearer <EVERYUP_AGENT_API_KEY>`.

## Identity

Docker-discovered services use a stable identity based on labels and Compose
metadata, not the container ID. Recreating a container keeps the same service card
when the service name stays the same.