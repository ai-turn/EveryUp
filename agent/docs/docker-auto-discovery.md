# Docker Auto Discovery

EveryUp Agent discovers Docker containers automatically through the mounted
Docker socket. Application services do not need EveryUp-specific Compose blocks.

```yaml
services:
  app:
    image: my-app:latest

  everyup-agent:
    image: aiturn/everyup-agent:latest
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

The Agent reports each discovered container as a service card. It uses Docker
Compose project/service metadata when available, otherwise the container name.

## What Is Collected

- Container running/stopped state
- Docker events
- stdout/stderr logs
- API request summaries parsed from stdout access logs
- Host CPU, memory, and disk metrics

## API Request Detection

EveryUp creates API request records from access-log lines in `docker logs`.
Supported examples:

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

If `docker logs <container>` does not show the line, EveryUp cannot collect it in
compose-only mode.