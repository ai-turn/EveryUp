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

EveryUp은 직접 운영하는 Docker 서비스를 큰 관측성 스택 없이 모니터링할 수
있게 해주는 셀프호스팅 제품입니다.

EveryUp으로 할 수 있는 일:

- 서비스 상태, 로그, API 요청, 인프라, 알림 이력을 Web 대시보드에서 확인
- Agent가 Docker 컨테이너를 자동 발견
- 애플리케이션 코드를 바꾸지 않고 Docker stdout/stderr 로그 수집
- stdout access log에서 API 요청 요약 생성
- 호스트 CPU, 메모리, 디스크 모니터링
- Telegram, Discord, Slack 알림을 Web UI에서 설정

기본 설치 방식은 단순합니다. Web을 먼저 실행하고, 모니터링할 서버의 Docker
Compose 파일에 Agent 서비스를 하나 추가하면 됩니다.

## 빠른 시작

EveryUp은 두 부분으로 나뉩니다.

| 구성 요소 | 역할 | 실행 위치 |
| --- | --- | --- |
| Web | 대시보드, 사용자, 알림 규칙, 알림 채널, 이력 저장 | 대시보드 서버 |
| Agent | Docker 발견, 컨테이너 상태, 로그, API access log 파싱, 호스트 메트릭 | 모니터링할 각 서버 |

먼저 Web을 실행합니다. Web이 준비되면 대시보드에서 Agent key를 만들고,
모니터링할 서버의 Compose stack에 Agent 서비스를 추가합니다.

### 1. Web compose 파일 만들기

대시보드 서버에서 `docker-compose.yml`을 만듭니다.

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

Web을 실행합니다.

```bash
docker compose up -d
```

브라우저에서 `http://localhost:3001`을 열고 첫 관리자 계정을 만듭니다.
Web이 원격 서버에서 실행 중이라면 `http://WEB_SERVER_IP:3001`로 접속하세요.

### 2. Web에서 Agent key 만들기

Web 대시보드에서 **Services -> Add**로 이동해 Agent 항목을 만들고, 생성된
API key를 복사합니다. key는 보통 이렇게 생겼습니다.

```text
evup_svc_...
```

이 key는 Agent 전용입니다. 기존 backend나 frontend 서비스에는 넣지 않아도
됩니다.

### 3. 모니터링할 서버에 Agent 서비스 추가하기

모니터링할 서버의 `docker-compose.yml`에 `everyup-agent` 서비스를 추가합니다.
이미 애플리케이션용 Compose 파일이 있다면 기존 서비스 옆에 아래 서비스를
추가하면 됩니다.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

`EVERYUP_WEB_BASE_URL`은 이 서버에서 접근 가능한 Web 주소로 바꾸고,
`EVERYUP_AGENT_API_KEY`는 2단계에서 복사한 key로 바꿉니다.

Agent를 실행합니다.

```bash
docker compose up -d everyup-agent
```

약 30초 안에 Web에서 Agent가 online으로 표시됩니다. Agent는 같은 Docker
host의 컨테이너를 자동으로 발견합니다. 각 애플리케이션 서비스에 EveryUp
설정을 추가하지 않아도 됩니다.

### 4. (선택) API 요청 모니터링 켜기

컨테이너 health·로그·호스트 메트릭은 1~3단계만으로 동작합니다. 요청별 API
데이터(method/path/status/duration)까지 보려면, 모니터링할 앱에 **OpenTelemetry
자동 계측**을 붙여 Agent의 텔레메트리 게이트웨이(`:4318`)로 보내면 됩니다.
Linux/macOS/Windows 어디서나 동작하고, 앱에 API 키가 필요 없으며(Agent가 자기 키를
붙임), 본문 없이 메타데이터만 수집합니다.

아래 환경변수를 **앱 서비스**에 추가합니다 (언어 무관, 동일 세트):

```yaml
environment:
  OTEL_SERVICE_NAME: demo                              # EveryUp에 보이는 서비스명과 일치시킬 것
  OTEL_EXPORTER_OTLP_ENDPOINT: http://everyup-agent:4318
  OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
  OTEL_TRACES_EXPORTER: otlp
  OTEL_METRICS_EXPORTER: none
  OTEL_LOGS_EXPORTER: none
```

