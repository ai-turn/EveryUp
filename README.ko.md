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
  <a href="#api-요청-수집-선택">API 모니터링</a> -
  <a href="#수집되는-데이터">수집 항목</a>
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

큰 관측 스택 없이도 내 서버의 Docker 서비스를 모니터링합니다. **서비스 health,
로그, API 요청, 인프라, 알림**을 하나의 Web 대시보드에서 보고, 각 서버에 가벼운
Agent 하나만 띄우면 됩니다.

- Docker 컨테이너 자동 디스커버리 — 서비스별 설정 불필요
- 애플리케이션 코드 수정 없이 stdout/stderr 로그 수집
- API 요청 데이터(method, path, status, duration)
- 호스트 CPU·메모리·디스크 메트릭
- Telegram, Discord, Slack 알림

EveryUp은 두 부분으로 구성됩니다:

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Agent** | Docker 디스커버리, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 서버 |

## 빠른 시작

> **Web**을 한 번 띄우고, 모니터링할 각 서버의 Compose 스택에 **Agent**를 추가하면
> 됩니다. Compose 템플릿은 [`web/`](web/docker-compose.yml)·[`agent/`](agent/docker-compose.yml)에도 있습니다.

### 1. Web 실행

대시보드 서버에서 `docker-compose.yml` 작성:

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

```bash
docker compose up -d
```

`http://WEB_SERVER_IP:3001`을 열고 첫 관리자 계정을 만듭니다.

### 2. Agent key 만들기

대시보드에서 **Services → Add**로 Agent를 생성하고, 표시되는 API 키(`evup_svc_…`)를
복사합니다 — 이 키는 Agent 전용입니다.

### 3. 모니터링할 서버에 Agent 추가

해당 서버의 `docker-compose.yml`에 `everyup-agent`를 추가합니다 (이미 앱 Compose
파일이 있으면 기존 서비스 옆에):

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"   # 이 서버에서 접근 가능한 주소
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"        # 2단계의 키
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

```bash
docker compose up -d everyup-agent
```

약 30초 안에 Agent가 online으로 뜨고, 같은 호스트의 다른 컨테이너를 자동으로
발견합니다. **컨테이너 health·로그·호스트 메트릭이 서비스별 설정 없이 바로
들어옵니다.** 요청별 API 데이터는 다음 섹션을 참고하세요.

## API 요청 수집 (선택)

요청별 데이터(method/path/status/duration)는 앱의 **OpenTelemetry 자동 계측**을
Agent의 텔레메트리 게이트웨이(`:4318`)로 보내 수집합니다. Linux/macOS/Windows
어디서나 동작하고, 앱에 API 키가 필요 없으며(Agent가 자기 키를 붙임),
**본문 없이 메타데이터만** 수집합니다.

**1. 앱 서비스에 아래 env 추가** (언어 무관, 동일):

```yaml
environment:
  OTEL_SERVICE_NAME: demo                              # ★ EveryUp에 보이는 서비스명과 반드시 일치
  OTEL_EXPORTER_OTLP_ENDPOINT: http://everyup-agent:4318
  OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
  OTEL_TRACES_EXPORTER: otlp
  OTEL_METRICS_EXPORTER: none
  OTEL_LOGS_EXPORTER: none
```

**2. 자동 계측 켜기** (애플리케이션 코드 0줄):

| 언어 | 방법 |
| --- | --- |
| **Java** (Spring Boot, Quarkus, …) | `opentelemetry-javaagent.jar` 마운트 + `JAVA_TOOL_OPTIONS=-javaagent:/otel/opentelemetry-javaagent.jar` |
| **Python** (FastAPI, Django, Flask) | `pip install opentelemetry-distro opentelemetry-exporter-otlp` → `opentelemetry-instrument python app.py`로 실행 |
| **Node.js** (Express, NestJS, …) | `npm i @opentelemetry/auto-instrumentations-node` → `NODE_OPTIONS=--require @opentelemetry/auto-instrumentations-node/register` |

전체 compose 예제와 그 외 언어(Ruby, .NET, PHP, Go):
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md).

**3. Agent에** `EVERYUP_API_CAPTURE_MODE: "otlp"`를 설정합니다 — stdout 액세스로그를
요청으로 중복 파싱하지 않게 (안 그러면 같은 요청이 2번 집계).

> **로그를 요청에 연결하기.** 로그에 trace id를 찍어두면 요청의 "로그에서 보기"
> 버튼이 해당 로그를 찾아줍니다. Spring Boot라면
> `LOGGING_PATTERN_LEVEL=%5p [%X{trace_id}/%X{span_id}]`를 추가하세요 — OTel
> 에이전트가 MDC를 자동으로 채웁니다.

## 수집되는 데이터

Agent만으로(1~3단계), Docker 소켓과 `/hostfs`에서:

| 데이터 | 출처 |
| --- | --- |
| 컨테이너 up/down·이름·이미지·상태·이벤트 | Docker 소켓 |
| stdout/stderr 로그 | `docker logs` |
| 호스트 CPU·메모리·디스크 | `/hostfs` 마운트 |
| API 요청 | stdout의 액세스로그 줄, **또는** OpenTelemetry(위) |

로그와 액세스로그 요청은 **stdout/stderr**에서 읽습니다 — 컨테이너 내부 파일에만
쓰는 서비스는 이 방식으로 볼 수 없습니다. 앱 로그(또는 리버스 프록시 액세스로그)를
stdout으로 출력하세요. 인식되는 액세스로그 형식:

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

이 모드는 애플리케이션 내부(DB 쿼리, 함수명, 전체 트레이스)는 보지 못합니다 —
OpenTelemetry로 계측해야 가능합니다.

## 레퍼런스

**네트워킹** — Agent는 마운트된 Docker 소켓으로 컨테이너·로그에 접근하므로, 자체
Compose 프로젝트에서도 동작합니다. 가장 깔끔한 구성은 `everyup-agent`를 그 서버의
앱 스택과 같은 Compose 파일에 두는 것입니다.

**저장소 구조**

```text
web/                       # Web — Go API + SQLite + React 대시보드
  docker-compose.yml
agent/                     # Agent — Docker 디스커버리, 로그, 호스트 메트릭
  docker-compose.yml
docker-compose.yml         # 루트 편의용 (Web 전용)
```

**개발**

```bash
cd web/backend && go test ./...     # 백엔드 테스트
cd web/frontend && pnpm build       # 프론트엔드 빌드
cd agent && go test ./...           # 에이전트 테스트
```
