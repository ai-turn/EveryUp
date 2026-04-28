# EveryUp Log Agent

![EveryUp Log Agent Overview](../docs/images/log-agent-overview.png)

The EveryUp Log Agent collects logs from your application and forwards them to your EveryUp server.

Use this option when:
- your app already writes logs to a file
- you do not want to change application code
- you want to collect logs at the server or container level

If you can edit the application code easily, the HTTP Appender examples in the EveryUp UI may be a simpler starting point. If you want to collect existing log files with minimal code changes, choose Log Agent.

The container image supports `linux/amd64` and `linux/arm64`. Docker pulls the correct image automatically.

## Before You Start

Make sure these are ready first:
1. Your EveryUp server is running.
2. You created a service in the EveryUp dashboard.
3. You copied the API key from `Logs > Integration`.
4. Your application writes logs either to a file or to stdout/stderr.

## Which Setup Should I Choose?

- File mount with `docker run`: best for a quick first test
- Sidecar in `docker compose`: best when your app already runs in Compose
- Pipe mode: best when your app only logs to stdout/stderr
- `systemd`: best for VMs or bare metal servers

## Quick Start

### 1. Pull the image

```bash
docker pull aiturn/everyup-log-agent:latest
```

### 2. Start the agent

This example assumes your app writes log files under `/path/to/your/app/logs`.

```bash
docker run -d \
  --name everyup-log-agent \
  -v /path/to/your/app/logs:/var/log/app:ro \
  -e LOG_AGENT_ENDPOINT=http://your-everyup-server:3001 \
  -e LOG_AGENT_API_KEY=everyup_your_api_key \
  --restart unless-stopped \
  aiturn/everyup-log-agent:latest
```

### 3. Confirm the agent is running

```bash
docker logs everyup-log-agent
```

If the connection is successful, newly written log lines should start appearing in EveryUp.

## Docker Compose

### Add the agent to an existing Compose stack

Use this when your application already runs in `docker-compose.yml` or `compose.yaml`.

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

`LOG_AGENT_ENDPOINT` and `LOG_AGENT_API_KEY` are required. The agent will not start without them.

If you prefer not to keep secrets in the Compose file, create a separate env file:

```yaml
    env_file: log-agent.env
```

Then start the stack:

```bash
docker compose up -d
```

### Run the sample Compose file from this repo

If you want to run the agent by itself, copy the example env file first:

```bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Update `.env` with your server URL, API key, and log path, then start:

```bash
docker compose up -d
```

## Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `LOG_AGENT_ENDPOINT` | Yes | EveryUp server URL | none |
| `LOG_AGENT_API_KEY` | Yes | Service API key from `Logs > Integration` | none |
| `LOG_AGENT_FILE` | No | Log file path inside the container. Globs are supported. | `/var/log/app/*.log` |
| `LOG_AGENT_LEVEL` | No | Agent log level: `debug`, `info`, `warn`, `error` | `info` |
| `LOG_AGENT_RETRY_LIMIT` | No | Retry count when delivery fails. Use `0` for unlimited retries. | `3` |
| `LOG_AGENT_PATH` | No | Host log directory mounted to `/var/log/app` | none |
| `LOG_AGENT_HOST` | No | Override the host parsed from `LOG_AGENT_ENDPOINT` | none |
| `LOG_AGENT_PORT` | No | Override the port parsed from `LOG_AGENT_ENDPOINT` | none |
| `LOG_AGENT_TLS` | No | Override TLS detection with `on` or `off` | parsed from endpoint |
| `LOG_AGENT_TLS_VERIFY` | No | Verify the TLS certificate with `on` or `off` | `off` |
| `LOG_AGENT_CONFIG` | No | Path to a custom Fluent Bit config file | `/fluent-bit/etc/fluent-bit.conf` |

### How endpoint parsing works

- `http://192.168.1.10:3001` becomes `host=192.168.1.10`, `port=3001`, `tls=off`
- `https://monitoring.example.com` becomes `host=monitoring.example.com`, `port=443`, `tls=on`

If your URL uses an unsupported format, skip `LOG_AGENT_ENDPOINT` and set `LOG_AGENT_HOST`, `LOG_AGENT_PORT`, and `LOG_AGENT_TLS` directly.

## Common Deployment Patterns

### 1. Sidecar pattern

Use this when your app and agent should share the same log volume.

```yaml
services:
  myapp:
    image: myapp:latest
    volumes:
      - app-logs:/var/log/app

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    volumes:
      - app-logs:/var/log/app:ro
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=everyup_your_api_key
    restart: unless-stopped

volumes:
  app-logs:
```

### 2. Pipe mode

Use this when the application only writes logs to stdout/stderr and does not create log files.

```yaml
services:
  myapp:
    image: myapp:latest

  everyup-log-agent:
    image: aiturn/everyup-log-agent:latest
    environment:
      - LOG_AGENT_ENDPOINT=http://your-everyup-server:3001
      - LOG_AGENT_API_KEY=everyup_your_api_key
      - LOG_AGENT_CONFIG=/fluent-bit/etc/stdin.conf
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    entrypoint: >
      sh -c "docker logs -f myapp 2>&1 |
      /entrypoint.sh"
    restart: unless-stopped
```

### 3. systemd on a VM or bare metal host

Use this when Docker is not your main runtime.

```ini
# /etc/systemd/system/everyup-log-agent.service
[Unit]
Description=EveryUp Log Agent (Fluent Bit)
After=network.target

[Service]
Type=simple
ExecStart=/opt/fluent-bit/bin/fluent-bit \
  -c /etc/everyup-agent/fluent-bit.conf
Restart=always
RestartSec=5
EnvironmentFile=/etc/everyup-agent/env

[Install]
WantedBy=multi-user.target
```

Example env file:

```bash
LOG_AGENT_HOST=monitoring.example.com
LOG_AGENT_PORT=443
LOG_AGENT_TLS=on
LOG_AGENT_API_KEY=everyup_your_api_key
LOG_AGENT_FILE=/var/log/myapp/app.log
LOG_AGENT_LEVEL=info
```

Typical setup steps:

```bash
curl -sL https://packages.fluentbit.io/install.sh | sh
sudo cp fluent-bit.conf /etc/everyup-agent/
sudo systemctl enable everyup-log-agent
sudo systemctl start everyup-log-agent
```

## Log Format

### JSON logs

JSON is recommended because structured fields are preserved.

```json
{"level": "error", "message": "connection failed", "service": "api", "userId": 123}
```

Recognized fields:
- `message`, `msg`, `log` -> message
- `level`, `levelname`, `severity` -> level
- all other fields -> metadata

Level mapping:

| Input | Stored as |
|-------|-----------|
| `FATAL`, `CRITICAL`, `ERROR`, `ERR` | `error` |
| `WARN`, `WARNING` | `warn` |
| `INFO`, `DEBUG`, `TRACE` | `info` |
| unset or unknown | `error` |

### Plain text logs

If a line is not JSON, the full line is stored as the message. The level defaults to `error`.

## Troubleshooting

### The agent is running, but no logs are collected

- Check that the volume mount is correct.

```bash
docker exec everyup-log-agent ls -la /var/log/app/
```

- Check the file pattern. The default is `/var/log/app/*.log`. If your files use a different name or extension, set:

```bash
LOG_AGENT_FILE=/var/log/app/*
```

- Check whether your application actually writes to a file. Many containers only log to stdout/stderr by default.

### Logs are collected locally, but do not appear in EveryUp

- Check the agent logs:

```bash
docker logs everyup-log-agent
```

- Look for common errors such as `Connection refused` or `401 Unauthorized`.

- Check network connectivity from inside the container:

```bash
docker exec everyup-log-agent wget -qO- http://your-everyup-server:3001/api/v1/health
```

- Verify that the API key matches the key shown in `Logs > Integration`.

- Enable debug logging if you need more detail:

```bash
LOG_AGENT_LEVEL=debug
```
