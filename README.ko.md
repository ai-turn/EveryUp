# EveryUp — 셀프 호스팅 모니터링 대시보드

<img src="docs/images/ascci.png" alt="EveryUp — 셀프 호스팅 업타임 및 인프라 모니터링" width="480">

업타임 모니터링, 서버 메트릭, 로그 수집, 알림을 하나의 셀프 호스팅 대시보드에서.
Prometheus, Grafana, 클라우드 없이 — 단일 바이너리와 SQLite 파일만으로 실행됩니다.

[English](README.md) | **한국어**

[![Demo](https://img.shields.io/badge/Demo-live-brightgreen)](https://ai-turn.github.io/everyup/)
![License](https://img.shields.io/badge/license-MIT-blue)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![Docker Pulls](https://img.shields.io/docker/pulls/aiturn/everyup)

**[라이브 데모 보기 →](https://ai-turn.github.io/everyup/)**

---

## EveryUp을 선택하는 이유

대부분의 서버 모니터링 도구는 하나의 문제만 해결합니다. EveryUp은 업타임 체크, 인프라 메트릭, 로그 수집, 알림을 **단일 셀프 호스팅 바이너리**로 통합합니다 — Uptime Kuma + Grafana + 로그 수집기를 대체하는 경량 오픈소스 솔루션입니다.

- **외부 의존성 제로** — Go 바이너리 + SQLite, Docker가 실행되는 어디서나 동작
- **프라이버시 우선** — 모니터링 데이터가 내 인프라 밖으로 나가지 않음
- **하나의 대시보드** — 헬스체크, 서버 메트릭, 로그, 알림을 한 곳에서
- **무료 오픈소스** — MIT 라이선스, 몇 분 만에 셀프 호스팅 가능

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **업타임 모니터링** | HTTP/TCP 헬스체크, 업타임, 레이턴시 추적 |
| **인프라** | CPU/메모리/디스크/네트워크 실시간 수집 (로컬 + SSH 원격) |
| **API 요청 인스펙터** | 샘플링·서버사이드 마스킹·본문 검사가 가능한 요청/응답 단위 캡처 |
| **알림** | Telegram / Discord / Slack 채널 연동, 임계값 기반 규칙 |
| **로그 관리** | 통합 로그 뷰어, 검색, 로그 에이전트 수집 및 HTTP 요청/응답 인스펙터 |
| **실시간 스트리밍** | WebSocket 기반 메트릭 실시간 업데이트 |

---

## 스크린샷

![EveryUp 대시보드 — 헬스체크, 인프라, 알림 현황](docs/images/dashboard.png)

![로그인 페이지](docs/images/login.png)

![로그 에이전트 개요](docs/images/log-agent-overview.png)

---

## 빠른 시작

별도 설정이 필요 없습니다. 처음 실행 후 브라우저에서 관리자 계정을 직접 생성합니다. 암호화 키와 JWT 시크릿은 최초 실행 시 자동 생성됩니다.

`linux/amd64`와 `linux/arm64` 모두 지원합니다 — Docker가 플랫폼에 맞는 이미지를 자동으로 선택합니다.

### Docker

```bash
docker pull aiturn/everyup:latest
```

```bash
docker run -d \
  --name everyup \
  -p 3001:3001 \
  -v everyup-data:/app/data \
  aiturn/everyup:latest
```

### Docker Compose

**1.** `.env` 파일 생성 — 모든 항목은 선택 사항입니다. 기본값으로 충분하다면 이 파일 없이 진행해도 됩니다.

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

또는 변경이 필요한 항목만 직접 작성합니다:

```dotenv
# MT_SERVER_PORT=3001
# MT_ADMIN_USERNAME=admin
# MT_ADMIN_PASSWORD=changeme
# TZ=Asia/Seoul
```

> `MT_ADMIN_USERNAME`와 `MT_ADMIN_PASSWORD`를 함께 설정하면 EveryUp은 시작할 때마다 해당 관리자 계정을 생성하거나 비밀번호를 다시 설정합니다. 초기 계정을 미리 만들거나 비밀번호를 재설정하려는 경우가 아니라면, 최초 설정 이후에는 비워 두는 것을 권장합니다.

**2.** `docker-compose.yml` 생성:

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "${MT_SERVER_PORT:-3001}:3001"
    volumes:
      - everyup-data:/app/data
    env_file:
      - path: .env
        required: false
    restart: unless-stopped

volumes:
  everyup-data:
```

**3.** 시작:

```bash
docker compose up -d
```

**http://localhost:3001** 접속 후 관리자 계정을 생성합니다.

---

### 로컬 개발

**사전 준비:** [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation)

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
```

**백엔드**
```bash
cd backend
go run ./cmd/server
# → http://localhost:3001
```

> 로컬 개발 시 CORS 설정이 필요하면 `.env.example`을 `.env`로 복사하세요.
> - Linux / macOS: `cp .env.example .env`
> - Windows (PowerShell): `Copy-Item .env.example .env`
> - Windows (CMD): `copy .env.example .env`

**프론트엔드**
```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:5173
```

**백엔드 테스트 실행**
```bash
cd backend
go test ./internal/api/handlers/ -v
```

**프로젝트 구조**
```
everyup/
├── frontend/      # React + Vite + TypeScript + Tailwind CSS
├── backend/       # Go (Fiber) + SQLite + WebSocket
└── log-agent/     # Fluent Bit 기반 로그 수집 에이전트
```

---

## 설정

`MT_` 접두사 환경 변수로 `config.json`의 모든 값을 오버라이드할 수 있습니다.

| 환경 변수 | 기본값 | 설명 |
|-----------|--------|------|
| `MT_SERVER_MODE` | `production` | 실행 모드: `development` 또는 `production` |
| `MT_SERVER_PORT` | `3001` | 서버 포트 |
| `MT_SERVER_ALLOWORIGINS` | *(동일 오리진)* | 허용할 CORS 오리진 (예: `https://your-domain.com`) |
| `MT_ADMIN_USERNAME` | *(미설정)* | 시작 시 관리자 계정 생성 또는 비밀번호 초기화 |
| `MT_ADMIN_PASSWORD` | *(미설정)* | 위 계정의 비밀번호 |
| `MT_DATABASE_PATH` | `./data/monitoring.db` | SQLite 파일 경로 |
| `TZ` | 시스템 기본값 | 타임존 (예: `Asia/Seoul`) |

전체 설정 옵션은 [backend/README.md](backend/README.md)를 참고하세요.

---

## 데이터 백업

EveryUp의 모든 데이터는 SQLite 단일 파일에 저장됩니다.

```bash
# 볼륨 위치 확인
docker volume inspect everyup-data

# 로컬 머신으로 백업 (컨테이너 실행 중에도 가능)
docker cp everyup:/app/data/monitoring.db ./monitoring.db.bak
```

---

## 로그 에이전트

외부 서비스의 로그를 수집하여 EveryUp 대시보드로 전달하려면 해당 서버에 `everyup-log-agent`를 배포합니다.

**1. API 키 발급**

EveryUp 대시보드 → **헬스체크 → 서비스 상세 → Integration** 탭에서 API 키를 발급받습니다.

**2. 에이전트 실행**

```bash
docker pull aiturn/everyup-log-agent:latest
```

```bash
docker run -d \
  --name everyup-log-agent \
  -v /var/log/myapp:/var/log/app:ro \
  -e LOG_AGENT_ENDPOINT=http://your-everyup-server:3001 \
  -e LOG_AGENT_API_KEY=la_your_api_key \
  --restart unless-stopped \
  aiturn/everyup-log-agent:latest
```

`linux/amd64`와 `linux/arm64` 모두 지원합니다 — Docker가 플랫폼에 맞는 이미지를 자동으로 선택합니다.

자세한 내용은 [log-agent/README.md](log-agent/README.md)를 참고하세요.

---

## 문서

| 문서 | 설명 |
|------|------|
| [backend/README.md](backend/README.md) | 백엔드 API 및 설정 문서 |
| [frontend/README.md](frontend/README.md) | 프론트엔드 개발 환경 및 페이지 구조 |
| [log-agent/README.md](log-agent/README.md) | 로그 에이전트 배포 가이드 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | 텔레그램, 디스코드 & 슬랙 채널 설정 가이드 |

---

## 기여

버그 리포트나 기능 제안은 [GitHub Issues](https://github.com/ai-turn/everyup/issues)에 남겨주세요.

Pull Request를 보내실 때:
- 변경 사항과 이유를 간략히 설명해 주세요
- `go test ./internal/api/handlers/ -v` 실행 후 테스트 통과를 확인해 주세요
- 하나의 PR에는 하나의 관심사만 담아 주세요

---

## 라이선스

MIT
