<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  Docker 서비스를 위한 셀프호스팅 모니터링 대시보드와 가벼운 Agent.
</p>

<p align="center">
  <a href="README.md">English</a> -
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> -
  <a href="#빠른-시작">빠른 시작</a> -
  <a href="#compose-파일">Compose 파일</a> -
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

EveryUp은 직접 운영하는 서버의 서비스를 큰 관측성 스택 없이 모니터링할 수
있게 해주는 셀프호스팅 제품입니다.

EveryUp으로 할 수 있는 일:

- 서비스 상태, 로그, API 요청, 인프라, 알림 이력을 Web 대시보드에서 확인
- 가벼운 Agent로 Docker 컨테이너 자동 발견
- 애플리케이션 코드를 바꾸지 않고 Docker stdout/stderr 로그 수집
- 호스트 CPU, 메모리, 디스크 모니터링
- Telegram, Discord, Slack 알림을 Web UI에서 설정
- 이미 OpenTelemetry를 내보내는 앱을 위한 Agent 내장 OTLP/HTTP 게이트웨이

기본 설치 방식은 의도적으로 단순합니다. Docker Compose로 Web을 실행하고,
모니터링할 서버마다 Agent를 하나씩 실행하면 됩니다.

## 빠른 시작

EveryUp은 두 부분으로 나뉩니다.

| 구성 요소 | 역할 | 실행 위치 |
| --- | --- | --- |
| Web | 대시보드, 사용자, 알림 규칙, 알림 채널, 이력 저장 | 대시보드 서버 |
| Agent | Docker 발견, health check, 로그, 호스트 메트릭, OTLP 전달 | 모니터링할 각 서버 |

처음에는 Web만 먼저 실행해도 됩니다. 실제 서버 데이터를 수집하고 싶을 때
Agent를 추가하세요.

### 1. Web 시작하기

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

브라우저에서 `http://localhost:3001`을 열고 첫 관리자 계정을 만듭니다.

Web을 원격 서버에서 실행했다면 `http://WEB_SERVER_IP:3001`로 접속하세요.
이 주소는 Agent가 실행될 서버에서도 접근 가능해야 합니다.

### 2. Agent key 만들기

Web 대시보드에서 **Services -> Add**로 이동해 Agent 항목을 만들고, 생성된
API key를 복사합니다. key는 보통 이렇게 생겼습니다.

```text
evup_svc_...
```

이 key는 Agent 전용입니다. 기존 backend나 frontend 서비스에는 넣지 않아도
됩니다.

### 3. Agent 시작하기

모니터링할 서버에서 실행합니다.

```bash
mkdir everyup-agent && cd everyup-agent
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/agent/docker-compose.yml
```

`docker-compose.yml`을 열고 아래 값만 교체합니다.

```yaml
environment:
  EVERYUP_WEB_SYNC_ENABLED: "true"
  EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"
  EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
  EVERYUP_TELEMETRY_GATEWAY_ENABLED: "true"
```

그다음 Agent를 실행합니다.

```bash
docker compose up -d
```

약 30초 안에 Web에서 Agent가 online으로 표시됩니다.

Agent만 실행해도 read-only Docker socket을 통해 Docker 컨테이너 상태,
Docker 이벤트, stdout/stderr 로그, 호스트 메트릭을 수집할 수 있습니다.
기존 애플리케이션 컨테이너에는 EveryUp 관련 environment 설정을 추가하지
않아도 됩니다.

### 4. 모니터링할 서비스에 label 추가하기

EveryUp 서비스로 표시할 컨테이너에 Docker label을 추가합니다.

기본 liveness와 로그만 수집하는 경우:

```yaml
services:
  worker:
    image: my-worker:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "worker"
```

HTTP health check를 함께 쓰는 경우:

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.url: "http://api:8080/health"
```

TCP health check를 쓰는 경우:

```yaml
services:
  postgres:
    image: postgres:16
    labels:
      everyup.enabled: "true"
      everyup.service.name: "postgres"
      everyup.health.type: "tcp"
      everyup.health.port: "5432"
```

`everyup.enabled: "true"`만 있어도 기본 liveness 확인은 가능합니다.
응답 시간과 상태 코드를 포함한 active check가 필요할 때만
`everyup.health.url` 또는 `everyup.health.port`를 추가하세요.

## 네트워크 주의사항

Agent가 별도 Compose 파일에서 실행되더라도 Docker socket을 통해 컨테이너를
발견하고, 로그를 읽고, 기본 liveness를 확인할 수 있습니다.

다만 active HTTP check는 Agent에서 대상 서비스로 네트워크 접근이 가능해야
합니다. 예를 들어 `http://api:8080/health`는 Agent가 같은 Docker network에서
`api`라는 이름을 해석할 수 있을 때만 동작합니다.

자주 쓰는 방법:

- 애플리케이션 Compose 파일에 `everyup-agent` 서비스를 함께 넣기
- Agent를 애플리케이션과 같은 external Docker network에 붙이기
- `everyup.health.url`에 접근 가능한 host 또는 IP 주소 사용하기

## Compose 파일

### Web 전용

대시보드 서버에서 사용합니다.

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
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  everyup-data:
    driver: local
```

### Agent 전용

모니터링할 각 서버에서 사용합니다.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
      EVERYUP_TELEMETRY_GATEWAY_ENABLED: "true"
    expose:
      - "4318"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
    driver: local
```

Agent의 OTLP gateway는 같은 Compose network 안에서
`http://everyup-agent:4318`로 접근할 수 있습니다. network 밖의 애플리케이션이
Agent로 OTLP를 보내야 할 때만 `4318` 포트를 publish하세요.

## 저장소 구조

```text
.
  web/
    docker-compose.yml     # Web 전용 Compose 파일
    backend/               # Go API 서버, SQLite 저장소, OTLP 수집
    frontend/              # React 대시보드
  agent/
    docker-compose.yml     # Agent 전용 Compose 파일
    internal/              # Agent 구현
  docker-compose.yml       # 루트 편의용 Web 전용 Compose 파일
```

## 개발

Backend 테스트:

```bash
cd web/backend
go test ./...
```

Frontend 빌드:

```bash
cd web/frontend
pnpm build
```

Agent 테스트:

```bash
cd agent
go test ./...
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [agent/README.md](agent/README.md) | Agent 설치, Docker label, Web 연동 |
| [web/README.md](web/README.md) | Web 실행과 개발 정보 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram, Discord, Slack 알림 설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | 데이터 백업과 복원 |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | API 요청 로그 수집 가이드 |

## 라이선스

MIT