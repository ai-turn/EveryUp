# Docker Socket Proxy

For stricter production deployments, put a Docker socket proxy between the Agent
and the Docker Engine. The Agent only needs read access for container discovery,
container logs, events, and stats.

```yaml
services:
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    container_name: docker-socket-proxy
    environment:
      CONTAINERS: "1"
      EVENTS: "1"
      INFO: "1"
      VERSION: "1"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped

  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
      EVERYUP_DOCKER_SOCKET_PATH: "http://docker-socket-proxy:2375"
    depends_on:
      - docker-socket-proxy
    volumes:
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

Use this pattern when you do not want the Agent container to mount the Docker
socket directly.