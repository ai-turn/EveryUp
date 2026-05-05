# EveryUp Log Agent

Built on [Fluent Bit](https://fluentbit.io/), the EveryUp Log Agent reads your application's log files and forwards them to your EveryUp dashboard — no code changes required.

---

## Before You Start

1. Your EveryUp server is running and accessible.
2. You created a log service in the EveryUp dashboard (**Logs → Add service**).
3. You copied the API key from **Logs → Service detail → Integration**.

---

## Choose Your Setup

Pick the option that matches your situation. You only need one.

---

### A. My app writes logs to a file, and I want to run the agent with a single command

```bash
docker run -d \
  --name everyup-log-agent \
  -v /path/to/your/app/logs:/var/log/app:ro \
  -e LOG_AGENT_ENDPOINT=http://your-everyup-server:3001 \
  -e LOG_AGENT_API_KEY=everyup_your_api_key \
  --restart unless-stopped \
  aiturn/everyup-log-agent:latest
```

Replace `/path/to/your/app/logs` with the folder where your app writes its `.log` files.

---

### B. My app is already running with Docker Compose, and it writes logs to a file

Add the agent to your existing `docker-compose.yml`:

```yaml
services:
  your-app:
    # ... leave your existing service as-is

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    restart: unless-stopped
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=everyup_your_api_key
    volumes:
      - /path/to/your/app/logs:/var/log/app:ro
```

```bash
docker compose up -d
```

Replace `/path/to/your/app/logs` with the actual log directory on the host machine.

---

### C. My app is in Docker Compose but doesn't write log files — it only prints to the terminal

Many apps (Node.js, Spring Boot, etc.) print logs to the console instead of writing files. In Docker, this is called `stdout`/`stderr`.

In this case, the app and agent need to share a Docker volume so both can see the same data:

```yaml
services:
  your-app:
    image: your-app:latest
    volumes:
      - app-logs:/var/log/app    # ← your app must write logs here

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    restart: unless-stopped
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=everyup_your_api_key
    volumes:
      - app-logs:/var/log/app:ro  # ← agent reads from the same place

volumes:
  app-logs:
```

> Your app needs to write logs to `/var/log/app` inside its container for this to work. If your app can't write files at all, see option D below.

---

### D. My app only prints to the terminal and I cannot change that

If your app prints everything to the terminal and you have no way to redirect it to a file, the agent can capture the terminal output directly.

```yaml
services:
  your-app:
    image: your-app:latest

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    restart: unless-stopped
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=everyup_your_api_key
      - LOG_AGENT_CONFIG=/fluent-bit/etc/stdin.conf
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    entrypoint: >
      sh -c "docker logs -f your-app 2>&1 | /entrypoint.sh"
```

Replace `your-app` in `docker logs -f your-app` with your actual container name.

---

### E. I'm not using Docker — my server runs services directly

Install Fluent Bit on the server:

```bash
curl -sL https://packages.fluentbit.io/install.sh | sh
```

Create a service file at `/etc/systemd/system/everyup-log-agent.service`:

```ini
[Unit]
Description=EveryUp Log Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/fluent-bit/bin/fluent-bit -c /etc/everyup-agent/fluent-bit.conf
Restart=always
RestartSec=5
EnvironmentFile=/etc/everyup-agent/agent.env

[Install]
WantedBy=multi-user.target
```

Create a config file at `/etc/everyup-agent/agent.env`:

```bash
LOG_AGENT_HOST=your-everyup-server.com
LOG_AGENT_PORT=3001
LOG_AGENT_TLS=off
LOG_AGENT_API_KEY=everyup_your_api_key
LOG_AGENT_FILE=/var/log/myapp/app.log
```

Start the service:

```bash
sudo systemctl enable --now everyup-log-agent
```

---

## Verify It's Working

After starting the agent, check that it connected successfully:

```bash
docker logs everyup-log-agent
```

New log lines should appear in EveryUp within a few seconds. If nothing shows up, see [Troubleshooting](#troubleshooting) below.

---

## Configuration Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `LOG_AGENT_ENDPOINT` | Yes | EveryUp server URL | — |
| `LOG_AGENT_API_KEY` | Yes | API key from **Logs → Integration** | — |
| `LOG_AGENT_FILE` | No | Log file path inside the container. Glob patterns are supported. | `/var/log/app/*.log` |
| `LOG_AGENT_LEVEL` | No | Agent's own log verbosity: `debug`, `info`, `warn`, `error` | `info` |
| `LOG_AGENT_RETRY_LIMIT` | No | Delivery retry count. Set `0` for unlimited retries. | `3` |
| `LOG_AGENT_HOST` | No | Override the host parsed from `LOG_AGENT_ENDPOINT` | — |
| `LOG_AGENT_PORT` | No | Override the port parsed from `LOG_AGENT_ENDPOINT` | — |
| `LOG_AGENT_TLS` | No | Override TLS detection: `on` or `off` | parsed from endpoint |
| `LOG_AGENT_TLS_VERIFY` | No | Verify TLS certificate: `on` or `off` | `on` |
| `LOG_AGENT_CONFIG` | No | Path to a custom Fluent Bit config file | `/fluent-bit/etc/fluent-bit.conf` |

**How endpoint URL is parsed:**
- `http://192.168.1.10:3001` → host `192.168.1.10`, port `3001`, TLS off
- `https://monitoring.example.com` → host `monitoring.example.com`, port `443`, TLS on

---

## Log Format

The agent accepts any log format and normalizes it automatically.

### JSON logs (recommended)

```json
{"level": "error", "message": "connection failed", "service": "api", "userId": 123}
```

Recognized fields:

| JSON field | Stored as |
|------------|-----------|
| `message`, `msg`, `log` | message |
| `level`, `levelname`, `severity`, `logLevel`, `log_level`, `lvl` | level |
| all other fields | metadata (searchable) |

### Plain text logs

If a line is not JSON, the full line is stored as the message. The agent infers the level from patterns like `[ERROR]`, `WARN:`, or `ERROR ` at the start of the line.

### Level mapping

| Input value | Stored as |
|-------------|-----------|
| `FATAL`, `CRITICAL`, `ERROR`, `ERR` | `error` |
| `WARN`, `WARNING` | `warn` |
| `INFO`, `INFORMATION` | `info` |
| `DEBUG` | `debug` |
| `TRACE`, `VERBOSE` | `trace` |
| unset or unrecognized | `info` |

> **Note:** Each log service filters by level. The default is `error`, `warn`, and `info` only. To also receive `debug` and `trace` entries, go to **Logs → Service detail → Edit** and add those levels.

---

## Troubleshooting

### No logs are being collected

Check that the agent can see the log files:

```bash
docker exec everyup-log-agent ls -la /var/log/app/
```

If the folder is empty or doesn't exist, the volume path is wrong. Double-check that you're mounting the correct directory.

The default file pattern is `/var/log/app/*.log`. If your files have a different extension (e.g. `.txt` or no extension):

```
-e LOG_AGENT_FILE=/var/log/app/*
```

### Logs are visible locally but don't appear in EveryUp

Check the agent output for error messages:

```bash
docker logs everyup-log-agent
```

Common causes:
- `Connection refused` — the endpoint URL or port is wrong
- `401 Unauthorized` — the API key doesn't match

Test connectivity from inside the agent container:

```bash
docker exec everyup-log-agent wget -qO- http://your-everyup-server:3001/api/v1/health
```

For more detail, enable verbose logging:

```
-e LOG_AGENT_LEVEL=debug
```
