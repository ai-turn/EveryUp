# EveryUp Log Agent

Built on [Fluent Bit](https://fluentbit.io/), the EveryUp Log Agent tails your application log files and forwards entries to your EveryUp server. No code changes required.

Use this when:
- Your app writes logs to a file or stdout/stderr
- You want to add log monitoring without touching application code

Supports `linux/amd64` and `linux/arm64`. Docker pulls the correct variant automatically.

## Before You Start

1. Your EveryUp server is running.
2. You created a log service in the EveryUp dashboard.
3. You copied the API key from **Logs → Service detail → Integration**.
4. Your application writes logs to a file or stdout/stderr.

## Quick Start

### Option A — docker run

Replace `/path/to/your/app/logs` with the directory your app writes logs to.

```bash
docker run -d \
  --name everyup-log-agent \
  -v /path/to/your/app/logs:/var/log/app:ro \
  -e LOG_AGENT_ENDPOINT=http://your-everyup-server:3001 \
  -e LOG_AGENT_API_KEY=everyup_your_api_key \
  --restart unless-stopped \
  aiturn/everyup-log-agent:latest
```

### Option B — docker compose (recommended)

Add the agent to your existing `docker-compose.yml`:

```yaml
services:
  your-app:
    # ... your existing service

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

### Verify

```bash
docker logs everyup-log-agent
```

New log lines should start appearing in EveryUp within a few seconds.

## Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `LOG_AGENT_ENDPOINT` | Yes | EveryUp server URL | — |
| `LOG_AGENT_API_KEY` | Yes | API key from **Logs → Integration** | — |
| `LOG_AGENT_FILE` | No | Log file path inside the container. Glob patterns are supported. | `/var/log/app/*.log` |
| `LOG_AGENT_LEVEL` | No | Agent's own log verbosity: `debug`, `info`, `warn`, `error` | `info` |
| `LOG_AGENT_RETRY_LIMIT` | No | Delivery retry count. Set `0` for unlimited retries. | `3` |
| `LOG_AGENT_HOST` | No | Override the host parsed from `LOG_AGENT_ENDPOINT` | — |
| `LOG_AGENT_PORT` | No | Override the port parsed from `LOG_AGENT_ENDPOINT` | — |
| `LOG_AGENT_TLS` | No | Override TLS: `on` or `off` | parsed from endpoint |
| `LOG_AGENT_TLS_VERIFY` | No | Verify TLS certificate: `on` or `off` | `on` |
| `LOG_AGENT_CONFIG` | No | Path to a custom Fluent Bit config file | `/fluent-bit/etc/fluent-bit.conf` |

**Endpoint parsing examples:**
- `http://192.168.1.10:3001` → `host=192.168.1.10`, `port=3001`, `tls=off`
- `https://monitoring.example.com` → `host=monitoring.example.com`, `port=443`, `tls=on`

If your URL format is not supported (e.g. IPv6), skip `LOG_AGENT_ENDPOINT` and set `LOG_AGENT_HOST`, `LOG_AGENT_PORT`, and `LOG_AGENT_TLS` directly.

## Deployment Patterns

### Sidecar with a shared volume

Use this when your app and agent run in the same Compose stack and share a log volume.

```yaml
services:
  myapp:
    image: myapp:latest
    volumes:
      - app-logs:/var/log/app

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    restart: unless-stopped
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=everyup_your_api_key
    volumes:
      - app-logs:/var/log/app:ro

volumes:
  app-logs:
```

### Pipe mode (stdout/stderr only)

Use this when your app only logs to stdout/stderr and does not write log files.

```yaml
services:
  myapp:
    image: myapp:latest

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
      sh -c "docker logs -f myapp 2>&1 | /entrypoint.sh"
```

### systemd (VM or bare metal)

Use this when Docker is not your primary runtime. Install Fluent Bit first:

```bash
curl -sL https://packages.fluentbit.io/install.sh | sh
```

Create `/etc/systemd/system/everyup-log-agent.service`:

```ini
[Unit]
Description=EveryUp Log Agent (Fluent Bit)
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

Create `/etc/everyup-agent/agent.env`:

```bash
LOG_AGENT_HOST=monitoring.example.com
LOG_AGENT_PORT=443
LOG_AGENT_TLS=on
LOG_AGENT_API_KEY=everyup_your_api_key
LOG_AGENT_FILE=/var/log/myapp/app.log
```

Then enable and start:

```bash
sudo systemctl enable --now everyup-log-agent
```

## Log Format

The agent accepts any log format and normalizes it before forwarding.

### JSON logs (recommended)

Structured fields are preserved as metadata.

```json
{"level": "error", "message": "connection failed", "service": "api", "userId": 123}
```

Recognized fields:

| JSON field | Maps to |
|------------|---------|
| `message`, `msg`, `log` | message |
| `level`, `levelname`, `severity`, `logLevel`, `log_level`, `lvl` | level |
| all other fields | metadata |

### Plain text logs

The full line is stored as the message. The agent infers the level from bracketed tokens or line prefixes (e.g. `[ERROR]`, `WARN:`). If no level can be detected, it defaults to `info`.

### Level mapping

| Input value | Stored as |
|-------------|-----------|
| `FATAL`, `CRITICAL`, `ERROR`, `ERR` | `error` |
| `WARN`, `WARNING` | `warn` |
| `INFO`, `INFORMATION` | `info` |
| `DEBUG` | `debug` |
| `TRACE`, `VERBOSE` | `trace` |
| unset or unrecognized | `info` |

> **Note:** The default log level filter per service is `[error, warn, info]`. `debug` and `trace` entries are forwarded by the agent but dropped at ingest unless you explicitly add those levels in **Logs → Service detail → Edit**.

## Troubleshooting

### Logs are not being collected

Check that the volume mount is correct:

```bash
docker exec everyup-log-agent ls -la /var/log/app/
```

Check the file pattern. The default is `/var/log/app/*.log`. If your files use a different extension:

```bash
LOG_AGENT_FILE=/var/log/app/*
```

Many containers only log to stdout/stderr by default — in that case use [Pipe mode](#pipe-mode-stdoutstderr-only).

### Logs are collected but do not appear in EveryUp

Check the agent logs for connection errors:

```bash
docker logs everyup-log-agent
```

Check network connectivity from inside the container:

```bash
docker exec everyup-log-agent wget -qO- http://your-everyup-server:3001/api/v1/health
```

Common causes: `Connection refused` (wrong endpoint), `401 Unauthorized` (wrong API key).

Enable debug logging for more detail:

```bash
-e LOG_AGENT_LEVEL=debug
```
