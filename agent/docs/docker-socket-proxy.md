# Docker Socket Proxy

Mounting `/var/run/docker.sock` gives broad Docker control. For production, put
a socket proxy in front of Docker and expose only the API surfaces EveryUp Agent
needs.

The exact environment flags depend on the proxy image. This example uses
`tecnativa/docker-socket-proxy`.

```yaml
services:
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:0.3.0
    restart: unless-stopped
    environment:
      CONTAINERS: 1
      INFO: 1
      POST: 0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  everyup-agent:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    environment:
      EVERYUP_DOCKER_SOCKET_PATH: tcp://docker-socket-proxy:2375
    depends_on:
      - docker-socket-proxy
```

## Required APIs

| Feature | Docker API |
|---|---|
| Discovery | `GET /containers/json` |
| ChatOps logs and log keyword alerts | `GET /containers/{id}/logs` |
| Container resource thresholds | `GET /containers/{id}/stats?stream=false` |
| Approved restart action | `POST /containers/{id}/restart` |

Keep `EVERYUP_ACTIONS_ENABLED=false` unless the proxy allows the restart API and
your deployment policy accepts that risk.

For approved restart actions, the proxy must also allow the relevant POST route;
keep dry-run enabled until that path is explicitly tested.