그다음 언어별로 자동 계측을 켭니다 (애플리케이션 코드 0줄):

#### Java — Spring Boot, Quarkus, Micronaut 등

1. 에이전트 jar 다운로드:
   ```bash
   curl -LO https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
   ```
2. 앱 서비스에 마운트 + 플래그 설정:
   ```yaml
   services:
     demo:
       environment:
         JAVA_TOOL_OPTIONS: "-javaagent:/otel/opentelemetry-javaagent.jar"
         # + 위 공통 환경변수
       volumes:
         - ./opentelemetry-javaagent.jar:/otel/opentelemetry-javaagent.jar:ro
   ```

#### Python — FastAPI, Django, Flask 등

1. 이미지에 추가 (Dockerfile / requirements):
   ```bash
   pip install opentelemetry-distro opentelemetry-exporter-otlp
   opentelemetry-bootstrap -a install
   ```
2. 래퍼로 앱 실행:
   ```yaml
   services:
     demo:
       command: ["opentelemetry-instrument", "python", "app.py"]   # 또는: opentelemetry-instrument uvicorn main:app --host 0.0.0.0
       environment:
         # 위 공통 환경변수
   ```

#### Node.js — Express, NestJS, Koa, Fastify 등

1. 이미지에 추가:
   ```bash
   npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
   ```
2. 앱 서비스에 register 훅 프리로드:
   ```yaml
   services:
     demo:
       environment:
         NODE_OPTIONS: "--require @opentelemetry/auto-instrumentations-node/register"
         # + 위 공통 환경변수
   ```

마지막으로 **Agent**에 `EVERYUP_API_CAPTURE_MODE=otlp`를 설정해 stdout 액세스로그를
요청으로 중복 파싱하지 않게 하세요 (안 그러면 같은 요청이 2번 집계됩니다).

그 외 언어(Ruby, .NET, PHP, Go)와 문제 해결:
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md).

### 선택 사항: compose 템플릿 다운로드

직접 작성하는 대신 저장소의 compose 파일을 내려받아 사용할 수도 있습니다.

```bash
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/agent/docker-compose.yml
```

## Compose만으로 관측 가능한 데이터

Agent 서비스만 추가하면 EveryUp은 다음 데이터를 수집할 수 있습니다.

| 데이터 | 수집 방식 |
| --- | --- |
| 컨테이너 up/down | Docker socket |
| 컨테이너 이름, 이미지, 상태 | Docker socket |
| Docker 이벤트 | Docker socket |
| stdout/stderr 로그 | `docker logs` |
| API 요청 요약 | stdout에 찍힌 access log |
| 호스트 CPU, 메모리, 디스크 | `/hostfs` mount |

이 방식은 애플리케이션 내부를 들여다보지는 않습니다. DB query, 함수명, 전체
trace tree까지 보려면 나중에 별도 계측이 필요합니다.

## 로그와 API 요청 수집

Agent가 볼 수 있는 로그는 아래 명령으로 확인할 수 있습니다.

```bash
docker logs <container-name> --tail 100
```

여기에 보이는 일반 애플리케이션 로그는 Web의 로그로 저장됩니다.

API 요청은 stdout에 method, path, status, duration이 포함된 access log가 있을
때 생성됩니다.

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

서비스가 로그를 컨테이너 내부 파일에만 쓰면 Docker가 그 로그를 보여줄 수
없고, compose-only 방식으로는 EveryUp도 수집할 수 없습니다. 애플리케이션이나
reverse proxy가 로그를 stdout으로 출력하도록 설정하세요.

요청별 API 데이터(method/path/status/duration)는 앱에 OpenTelemetry 자동 계측을
붙여서 수집합니다 — **빠른 시작의 4단계**를 참고하세요.

## Compose 파일

### Web 전용

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

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
    driver: local
```

## 저장소 구조

```text
.
  web/
    docker-compose.yml     # Web 전용 Compose 파일
    backend/               # Go API 서버, SQLite 저장소, telemetry 수집
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