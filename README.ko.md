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
  <a href="#수집되는-데이터">수집 항목</a> -
  <a href="#문서">문서</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24%2F1.25-00ADD8?logo=go" alt="Go 1.24 / 1.25">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
</p>

<p align="center">
  <img src="docs/images/everyup-main-ko.png" alt="EveryUp 대시보드" width="100%">
</p>

## EveryUp이 뭔가요?

EveryUp은 Docker로 실행 중인 서비스를 한곳에서 모니터링하는 셀프호스팅 도구입니다.
대시보드 서버에 **Web**을 한 번 띄우고, 모니터링할 서버마다 **Agent**를 하나씩
실행하면 끝입니다. 큰 관측 스택을 따로 세울 필요가 없습니다.

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Agent** | Docker 디스커버리, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 서버 |

## 핵심 기능

🟢 기본 제공 — 앱 코드 수정 없이 설치만으로 동작 · 🔵 선택 — 필요할 때 활성화

|  | 기능 | 설명 |
| :-: | --- | --- |
| 🟢 | 💓 헬스체크 | Docker 컨테이너 자동 발견, 실행 상태와 health |
| 🟢 | 🖥️ 인프라 | 호스트 CPU·메모리·디스크·네트워크 메트릭 |
| 🟢 | 📜 로그 | 컨테이너 stdout/stderr 수집 |
| 🟢 | 🌐 API 상태 | access log에서 읽은 요청 상태코드(method·path·status) |
| 🟢 | 🔔 알림 | Telegram·Discord·Slack 채널 |
| 🔵 | ⚡ API latency·트레이스 | eBPF 사이드카 — 앱 수정 없음 |
| 🔵 | 🔍 API 헤더·바디 | OpenTelemetry 계측 — 앱 재시작 한 번 |

## 빠른 시작

Web 1개와 Agent 1개를 Docker Compose로 실행하는 가장 작은 구성입니다.
단일 서버라면 둘을 같은 서버에서 실행해도 됩니다. Compose 템플릿은
[`web/docker-compose.yml`](web/docker-compose.yml)과
[`agent/docker-compose.yml`](agent/docker-compose.yml)에 있습니다.

### 1. Web 실행

대시보드 서버에서 `docker-compose.yml`을 작성합니다.

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

`http://WEB_SERVER_IP:3001`을 열고 첫 관리자 계정을 만들면 완료입니다.

### 2. Agent 키 만들기

대시보드에서 **Services**를 열고 **Add Project**를 누릅니다. 생성 후 표시되는
API 키(`evup_svc_...`)를 복사합니다.

### 3. 모니터링할 서버에 Agent 추가

모니터링할 서버의 Compose 파일에 `everyup-agent` 서비스를 추가합니다. 앱
컨테이너에는 아무 설정도 넣지 않습니다.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"   # Agent 컨테이너에서 접근 가능한 Web 주소
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"        # 2단계에서 복사한 키
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

```bash
docker compose up -d
```

