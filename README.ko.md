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

### 1단계: Web 대시보드 실행

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
docker compose up -d
```

브라우저에서 `http://localhost:3001` 접속 → 관리자 계정 생성 → 완료.

> 포트를 바꾸거나 초기 계정을 미리 설정하려면 `.env.example`을 `.env`로 복사한 뒤 수정하세요.

### 2단계: Agent 추가 (선택)

Telegram 봇 토큰이 없으면 이 단계는 건너뛰세요.

`.env` 파일에 아래 두 줄을 추가합니다:

```bash
EVERYUP_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...   # BotFather에서 발급
EVERYUP_TELEGRAM_CHAT_IDS=123456789            # 알림 받을 채팅 ID
```

그 다음 Agent를 실행합니다:

```bash
docker compose --profile agent up -d
```

Agent가 뜨면 Telegram으로 "Agent started" 메시지가 도착합니다.

### 3단계: 서비스 모니터링 등록

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

## 저장소 구조

```text
everyup/
  web/
    backend/       # Go API 서버, SQLite, OTLP 수집, 알림 엔진
    frontend/      # React/Vite 대시보드
    Dockerfile     # Web 풀스택 이미지

  agent/           # 독립 실행 EveryUp Agent
    cmd/           # 실행 진입점
    internal/      # 핵심 패키지
    docs/          # Agent 기능별 상세 문서
    compose.example.yml

  docs/            # 운영 문서, 변경 이력, 로드맵
  docker-compose.yml
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
