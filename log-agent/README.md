# EveryUp Log Agent

Collect logs from your application and forward them to your EveryUp dashboard.

Supports `linux/amd64` and `linux/arm64` — Docker automatically pulls the correct variant.

---

## Prerequisites

1. EveryUp server is running
2. Register a service in the EveryUp dashboard
3. Get your API key from **Service detail → Integration** tab

---

## Quick Start

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

### Docker Compose

`.env`:
```dotenv
LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
LOG_AGENT_API_KEY=la_your_api_key
LOG_AGENT_PATH=/path/to/your/app/logs
```

`docker-compose.yml`:
```yaml
services:
  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    restart: unless-stopped
    env_file: .env
    volumes:
      - ${LOG_AGENT_PATH}:/var/log/app:ro
```

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

> **`LOG_AGENT_ENDPOINT` URL parsing:**
> - `http://192.168.1.10:3001` → host=192.168.1.10, port=3001, tls=off
> - `https://monitoring.example.com` → host=monitoring.example.com, port=443, tls=on

---

## Web Console (Test Mode)

A browser-based console for sending test logs. Useful for verifying the agent is configured correctly.

> **Warning:** Never enable in production — it starts an unauthenticated HTTP server.

```dotenv
LOG_AGENT_WEB_CONSOLE=true
LOG_AGENT_WEB_CONSOLE_PORT=8080
```

```bash
docker compose up
```

Open `http://localhost:8080` to send test logs and watch the live stream.

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
