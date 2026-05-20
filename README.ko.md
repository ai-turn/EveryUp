<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  업타임, 인프라, 로그, 알림을 하나로 묶은 가벼운 셀프 호스팅 모니터링 대시보드.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://ai-turn.github.io/everyup/">라이브 데모</a> ·
  <a href="#빠른-시작">빠른 시작</a> ·
  <a href="#문서">문서</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="라이브 데모"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT 라이선스">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
  <img src="https://img.shields.io/docker/pulls/aiturn/everyup" alt="Docker pulls">
</p>

<p align="center">
  <img src="docs/images/everyup-main-ko.png" alt="EveryUp 대시보드" width="100%">
</p>

EveryUp은 작은 팀과 셀프 호스팅 환경을 위해 서비스 업타임, 서버 리소스, 애플리케이션 로그, OpenTelemetry 트레이스, 알림 발송 상태를 한 곳에서 볼 수 있게 해줍니다. Go 바이너리와 SQLite로 동작하므로 Prometheus, Grafana, Elasticsearch, 관리형 클라우드 스택 없이 배포할 수 있습니다.

## 왜 EveryUp인가요?

- **하나의 대시보드** - 헬스체크, 인프라 메트릭, 로그, API 요청 인스펙터, 알림을 함께 봅니다.
- **셀프 호스팅 기본값** - 모니터링 데이터가 내 인프라 밖으로 나가지 않습니다.
- **단순한 운영** - 하나의 컨테이너, 하나의 SQLite 파일, 최초 실행 시 자동 생성되는 시크릿으로 시작합니다.
- **OpenTelemetry 친화적** - 기존 SDK나 자동 계측에서 OTLP 로그와 트레이스를 바로 받을 수 있습니다.

## 가벼운 용량

| | 크기 |
| --- | --- |
| Go 서버 바이너리 (`linux/amd64`, stripped) | **~21 MB** |
| 프론트엔드 번들 (Go 바이너리가 직접 서빙) | **~7 MB** |
| 런타임 컨테이너 이미지 (Alpine 베이스) | **~40 MB** |
| 영속 데이터 | `/app/data`의 SQLite 파일 한 개 |
| 필요한 외부 서비스 | **없음** - Prometheus, Grafana, Elasticsearch, Kafka, Redis 모두 불필요 |

`linux/amd64`와 `linux/arm64` 멀티아키 이미지를 같이 배포하므로, 일반 VM이든 ARM 머신이든 동일한 이미지를 그대로 사용할 수 있습니다.

## 운영 중인 서비스의 OpenTelemetry 도입

이미 OpenTelemetry를 쓰는 서비스라면 EveryUp은 그냥 또 하나의 OTLP 엔드포인트입니다. 아직 안 쓴다면, 아래 자동 계측을 통해 애플리케이션 코드를 건드리지 않고 켤 수 있습니다.

- **Spring Boot** - `opentelemetry-javaagent.jar`를 붙이고 환경변수 4개만 설정. Logback / Log4j / SLF4J 출력이 trace 컨텍스트와 함께 전달됩니다.
- **Python (FastAPI, Django, Flask)** - `pip install opentelemetry-distro` 후 `opentelemetry-instrument`로 실행. 표준 `logging` 레코드가 그대로 수집됩니다.
- **Node.js (Express, Fastify, NestJS)** - `@opentelemetry/auto-instrumentations-node`를 `--require`로 등록. Pino / Winston / console 로그가 span 컨텍스트와 함께 전달됩니다.
- **OTLP/HTTP 호환 소스** - 컬렉터, 사이드카, 커스텀 SDK 어디서 보내든 수신기에서 받습니다.

운영 서비스 도입은 보통 환경변수 변경과 재시작 한 번이면 끝입니다.

## 주요 기능

| 영역 | 제공 기능 |
| --- | --- |
| **업타임 모니터링** | HTTP/TCP 체크, 업타임 이력, 레이턴시 추이, 장애 감지 |
| **인프라 메트릭** | 로컬 또는 SSH 원격 호스트의 CPU, 메모리, 디스크, 네트워크, 프로세스 모니터링 |
| **로그와 트레이스** | 통합 로그 뷰어, 레벨 필터, 키워드 검색, OTLP/HTTP 수집 |
| **API 요청 인스펙터** | OpenTelemetry SERVER span 기반 요청/응답 가시화, 마스킹, 샘플링 제어 |
| **알림** | Telegram, Discord, Slack, Webhook 채널과 임계값 기반 규칙 |
| **실시간 업데이트** | WebSocket 기반 메트릭 스트리밍 |

## 빠른 시작

