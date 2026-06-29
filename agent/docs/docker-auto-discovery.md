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
- Host CPU, memory, and disk metrics

## API Request Capture

Docker auto-discovery does not create API request records from stdout access
logs. Use the Agent image in `proxy` mode in front of the application when API
request or body capture is needed.
