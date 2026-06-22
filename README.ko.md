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

- 서비스가 다운되면 **Telegram으로 즉시 알림**
- 브라우저에서 **대시보드**로 상태/로그/알림 이력 확인
- Docker label만 붙이면 **서비스 자동 발견** (수동 등록 불필요)
- LLM 연동 시 장애 원인과 조치 방법을 **AI가 설명**

Prometheus + Grafana 같은 무거운 스택 없이, Docker Compose 하나로 바로 쓸 수 있습니다.

## 두 제품 구성

EveryUp은 두 부분으로 나뉩니다. **둘 중 하나만 써도 됩니다.**

| | EveryUp Web | EveryUp Agent |
|---|---|---|
| 역할 | 브라우저 대시보드, 알림 설정, 이력 저장 | 서비스 서버 옆에서 실시간 감시 + Telegram 알림 |
| 필요한 것 | Docker | Docker + Telegram 봇 |
| 서비스 등록 | Web UI에서 직접 추가 | Docker label만 붙이면 자동 발견 |
| 같이 쓰면? | Agent가 발견한 서비스를 Web 대시보드에서도 확인 가능 | |

처음 시작한다면 **Web만 먼저** 올리고, Telegram 알림이 필요해지면 Agent를 추가하는 것을 권장합니다.

## 사전 요구사항

- Docker 24+ 및 Docker Compose v2+
- (Agent 사용 시) Telegram 봇 토큰과 Chat ID → [Telegram 봇 만들기](docs/NOTIFICATION_SETUP.ko.md)

## 빠른 시작

사전 빌드된 이미지가 Docker Hub에 올라가 있어 **저장소를 클론할 필요가 없습니다** — Docker만 있으면 됩니다. Web과 Agent는 각각 별도 Compose 파일을 쓰므로, 필요한 쪽만 받으면 됩니다.

### 1. Web 대시보드 실행

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

브라우저에서 `http://localhost:3001` 접속 → 관리자 계정 생성 → 완료.

> 포트를 바꾸거나 초기 계정을 미리 설정하려면 env 템플릿을 받아 실행 전에 수정하세요:
> ```bash
> curl -o .env https://raw.githubusercontent.com/ai-turn/everyup/main/web/.env.example
> ```

### 2. Agent 실행 — Telegram 알림 (선택)

Agent는 모니터링할 서버에서 실행합니다 — Web 대시보드 서버와 **다른 서버**입니다. Telegram 봇 토큰이 필요합니다 → [봇 만들기](docs/NOTIFICATION_SETUP.ko.md). 해당 서버에서:

```bash
mkdir everyup-agent && cd everyup-agent
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/agent/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/ai-turn/everyup/main/agent/.env.example
```

`.env`를 열어 최소한 Telegram 값을 설정합니다:

```bash
EVERYUP_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...   # BotFather에서 발급
EVERYUP_TELEGRAM_CHAT_IDS=123456789            # 알림 받을 채팅 ID
```

(선택) Agent가 발견한 서비스를 Web 대시보드에도 표시하려면:

1. Web 대시보드 → **서비스** → **추가하기** 클릭 → 이름 입력 → API 키 복사 (`evup_svc_...`)
2. 같은 `.env`에 추가:

```bash
EVERYUP_WEB_SYNC_ENABLED=true
EVERYUP_WEB_BASE_URL=http://WEB_서버_IP:3001   # Web 서버 IP 또는 호스트명 (이 서버에서 접근 가능해야 함)
EVERYUP_AGENT_API_KEY=evup_svc_...             # 1번에서 복사한 키
```

실행:

```bash
docker compose up -d
```

Agent가 뜨면 몇 초 안에 Telegram으로 시작 메시지가 도착합니다. Web 연동을 켰다면 30초 안에 대시보드에 서비스가 온라인으로 표시됩니다.

### 3. 감시할 서비스 지정

감시할 컨테이너의 `docker-compose.yml`에 label을 추가합니다:

```yaml
services:
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
      everyup.service.name: "postgres"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"
```

label만 붙이면 Agent가 30초 안에 자동 발견합니다. Web UI에서 수동으로 등록할 필요 없습니다.

### 한 서버에 둘 다 (통합 Compose 파일)

Web + Agent를 한 머신에서 함께 돌리려면 통합 파일을 쓰세요. 같은 Docker 네트워크를 공유하므로 Agent가 `http://everyup:3001`로 대시보드에 자동 접근합니다 (IP 불필요):

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/ai-turn/everyup/main/.env.example   # agent용 Telegram 토큰 설정
docker compose up -d                    # web만
docker compose --profile agent up -d    # web + agent
```

> 소스에서 직접 빌드하려면 저장소를 `git clone`한 뒤 루트에서 동일한 `docker compose` 명령을 실행하세요.

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

**필수:**

| 변수 | 설명 |
| --- | --- |
| `EVERYUP_TELEGRAM_BOT_TOKEN` | BotFather에서 발급한 Telegram 봇 토큰 |
| `EVERYUP_TELEGRAM_CHAT_IDS` | 알림 받을 Telegram 채팅 ID (쉼표로 여러 개 지정 가능) |

**Web 연동** — Agent(모니터링 서버)와 Web 대시보드(별도 서버)를 연결할 때:

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Web 대시보드 연동 활성화 |
| `EVERYUP_WEB_BASE_URL` | _(비어 있음)_ | **이 서버**에서 접근 가능한 대시보드 URL (예: `http://192.168.1.10:3001`) |
| `EVERYUP_AGENT_API_KEY` | _(비어 있음)_ | Web UI → 서비스 → 추가하기에서 발급한 API 키 (`evup_svc_...`) |

**자주 쓰는 옵션:**

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EVERYUP_AGENT_NAME` | `everyup-agent` | Agent 표시 이름 |
| `EVERYUP_SERVICE_NAME` | `local-service` | Telegram 알림에 표시되는 서비스 이름 |
| `EVERYUP_HOST_CPU_PERCENT` | _(비활성)_ | CPU 알림 임계값 (0–100) |
| `EVERYUP_HOST_MEMORY_PERCENT` | _(비활성)_ | 메모리 알림 임계값 (0–100) |
| `EVERYUP_HOST_DISK_PERCENT` | _(비활성)_ | 디스크 알림 임계값 (0–100) |
| `EVERYUP_LLM_BASE_URL` | _(비어 있음)_ | AI 장애 요약을 위한 OpenAI 호환 API 주소 |
| `EVERYUP_LLM_API_KEY` | _(비어 있음)_ | LLM API 키 |
| `EVERYUP_LLM_MODEL` | _(비어 있음)_ | 사용할 LLM 모델명 |

전체 템플릿 (50개 이상 변수): [`agent/.env.example`](agent/.env.example)

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
| [agent/README.md](agent/README.md) | Agent 설치, Docker label, ChatOps, Web 연동 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | **Telegram 봇 만들기**, Discord, Slack 설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | 데이터 백업과 복원 |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API 요청 로그 수집 가이드 |
| [web/README.md](web/README.md) | Web 백엔드/프론트엔드 상세 |

## 라이선스

MIT
