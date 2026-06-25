<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  셀프호스팅 모니터링 대시보드 + Docker 서비스를 자동 감시하는 AI Agent.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> ·
  <a href="#빠른-시작">빠른 시작</a> ·
  <a href="#환경-변수-설정">환경 변수 설정</a> ·
  <a href="#저장소-구조">저장소 구조</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
</p>

<p align="center">
  <img src="docs/images/everyup-main-ko.png" alt="EveryUp 대시보드" width="100%">
</p>

## EveryUp이 뭔가요?

서버에서 운영 중인 서비스들을 한 곳에서 모니터링하는 셀프호스팅 도구입니다.

- 서비스가 다운되면 **Telegram/Discord/Slack 즉시 알림** — Web UI에서 설정
- 브라우저에서 **대시보드**로 상태/로그/알림 이력 확인
- Docker label만 붙이면 **서비스 자동 발견** (수동 등록 불필요)

Prometheus + Grafana 같은 무거운 스택 없이, Docker Compose 하나로 바로 쓸 수 있습니다.

## 두 제품 구성

EveryUp은 두 부분으로 나뉩니다. **둘 중 하나만 써도 됩니다.**

| | EveryUp Web | EveryUp Agent |
|---|---|---|
| 역할 | 브라우저 대시보드, 알림 규칙, 알림 채널, 이력 저장 | 서비스를 실시간 감시하고 health/메트릭을 Web으로 동기화 |
| 필요한 것 | Docker | Docker + EveryUp Web API 키 |
| 서비스 등록 | Web UI에서 직접 추가 | Docker label만 붙이면 자동 발견 |
| 알림 | 설정된 채널로 Telegram/Discord/Slack 발송 | 수집만 — 발송은 Web이 담당 |
| 같이 쓰면? | Agent가 발견한 서비스를 Web 대시보드에서도 확인 가능 | |

처음 시작한다면 **Web만 먼저** 올리고, 자동 발견과 서버 모니터링이 필요해지면 Agent를 추가하세요. 모든 알림 설정은 Web UI → 알림 메뉴에서 합니다.

## 사전 요구사항

- Docker 24+ 및 Docker Compose v2+
- (Agent 사용 시) Web UI에서 발급한 EveryUp Web API 키 (서비스 → 추가하기)
- (알림) Telegram 봇, Discord 웹훅, 또는 Slack 웹훅 → [알림 설정](docs/NOTIFICATION_SETUP.ko.md)

## 빠른 시작

사전 빌드된 이미지가 Docker Hub에 올라가 있어 **저장소를 클론할 필요가 없습니다** — Docker만 있으면 됩니다. Web과 Agent는 각각 별도 Compose 파일을 쓰므로, 필요한 쪽만 받으면 됩니다.

### 1. Web 대시보드 실행

`docker-compose.yml`을 만듭니다:

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "${EVERYUP_SERVER_PORT:-3001}:3001"
    volumes:
      - everyup-data:/app/data
    env_file:
      - path: .env
        required: false
    restart: unless-stopped

volumes:
  everyup-data:
    driver: local
```

```bash
docker compose up -d
```

브라우저에서 `http://localhost:3001` 접속 → 관리자 계정 생성 → 완료.