가장 빠른 방법은 Docker Compose입니다. 처음 실행한 뒤 브라우저에서 관리자 계정을 만들면 됩니다. 암호화 키와 JWT 시크릿은 자동 생성됩니다.

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "3001:3001"
    volumes:
      - everyup-data:/app/data
    restart: unless-stopped

volumes:
  everyup-data:
```

```bash
docker compose up -d
```

`http://localhost:3001`로 접속합니다.

Docker 명령 한 줄로 실행하려면:

```bash
docker run -d --name everyup -p 3001:3001 -v everyup-data:/app/data aiturn/everyup:latest
```

EveryUp Docker 이미지는 `linux/amd64`와 `linux/arm64`를 지원합니다.

## 설정

대부분의 설치는 별도 설정 파일 없이 시작할 수 있습니다. 포트 변경, 관리자 계정 사전 생성, 데이터베이스 위치 변경, 타임존 지정이 필요할 때만 환경 변수를 사용하세요.

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EVERYUP_SERVER_MODE` | `production` | 실행 모드: `development` 또는 `production` |
| `EVERYUP_SERVER_PORT` | `3001` | HTTP 서버 포트 |
| `EVERYUP_SERVER_ALLOWORIGINS` | 동일 오리진 | 분리 배포된 프론트엔드용 CORS 오리진 |
| `EVERYUP_ADMIN_USERNAME` | 미설정 | 시작 시 관리자 계정 생성 또는 비밀번호 초기화 |
| `EVERYUP_ADMIN_PASSWORD` | 미설정 | 위 관리자 계정의 비밀번호 |
| `EVERYUP_DATABASE_PATH` | `./data/monitoring.db` | SQLite 데이터베이스 경로 |
| `TZ` | 시스템 기본값 | 컨테이너 타임존, 예: `Asia/Seoul` |

> `EVERYUP_ADMIN_USERNAME`과 `EVERYUP_ADMIN_PASSWORD`를 함께 설정하면 EveryUp은 시작할 때마다 해당 계정을 생성하거나 비밀번호를 재설정합니다. 의도한 경우가 아니라면 초기 설정 후에는 비워 두는 편이 좋습니다.

## OpenTelemetry 수집

**로그 -> 서비스 상세 -> Integration**에서 API 키를 만든 뒤 OpenTelemetry exporter를 EveryUp으로 지정합니다.

```bash
export OTEL_SERVICE_NAME="my-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://your-everyup-server:3001/api/v1/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer everyup_your_api_key"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
```

OTLP/HTTP 수신기는 `/api/v1/otlp/v1/logs`와 `/api/v1/otlp/v1/traces`를 지원합니다.

<sub>메트릭(`OTEL_METRICS_EXPORTER`)은 아직 지원하지 않습니다 — 설정하지 않거나 `none`으로 두세요.</sub>

## 데이터 백업

EveryUp의 애플리케이션 데이터는 하나의 SQLite 데이터베이스 파일에 저장됩니다.

```bash
docker cp everyup:/app/data/monitoring.db ./monitoring.db.bak
```

## 로컬 개발

사전 준비: [Go 1.24+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation).

```bash
git clone https://github.com/ai-turn/everyup.git
cd everyup
```

백엔드 실행:

```bash
cd backend
go run ./cmd/server
```

프론트엔드 실행:

```bash
cd frontend
pnpm install
pnpm dev
```

백엔드 테스트:

```bash
cd backend
go test ./internal/api/handlers/ -v
```

## 프로젝트 구조

```text
everyup/
├── backend/       # Go, Fiber, SQLite, WebSocket, collectors
├── frontend/      # React, Vite, TypeScript, Tailwind CSS
├── docs/          # 설정 가이드, 마이그레이션 노트, 제품 문서
└── docs/images/   # README와 문서 이미지
```

## 문서

| 문서 | 설명 |
| --- | --- |
| [backend/README.md](backend/README.md) | 백엔드 API, 설정, 아키텍처 메모 |
| [frontend/README.md](frontend/README.md) | 프론트엔드 설정, 환경 변수, 라우트 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram, Discord, Slack 설정 |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API 요청 로깅과 인스펙터 가이드 |
| [docs/OTEL_ONLY_MIGRATION.md](docs/OTEL_ONLY_MIGRATION.md) | OpenTelemetry 전용 수집 전환 노트 |

## 기여

버그 리포트와 기능 제안은 [GitHub Issues](https://github.com/ai-turn/everyup/issues)에 남겨주세요.

Pull Request를 열기 전에:

- 무엇을 왜 바꿨는지 설명해 주세요.
- 관련 백엔드 또는 프론트엔드 체크를 실행해 주세요.
- 하나의 PR에는 하나의 관심사만 담아 주세요.

## 라이선스

MIT
