# EveryUp Log Agent

![EveryUp Log Agent Overview](../docs/images/log-agent-overview.png)

Collect logs from your application and forward them to your EveryUp dashboard.

Supports `linux/amd64` and `linux/arm64` — Docker automatically pulls the correct variant.

---

## Prerequisites

1. EveryUp server is running
2. Register a service in the EveryUp dashboard
3. Get your API key from **Service detail → Integration** tab

---

## Quick Start

Choose the setup that matches your deployment.

### Docker

```bash
docker pull aiturn/everyup-log-agent:latest
```

```bash
docker run -d \
  --name everyup-log-agent \
  -v /path/to/your/app/logs:/var/log/app:ro \
  -e LOG_AGENT_ENDPOINT=http://your-everyup-server:3001 \
  -e LOG_AGENT_API_KEY=la_your_api_key \
  --restart unless-stopped \
  aiturn/everyup-log-agent:latest
```

### Adding to an existing Docker Compose project

Add the agent as a service directly in your `docker-compose.yml`. Set environment variables inline to avoid conflicts with your project's existing `.env` file:

```yaml
services:
  your-app:
    # ... your existing services

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    restart: unless-stopped
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=la_your_api_key
    volumes:
      - /path/to/your/app/logs:/var/log/app:ro
```

> `LOG_AGENT_ENDPOINT` and `LOG_AGENT_API_KEY` are required. The agent will not start without them.

If you prefer to keep secrets out of `docker-compose.yml`, use a separate named file (e.g. `log-agent.env`) and reference it explicitly:

```yaml
    env_file: log-agent.env
```

Then start with:

```bash
docker compose up -d
```

### Standalone Docker Compose

If you are running the agent on its own, use the provided `docker-compose.yml` from this repo together with a local `.env` file:

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Update `.env` with your EveryUp server URL, API key, and log path, then start the agent:

```bash
docker compose up -d
```

--- 

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_AGENT_ENDPOINT` | EveryUp server URL **(required)** | — |
| `LOG_AGENT_API_KEY` | Service API key **(required)** | — |
| `LOG_AGENT_FILE` | Log file path (glob supported) | `/var/log/app/*.log` |
| `LOG_AGENT_LEVEL` | Log level (`debug`, `info`, `warn`, `error`) | `info` |
| `LOG_AGENT_RETRY_LIMIT` | Retry count on failure (`0` = unlimited) | `3` |
| `LOG_AGENT_PATH` | Host log directory (mounted to `/var/log/app`) | — |
| `LOG_AGENT_WEB_CONSOLE` | Enable test console UI | `false` |
| `LOG_AGENT_WEB_CONSOLE_PORT` | Test console port | `8080` |
| `LOG_AGENT_HOST` | Override parsed host from `LOG_AGENT_ENDPOINT` | — |
| `LOG_AGENT_PORT` | Override parsed port from `LOG_AGENT_ENDPOINT` | — |
| `LOG_AGENT_TLS` | TLS on/off (`on`/`off`), overrides parsed value | `off` |
| `LOG_AGENT_TLS_VERIFY` | Verify TLS certificate (`on`/`off`) | `off` |
| `LOG_AGENT_CONFIG` | Fluent Bit config file path | `/fluent-bit/etc/fluent-bit.conf` |

> **`LOG_AGENT_ENDPOINT` URL parsing:**
> - `http://192.168.1.10:3001` → host=192.168.1.10, port=3001, tls=off
> - `https://monitoring.example.com` → host=monitoring.example.com, port=443, tls=on
>
> For unsupported URL formats (e.g. IPv6, user:pass@host), skip `LOG_AGENT_ENDPOINT` and set `LOG_AGENT_HOST`, `LOG_AGENT_PORT`, `LOG_AGENT_TLS` directly.

---

## Web Console (Test Mode)

A browser-based console for sending test logs. Use it to confirm that the agent is configured correctly.

> **Warning:** Never enable in production — it starts an unauthenticated HTTP server.

Add to your service's `environment` block and expose the port:

```yaml
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=la_your_api_key
      - LOG_AGENT_WEB_CONSOLE=true
      - LOG_AGENT_WEB_CONSOLE_PORT=8080  # optional, default 8080
    ports:
      - "8080:8080"
```

### Accessing the console when nginx is your reverse proxy

The web console makes requests to `/log` using a relative URL, so the browser must reach the test console server directly — not through nginx. nginx only handles the ports it listens on (typically 80/443). The `ports: "8080:8080"` binding connects the host directly to the container at the OS network level, bypassing nginx entirely.

**Option 1 — Direct port access (recommended)**

Access the console via the host IP and port, skipping nginx:

```
http://<server-ip>:8080
```

> **Firewall note:** nginx being a reverse proxy does not block this port — nginx only handles traffic on the ports it explicitly listens on (80/443). However, your cloud security group or OS firewall typically allows only 80/443 by default, so **you must open the console port explicitly**:
> - AWS: EC2 Security Group → add inbound rule for the port
> - GCP: VPC Firewall Rules → add allow rule for the port
> - Linux (ufw): `ufw allow 8080`
> - Linux (iptables): `iptables -A INPUT -p tcp --dport 8080 -j ACCEPT`
>
> Remember to close the port again after testing.

**Option 2 — Proxy through nginx**

If the server is not directly reachable (e.g. behind a load balancer), add location blocks to your nginx config to proxy both the page and the `/log` endpoint:

```nginx
location /log-console/ {
    proxy_pass http://everyup-log-agent:8080/;
    proxy_set_header Host $host;
}

location /log {
    proxy_pass http://everyup-log-agent:8080/log;
    proxy_set_header Host $host;
}
```

`everyup-log-agent` must be on the same Docker network as nginx for the service name to resolve.

Then start and open `http://localhost:8080` (Option 1) or `https://your-domain/log-console/` (Option 2) to send test logs and watch the live stream.

---

## Log Format

### JSON (recommended)

```json
{"level": "error", "message": "connection failed", "service": "api", "userId": 123}
```

Recognized fields:
- **message**: `message`, `msg`, or `log`
- **level**: `level`, `levelname`, or `severity`
- **other fields**: collected automatically as `metadata`

Level mapping:

| Input | Mapped to |
|-------|-----------|
| `FATAL`, `CRITICAL`, `ERROR`, `ERR` | `error` |
| `WARN`, `WARNING` | `warn` |
| `INFO`, `DEBUG`, `TRACE` | `info` |
| unset or other | `error` |

### Plain text

Non-JSON lines are collected as-is. The full line becomes `message` and level is set to `error`.

---

## Troubleshooting

### Logs not being collected

- **Check volume mount**
  ```bash
  docker exec everyup-log-agent ls -la /var/log/app/
  ```
  If no files appear, your volume path is misconfigured.

- **Check file extension** — default pattern is `/var/log/app/*.log`. If your app uses a different extension, set `LOG_AGENT_FILE`:
  ```
  LOG_AGENT_FILE=/var/log/app/*
  ```

- **App must write to a file** — containers typically log to stdout/stderr only. Configure your app to also write logs to a file (e.g. `/var/log/app/app.log`).

### Logs not appearing in EveryUp

- **Check agent logs**
  ```bash
  docker logs everyup-log-agent
  ```
  Look for `Connection refused` or `401 Unauthorized`.

- **Check network connectivity**
  ```bash
  docker exec everyup-log-agent wget -qO- http://your-everyup-server:3001/api/v1/health
  ```

- **Verify API key** — confirm the key matches the one shown in the Integration tab.

- **Enable debug logging**
  ```
  LOG_AGENT_LEVEL=debug
  ```
