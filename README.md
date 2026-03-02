# EveryUp

> Self-hosted unified monitoring platform — manage service health checks, infrastructure resources, and alerts from a single dashboard.

[한국어](README.ko.md) | **English**

[![Demo](https://img.shields.io/badge/Demo-live-brightgreen)](https://ai-turn.github.io/EveryUp/)
![License](https://img.shields.io/badge/license-MIT-blue)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)

**[Live Demo →](https://ai-turn.github.io/EveryUp/)**

---

## Features

| Feature | Description |
|---------|-------------|
| **Service Monitoring** | HTTP/TCP health checks, uptime tracking, latency trends |
| **Infrastructure Monitoring** | Real-time CPU/memory/disk/network collection (local + SSH remote) |
| **API Metrics** | Per-endpoint traffic, error rate, and response time analysis |
| **Alerts** | Telegram / Discord integration, threshold-based rules |
| **Log Management** | Unified log viewer, search, log agent collection |
| **Real-time Streaming** | WebSocket-based live metric updates |

---

## Project Structure

```
everyup/
├── frontend/      # React + Vite + TypeScript + Tailwind CSS
├── backend/       # Go (Fiber) + SQLite + WebSocket
└── log-agent/     # Fluent Bit-based log collection agent
```

---

## Quick Start

### Run with Docker (recommended)

**1. Pull the image**

Choose the image for your architecture:

| Tag | Target |
|-----|--------|
| `aiturn/everyup:amd64` | x86-64 servers (standard cloud VMs) |
| `aiturn/everyup:arm64` | ARM servers (AWS Graviton, Raspberry Pi, etc.) |

```bash
docker pull aiturn/everyup:amd64   # x86-64
# or
docker pull aiturn/everyup:arm64   # ARM64
```

**2. Run**

```bash
# x86-64 (amd64)
docker run -d \
  --name everyup \
  -p 3001:3001 \
  -v everyup-data:/app/data \
  -e TZ=UTC \
  aiturn/everyup:amd64

# ARM64
docker run -d \
  --name everyup \
  -p 3001:3001 \
  -v everyup-data:/app/data \
  -e TZ=UTC \
  aiturn/everyup:arm64
```

**3. Open**

→ Go to http://localhost:3001 and create your admin account.

> **No pre-configuration needed.** On first launch, create your admin account directly in the browser.
> **Encryption keys and JWT secrets are auto-generated** on first run and stored in the database.

---

### Run with Docker Compose

If you've cloned this repository, you can use Docker Compose:

```bash
git clone https://github.com/AI-turn/EveryUp.git
cd EveryUp
docker compose up -d
```

Check status:

```bash
docker compose ps
docker compose logs -f
```

---

### Local Development

**Backend**
```bash
cd backend
go run ./cmd/server
# → http://localhost:3001
```

**Frontend**
```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:5173
```

---

## Configuration

All `config.json` values can be overridden with `MT_`-prefixed environment variables.

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `MT_SERVER_PORT` | `3001` | Server port |
| `MT_DATABASE_PATH` | `./data/monitoring.db` | SQLite file path |
| `TZ` | System default | Timezone (e.g. `America/New_York`) |

See [backend/README.md](backend/README.md) for the full configuration reference.

---

## Data Backup

All EveryUp data is stored in a single SQLite file.

```bash
# Inspect volume location
docker volume inspect everyup-data

# Backup (safe while the container is running)
docker exec everyup cp /app/data/monitoring.db /app/data/monitoring.db.bak
docker cp everyup:/app/data/monitoring.db ./monitoring.db.bak
```

---

## Upgrading

```bash
# Pull the latest image
docker pull aiturn/everyup:amd64

# Restart the container (volume data is preserved)
docker stop everyup && docker rm everyup
docker run -d \
  --name everyup \
  -p 3001:3001 \
  -v everyup-data:/app/data \
  -e TZ=UTC \
  aiturn/everyup:amd64
```

With Docker Compose:

```bash
docker compose pull
docker compose up -d
```

---

## Log Agent

Deploy `everyup-log-agent` on any server to collect logs from external services.

**1. Get an API key**

In the EveryUp dashboard, go to **Service detail → Integration** tab to generate an API key.

**2. Run the agent**

```bash
# amd64
docker run -d \
  -v /var/log/myapp:/var/log/app:ro \
  -e MT_ENDPOINT=http://your-everyup-server:3001 \
  -e MT_API_KEY=mt_your_api_key \
  aiturn/everyup-log-agent:amd64

# arm64
docker run -d \
  -v /var/log/myapp:/var/log/app:ro \
  -e MT_ENDPOINT=http://your-everyup-server:3001 \
  -e MT_API_KEY=mt_your_api_key \
  aiturn/everyup-log-agent:arm64
```

See [log-agent/README.md](log-agent/README.md) for more details.

---

## Documentation

| Document | Description |
|----------|-------------|
| [backend/README.md](backend/README.md) | Backend API and configuration reference |
| [frontend/README.md](frontend/README.md) | Frontend dev setup and page structure |
| [log-agent/README.md](log-agent/README.md) | Log agent deployment guide |

---

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/AI-turn/EveryUp/issues).

When submitting a Pull Request, please include a brief description of your changes.

---

## License

MIT