약 30초 안에 Web에서 Agent가 online으로 표시되고, 그 서버의 컨테이너들이
자동으로 나타납니다. 문제가 생기면 [트러블슈팅](#트러블슈팅)을 참고하세요.

## 선택 기능

### eBPF 사이드카: API latency와 trace

기본 Agent는 access log에서 method, path, status를 읽습니다. 실제 latency와
trace까지 보려면 Agent Compose에 포함된 `everyup-ebpf` 사이드카를 켭니다.

1. `agent/docker-compose.yml`에서 `everyup-ebpf` 서비스 주석을 해제합니다.
2. `BEYLA_OPEN_PORT`에 앱이 listen하는 포트를 넣습니다. 예: `"80,3000,8080"`.
3. `docker compose up -d`를 다시 실행합니다.

앱 코드, Dockerfile, 앱 컨테이너를 바꾸지 않습니다. eBPF가 호스트의 프로세스를
관찰해 trace를 만들고, Agent가 각 span을 해당 Docker 서비스에 연결합니다.
Linux kernel 5.8+ 및 BTF가 필요합니다. 자세한 내용은
[agent/README.md](agent/README.md)의 "Zero-Code Tracing"을 참고하세요.

### OpenTelemetry 계측: 요청/응답 헤더·바디

요청이 실패한 이유까지 진단하려면 앱 측 OpenTelemetry 계측을 사용합니다. 앱을
한 번 재시작해야 하지만, Java와 Node.js는 코드나 Dockerfile을 고치지 않고
Compose override로 붙일 수 있습니다.

웹 UI에서 프로젝트를 열고 **OTel 계측 설정**을 실행하면 감지된 Java/Node.js
런타임에 맞춘 `docker-compose.everyup.yml`이 생성됩니다. 이 override로 앱을
다시 띄우면 요청/응답 헤더와 실제 latency가 포함된 trace를 수집합니다.

요청/응답 바디 자동 캡처는 현재 Node.js에서 지원됩니다. 바디는 앱 안에서
export 전에 마스킹되며, Web에서는 관리자만 볼 수 있고 열람 기록이 남습니다.
Java, Python, 수동 SDK는 마스킹된 body span event를 직접 추가할 수 있습니다.
전체 설정은 [OTel API 계측 가이드](docs/OTEL_API_INSTRUMENTATION.ko.md)를
참고하세요.

## 수집되는 데이터

### 기본 Agent

앱 수정 없이 수집됩니다. Agent는 Docker 소켓과 `/hostfs`를 읽기 전용으로
마운트합니다.

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태, 이벤트 | Docker 소켓 |
| stdout/stderr 로그 | `docker logs` |
| API 요청 method, path, status (latency 없음) | access log 파싱 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

API 상태코드는 앱이나 프록시가 access log를 stdout/stderr로 남길 때 표시됩니다.
access log가 없어도 컨테이너 상태, 일반 로그, 호스트 메트릭은 계속 수집됩니다.

### 선택: eBPF 사이드카

| 데이터 | 소스 |
| --- | --- |
| 실제 latency가 포함된 API trace | `everyup-ebpf` 사이드카(eBPF) |
| method, path, status, duration | 호스트 프로세스 관찰 |
| Go를 포함한 여러 언어와 HTTPS 서비스 | Grafana Beyla 기반 eBPF |

### 선택: 앱 측 OpenTelemetry 계측

| 데이터 | 소스 |
| --- | --- |
| 요청/응답 헤더 | `http.*.header.*` 스팬 속성 |
| 요청/응답 바디 | `*_body_masked` 스팬 이벤트 |
| 앱 메트릭(JVM 메모리, GC, 커스텀 카운터 등) | 앱 OTel -> Agent `:4318` |

## 트러블슈팅

**Agent가 online으로 뜨지 않습니다.**
`EVERYUP_WEB_BASE_URL`은 Agent 컨테이너 안에서 접근 가능한 Web 주소여야 합니다.
같은 서버라도 컨테이너 안의 `localhost`는 Web이 아니라 Agent 자신을 가리킬 수
있습니다. Compose 서비스명이나 호스트에서 접근 가능한 IP를 사용하세요.

**Agent가 Docker 소켓을 읽지 못합니다.**
권한 문제입니다. 가장 단순한 해결은 Agent 서비스에 `user: "0:0"`을 추가하는
것입니다. 운영 환경에서 소켓 접근 권한을 좁히려면
[Docker socket proxy 가이드](agent/docs/docker-socket-proxy.md)를 사용하세요.

**로그가 보이지 않습니다.**
컨테이너 안의 파일에만 쓰는 로그는 Docker 로그로 보이지 않으므로 Agent도 수집할
수 없습니다. 앱이나 프록시 로그를 stdout/stderr로 출력하세요.

**운영 배포 시 백업.**
`/app/data`를 백업하세요. `EVERYUP_ENCRYPTION_KEY`를 설정했다면 같은 64자 hex
키를 배포 secret과 함께 보관해야 합니다. 키 없이 데이터베이스 백업만으로는
암호화된 Agent 키나 알림 secret을 복원할 수 없습니다.
자세한 내용은 [백업·복원 가이드](docs/BACKUP_RESTORE.ko.md)를 참고하세요.

## 문서

| 문서 | 내용 |
| --- | --- |
| [web/README.md](web/README.md) | Web 설정, 환경변수, API 영역, 로컬 개발 |
| [agent/README.md](agent/README.md) | Agent 설정, 전체 환경변수 레퍼런스, Compose 설정 |
| [agent/docs/docker-socket-proxy.md](agent/docs/docker-socket-proxy.md) | 운영 환경의 더 엄격한 Docker socket 접근 구성 |
| [agent/docs/web-connected-mode.md](agent/docs/web-connected-mode.md) | Agent 등록과 Web 동기화 동작 방식 |
| [agent/docs/host-metrics.md](agent/docs/host-metrics.md) | 호스트 CPU, 메모리, 디스크, 네트워크 수집 세부사항 |
| [agent/docs/otel-collector.md](agent/docs/otel-collector.md) | Agent가 생성하는 선택적 OTel collector 설정 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram / Discord / Slack 채널 자격증명·설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | `/app/data` 디렉토리 백업·복원 |
| [docs/OTEL_API_INSTRUMENTATION.ko.md](docs/OTEL_API_INSTRUMENTATION.ko.md) | OpenTelemetry 계측으로 요청/응답 헤더·바디 수집(언어별) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 기능·리팩토링·버그픽스의 과거 이력 |

## 레퍼런스

**네트워킹.** Agent는 마운트된 Docker 소켓으로 컨테이너·로그에 접근하므로 자체
Compose 프로젝트에서도 동작합니다. 가장 깔끔한 구성은 `everyup-agent`를 그
서버의 앱 스택과 같은 Compose 파일에 두는 것입니다.

**저장소 구조**

```text
web/
  backend/                 # Go 1.24 API 서버, SQLite migration, OTLP ingest
  frontend/                # React 19 / Vite 대시보드
  docker-compose.yml       # Web 전용 Compose 템플릿
agent/
  cmd/                     # Agent entrypoint
  docs/                    # Agent 배포/운영 문서
  instrumentation/         # 앱 측 OTel helper 번들
  docker-compose.yml       # Agent Compose 템플릿
docs/                      # 사용자 문서, 백업/복원, 알림, OTel 가이드
docker-compose.yml         # 루트 편의용 Compose 파일 (Web 전용)
```

**개발**

소스 개발 사전 요구사항: Docker, pnpm, Web용 Go 1.24, Agent용 Go 1.25.

```bash
cd web/backend && go test ./...     # 백엔드 테스트
cd web/frontend && pnpm build       # 프론트엔드 빌드
cd agent && go test ./...           # 에이전트 테스트
```
