<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  셀프호스팅 모니터링 Web과 Docker 서비스 옆에서 동작하는 경량 AI Agent.
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
  <img src="docs/images/everyup-main-ko.png" alt="EveryUp dashboard" width="100%">
</p>

EveryUp은 하나의 셀프호스팅 모니터링 대시보드에서 시작했지만, 이제는 두 제품 경계로 나뉩니다.

- **EveryUp Web**: 중앙 대시보드, API, SQLite 저장소, 알림 설정, OTLP 수집, 프론트엔드 UI.
- **EveryUp Agent**: Docker 서비스 옆에서 컨테이너를 자동 발견하고 health, logs, metrics, traces를 감시하며 Telegram ChatOps와 EveryUp Web 동기화를 제공하는 독립 에이전트.

## 저장소 구조

```text
everyup/
  web/
    backend/       # Go API 서버, SQLite 마이그레이션, OTLP 수집
    frontend/      # React/Vite 대시보드
    Dockerfile     # Web 풀스택 이미지

  agent/           # 독립 실행 EveryUp Agent
    cmd/
    internal/
    docs/
    compose.example.yml

  docs/            # 운영 문서, 변경 이력, 로드맵
  docker-compose.yml
  .env.example
```

모노레포이지만 Web과 Agent는 배포, 설치, 보안 모델이 다른 독립 실행 단위로 다룹니다.

## 빠른 시작

EveryUp Web은 Docker Compose로 시작하는 것을 권장합니다.

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
docker compose up -d
```

브라우저에서 `http://localhost:3001`을 열고 관리자 계정을 만듭니다.

포트, 초기 관리자 계정, 타임존, Agent enrollment token을 바꾸려면 `.env.example`을 `.env`로 복사한 뒤 수정하세요.

소스에서 Web 이미지를 빌드하려면:

```bash
docker build -f web/Dockerfile -t everyup:web-dev .
```

## EveryUp Agent

Agent는 선택 기능입니다. 내부망이나 Docker 호스트 안에서 서비스 가까이에 붙여 감시하고 싶을 때 추가합니다.

```bash
cd agent
go run ./cmd/everyup-agent
```

먼저 [agent/README.md](agent/README.md)를 보고, 필요한 기능별 문서를 이어서 확인하세요.

- [Docker label 설정](agent/docs/docker-labels.md)
- [Telegram ChatOps](agent/docs/chatops.md)
- [Web connected mode](agent/docs/web-connected-mode.md)
- [Runbooks](agent/docs/runbooks.md)
- [Incident memory와 watchdog](agent/docs/incident-memory.md)

## 로컬 개발

사전 준비: [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation).

Web 백엔드 실행:

```bash
cd web/backend
go run ./cmd/server
```

Web 프론트엔드 실행:

```bash
cd web/frontend
pnpm install
pnpm dev
```

Agent 테스트:

```bash
cd agent
go test ./...
```

## 문서

| 문서 | 설명 |
| --- | --- |
| [web/README.md](web/README.md) | Web 백엔드, 프론트엔드, Docker, 로컬 개발 |
| [agent/README.md](agent/README.md) | Agent 설치, Docker discovery, ChatOps, Web sync, 로컬 상태 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | 데이터 백업, 암호화 키 보관, 복원 절차 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram, Discord, Slack 알림 설정 |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API 요청 로그 수집과 확인 가이드 |
| [docs/roadmaps/EveryUp_Agent_Phase_Roadmap_v3.md](docs/roadmaps/EveryUp_Agent_Phase_Roadmap_v3.md) | Agent 제품 로드맵 |

## 라이선스

MIT
