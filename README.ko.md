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
- 호스트 CPU·메모리·디스크·네트워크 메트릭
- Telegram, Discord, Slack 알림

EveryUp은 두 부분으로 구성됩니다:

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Agent** | Docker 디스커버리, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 서버 |

## 빠른 시작

> **Web**을 한 번 띄우고, 모니터링할 각 서버의 Compose 스택에 **Agent + Proxy**를
> 추가하면 됩니다 — 한 스택으로 모든 기능이 켜집니다. Compose 템플릿은
> [`web/`](web/docker-compose.yml)·[`agent/`](agent/docker-compose.yml)에도 있습니다.

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

### 3. 모니터링할 서버에 Agent + Proxy 추가

이 Compose 한 묶음으로 **모든** EveryUp 기능이 켜집니다: 컨테이너 health·로그·호스트
메트릭(Agent) + API 요청·트레이스·요청/응답 바디(Proxy). 클라이언트 트래픽은
프록시로 들어와 앱으로 변형 없이 전달되고, 텔레메트리는 Agent의 OTLP 게이트웨이로
보내집니다.

```yaml
services:
  app:
    image: your-app:latest        # 당신의 애플리케이션
    # 포트 미게시 — 트래픽은 아래 everyup-proxy로 들어옵니다.

  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent  # 프록시가 everyup-agent:4318 로 접근
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

  everyup-proxy:
    image: aiturn/everyup-agent:latest   # 같은 이미지, 프록시 모드
    environment:
      EVERYUP_AGENT_MODE: "proxy"
      EVERYUP_PROXY_LISTEN_ADDR: ":8080"
      EVERYUP_PROXY_UPSTREAM_URL: "http://app:8080"        # ← 당신 앱의 서비스명:포트
      EVERYUP_PROXY_OTLP_ENDPOINT: "http://everyup-agent:4318"
      EVERYUP_PROXY_SERVICE_NAME: "app"                    # 이 트래픽이 표시될 서비스명
      EVERYUP_CAPTURE_ENABLED: "true"                      # 요청/응답 바디 캡처
      EVERYUP_CAPTURE_ROUTES: "/api/..."                   # 캡처할 라우트
      EVERYUP_CAPTURE_ON_STATUS: "400-599"                 # 에러 바디만; 전체는 "200-599"
      EVERYUP_CAPTURE_ON_SLOW_MS: "3000"                   # ...또는 이보다 느린 요청
      EVERYUP_CAPTURE_EXCLUDE_ROUTES: "/login,/auth,/payment,/upload"
    ports:
      - "8080:8080"     # 클라이언트는 프록시로; 프록시가 app:8080 으로 전달
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

```bash
docker compose up -d
```

약 30초 안에 Agent가 online으로 뜨고 호스트의 다른 컨테이너를 자동 발견합니다
(health·로그·호스트 메트릭은 서비스별 설정 없이 바로). 클라이언트를 앱 대신
프록시의 `:8080`으로 향하게 하면 **API 요청·트레이스·캡처된 바디가 대시보드에
나타납니다.** 이미 앞단에 nginx/TLS가 있다면 `8080` 게시 대신 그 upstream을
`everyup-proxy:8080`으로 지정하세요.

**바디 캡처 동작 방식**

- 바디는 `CAPTURE_ON_STATUS` **또는** `CAPTURE_ON_SLOW_MS` 에 맞는 요청만 보관합니다
  — 기본값은 에러(`400-599`)와 느린 요청. 정상 `200`도 요청·트레이스에는 뜨지만,
  `CAPTURE_ON_STATUS`를 `200-599`로 넓히지 않으면 **바디는 생략**됩니다.
- API 탭의 요청이나 트레이스 링크가 달린 로그를 열면 **Trace** 패널에 스팬과
  **Captured bodies** 섹션이 보입니다. 바디는 **admin 전용** — 비admin에겐 가려지고,
  admin 열람은 모두 `audit_events`에 기록됩니다.
- `CAPTURE_MASK_KEYS`의 시크릿은 best-effort로 마스킹되고, 바디 포함 span은 7일
  보존됩니다(`EVERYUP_RETENTION_BODYCAPTUREDAYS`). 민감 라우트는
  `CAPTURE_EXCLUDE_ROUTES`에 넣어두세요.

> **더 깊은 트레이스 (선택).** 프록시는 요청당 server span 1개를 만듭니다. 앱 내부
> 스팬(DB·외부 호출)까지 보려면 앱의 OpenTelemetry exporter를 `http://everyup-agent:4318`
> 로 향하게 하세요. 단, 앱 측 OTel과 프록시를 함께 쓰면 같은 요청이 요청 목록에 두 번
> 나타납니다.

> **로그를 요청에 연결.** 로그에 trace id를 출력하면 EveryUp이 프록시로 캡처한
> 요청과 애플리케이션 로그를 상관시킬 수 있습니다.

## 수집되는 데이터

기본 Agent는 Docker 소켓과 `/hostfs`에서 다음을 수집합니다.

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태, 이벤트 | Docker 소켓 |
| stdout/stderr 로그 | `docker logs` |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

proxy 모드 Agent를 앱 앞단에 두면 다음을 수집합니다.

| 데이터 | 소스 |
| --- | --- |
| API 요청 + 트레이스 | 인라인 HTTP 프록시 |
| 요청/응답 바디 | 프록시 캡처 정책 (기본: 에러/느린 요청) |

컨테이너 안의 파일에만 로그를 쓰는 서비스는 기본 Agent가 볼 수 없습니다.
로그 수집을 위해 앱 로그를 stdout으로 출력하세요.

## 문서

| 문서 | 내용 |
| --- | --- |
| [web/README.md](web/README.md) | Web 설정, 환경변수, API 영역, 로컬 개발 |
| [agent/README.md](agent/README.md) | Agent 설정, 전체 환경변수 레퍼런스, Compose 설정 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram / Discord / Slack 채널 자격증명·설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | `/app/data` 디렉토리 백업·복원 |
| [docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md) | OpenTelemetry 자동 계측으로 요청별 API 수집(언어별) |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | `request_id` / trace id로 로그-요청 연결 |
| [docs/OTEL_ONLY_MIGRATION.md](docs/OTEL_ONLY_MIGRATION.md) | 로그·트레이스는 OpenTelemetry OTLP/HTTP로만 수집 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 기능·리팩토링·버그픽스 이력 |

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