> 포트 변경이나 초기 계정 설정은 compose 파일과 같은 위치에 `.env`를 만드세요 ([환경 변수 설정](#환경-변수-설정) 참고).

### 2. Agent 실행 — 자동 발견 + 서버 모니터링 (선택)

Agent는 모니터링할 서버에서 실행합니다 — Web 대시보드 서버와 **다른 서버**입니다. API 키로 Web에 연결해, 수집한 health·이벤트·호스트 메트릭을 동기화하며 알림은 Web이 보냅니다. **해당** 서버에서 `docker-compose.yml`을 만듭니다:

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    env_file:
      - path: .env
        required: false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
    driver: local
```

Web 대시보드에 연결합니다:

1. Web 대시보드 → **서비스** → **추가하기** 클릭 → 이름 입력 → API 키 복사 (`evup_svc_...`)
2. compose 파일 옆에 `.env`를 만듭니다:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://WEB_서버_IP:3001   # 이 서버에서 접근 가능한 Web 대시보드 URL
EVERYUP_AGENT_API_KEY=evup_svc_...             # 1번에서 복사한 키
```

```bash
docker compose up -d
```

서비스가 30초 안에 대시보드에 온라인으로 표시됩니다. 누구에게 어떤 채널로 알릴지는 Web UI → 알림 메뉴에서 설정합니다.

### 3. 감시할 서비스 지정

감시할 컨테이너의 `docker-compose.yml`에 label을 추가합니다:

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"              # ← 이것만으로 충분: 컨테이너 실행 상태로 up/down 판정

  # 선택: health 엔드포인트를 주면 액티브 HTTP/TCP 프로브로 업그레이드
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.url: "http://api:8080/health"

  postgres:
    image: postgres:16
    labels:
      everyup.enabled: "true"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"
```

label만 붙이면 Agent가 30초 안에 자동 발견합니다. Web UI에서 수동으로 등록할 필요 없습니다. **label이 붙은 컨테이너는 각각 하나의 서비스 카드가 됩니다** (`EVERYUP_HEALTH_URL`을 설정하면 그 카드도 추가) — Agent 하나가 여러 서비스를 보고할 수 있습니다.

> **`everyup.enabled: "true"` 하나만 필수입니다.** 이것만 있으면 Agent가 Docker 컨테이너 상태(실행 중 vs 중지)로 liveness를 보고합니다 — health 엔드포인트 불필요. `everyup.health.url`(또는 `everyup.health.port`)을 추가하면 응답시간·상태코드까지 보는 액티브 HTTP/TCP 프로브로 업그레이드됩니다. `everyup.service.name`은 선택 — 생략하면 컨테이너 이름(이름이 없으면 12자 짧은 ID)이 쓰입니다.

### 한 서버에 둘 다 (통합 Compose 파일)

Web + Agent를 한 머신에서 함께 돌리려면 `docker-compose.yml` 하나로 구성합니다. 같은 Docker 네트워크를 공유하므로 Agent가 `http://everyup:3001`로 대시보드에 자동 접근합니다 (IP 불필요):

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "${EVERYUP_SERVER_PORT:-3001}:3001"
    volumes:
      - everyup-data:/app/data
    env_file:
      - path: .env
        required: false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    profiles:
      - agent
    depends_on:
      everyup:
        condition: service_healthy
    env_file:
      - path: .env
        required: false
    environment:
      EVERYUP_WEB_BASE_URL: "http://everyup:3001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-data:
    driver: local
  everyup-agent-data:
    driver: local
```

```bash
docker compose up -d                    # web만
docker compose --profile agent up -d    # web + agent
```

## 환경 변수 설정

Web과 Agent는 각각 독립된 `.env.example`을 사용합니다. 일반적으로 **서로 다른 서버**에 설치하므로 설정도 완전히 분리되어 있습니다.

### EveryUp Web

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EVERYUP_SERVER_PORT` | `3001` | 대시보드가 열리는 포트 |
| `EVERYUP_SERVER_ALLOWORIGINS` | _(비어 있음)_ | CORS 허용 출처 — 다른 도메인에서 API를 직접 호출할 때만 필요 |
| `EVERYUP_ADMIN_USERNAME` | _(미설정)_ | 시작 시 관리자 계정 자동 생성; 미설정 시 브라우저에서 직접 생성 |
| `EVERYUP_ADMIN_PASSWORD` | _(미설정)_ | 관리자 비밀번호 (최소 8자) |
| `EVERYUP_DATABASE_PATH` | `./data/monitoring.db` | SQLite 데이터베이스 경로 (컨테이너 내부) |
| `EVERYUP_ENCRYPTION_KEY` | _(자동 생성)_ | AES-256-GCM 64자리 hex 키; 미설정 시 첫 실행에 자동 생성·저장 |
| `TZ` | `Asia/Seoul` | 컨테이너 타임존 |

전체 템플릿: [`web/.env.example`](web/.env.example)

### EveryUp Agent

**Web 연동 (필수)** — Agent(모니터링 서버)와 Web 대시보드(별도 서버)를 연결할 때:

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Web 대시보드 연동 활성화 |
| `EVERYUP_WEB_BASE_URL` | _(비어 있음)_ | **이 서버**에서 접근 가능한 대시보드 URL (예: `http://192.168.1.10:3001`) |
| `EVERYUP_AGENT_API_KEY` | _(비어 있음)_ | Web UI → 서비스 → 추가하기에서 발급한 API 키 (`evup_svc_...`) |

**자주 쓰는 옵션:**

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EVERYUP_AGENT_NAME` | `everyup-agent` | Agent 표시 이름 |
| `EVERYUP_SERVICE_NAME` | `local-service` | `EVERYUP_HEALTH_URL` 타깃의 이름. Docker label 디스커버리만 쓸 땐 영향 없음 |
| `EVERYUP_HEALTH_URL` | _(비어 있음)_ | 직접 감시할 단일 HTTP URL (Docker label 불필요). **label 디스커버리를 쓸 땐 비워 두세요.** 설정하면 `EVERYUP_SERVICE_NAME` 이름의 서비스 카드가 하나 더 생깁니다. |
| `EVERYUP_HOST_CPU_PERCENT` | _(비활성)_ | CPU 알림 임계값 (0–100) |
| `EVERYUP_HOST_MEMORY_PERCENT` | _(비활성)_ | 메모리 알림 임계값 (0–100) |
| `EVERYUP_HOST_DISK_PERCENT` | _(비활성)_ | 디스크 알림 임계값 (0–100) |

> 알림(Telegram/Discord/Slack)은 Agent가 아니라 Web UI → 알림 메뉴에서 설정합니다.

전체 템플릿: [`agent/.env.example`](agent/.env.example)

## 저장소 구조

```text
everyup/
  web/
    backend/             # Go API 서버, SQLite, OTLP 수집, 알림 엔진
    frontend/            # React/Vite 대시보드
    Dockerfile           # Web 풀스택 이미지
    docker-compose.yml   # Web 전용 (사전 빌드 이미지)
    .env.example         # Web 설정 템플릿

  agent/                 # 독립 실행 EveryUp Agent
    cmd/                 # 실행 진입점
    internal/            # 핵심 패키지
    docs/                # Agent 기능별 상세 문서
    docker-compose.yml   # Agent 전용 (사전 빌드 이미지)
    .env.example         # Agent 설정 템플릿
    compose.example.yml  # 소스 빌드 / OTLP 컬렉터 템플릿

  docs/                  # 운영 문서, 변경 이력, 로드맵
  docker-compose.yml     # Web + Agent 통합 (단일 서버)
  .env.example
```

## 로컬 개발

소스를 직접 수정하거나 기여하려면 아래를 참고하세요.

**사전 준비:** [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation)

Web 백엔드 실행:

```bash
cd web/backend
go run ./cmd/server
```

Web 프론트엔드 실행 (다른 터미널):

```bash
cd web/frontend
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:5173` 접속.

Agent 테스트:

```bash
cd agent
go test ./...
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [agent/README.md](agent/README.md) | Agent 설치, Docker label, Web 연동 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | **Telegram 봇 만들기**, Discord, Slack 설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | 데이터 백업과 복원 |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API 요청 로그 수집 가이드 |
| [web/README.md](web/README.md) | Web 백엔드/프론트엔드 상세 |

## 라이선스

MIT
