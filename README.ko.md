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

거창한 관측 스택 없이도 내 서버의 Docker 서비스를 모니터링합니다. **서비스 health,
로그, API 요청, 인프라, 알림**을 하나의 Web 대시보드에서 보고, 각 서버에 가벼운
Agent 하나만 띄우면 됩니다.

- Docker 컨테이너 자동 디스커버리 — 서비스별 설정 불필요
- 애플리케이션 코드 수정 없이 stdout/stderr 로그 수집
- access log에서 파싱한 API 상태코드(method, path, status) — 프록시·코드 수정 불필요
- 호스트 CPU·메모리·디스크·네트워크 메트릭
- Telegram, Discord, Slack 알림
- 선택: 앱 측 OpenTelemetry로 요청/응답 **헤더**와 지원 런타임의 **바디 캡처** 수집 (옵트인)

EveryUp은 두 부분으로 구성됩니다:

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Agent** | Docker 디스커버리, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 서버 |

## 빠른 시작

> **Web**을 한 번 띄우고, 모니터링할 각 서버의 Compose 스택에 **Agent** 서비스
> 하나만 추가하면 됩니다. Agent는 읽기 전용이라 트래픽 변경이 필요 없습니다. Compose
> 템플릿은 [`web/`](web/docker-compose.yml)·[`agent/`](agent/docker-compose.yml)에도 있습니다.

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

> **운영 참고.** `/app/data`를 백업하세요. `EVERYUP_ENCRYPTION_KEY`를 설정했다면
> 같은 64자 hex 키를 배포 secret과 함께 보관해야 합니다. 데이터베이스 백업만으로는
> 일치하는 키 자료 없이 암호화된 Agent 키나 알림 secret을 복원할 수 없습니다.

### 2. Agent 키 만들기

대시보드의 **프로젝트** 화면(Services 페이지)에서 **프로젝트 추가**를 누릅니다.
생성 후 표시되는 API 키(`evup_svc_…`)를 복사하세요 — 이 키는 Agent 전용입니다.

### 3. 모니터링할 서버에 Agent 추가

Compose 서비스 하나로 컨테이너 health, stdout/stderr 로그, 호스트 메트릭, 그리고
**access log에서 파싱한 API 상태코드**를 얻습니다. 서비스별 설정도, 트래픽 가로채기도
없습니다 — Agent는 Docker 소켓을 *읽기만* 합니다.

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
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
docker compose up -d
```

호스트에서 Agent가 `/var/run/docker.sock`을 읽지 못한다면 `user: "0:0"`으로 실행하거나
[agent/docs/docker-socket-proxy.md](agent/docs/docker-socket-proxy.md)의 Docker socket proxy
패턴을 사용하세요.

약 30초 안에 Agent가 online으로 뜨고 모든 컨테이너를 자동 발견합니다 —
health·로그·호스트 메트릭·API 상태코드가 **앱 수정 없이** 들어옵니다.
(무엇이 어떻게 수집되는지는 아래 "수집되는 데이터" 참고.)

> **(선택) 레이턴시·전체 트레이스 — 여전히 앱 무수정.** Agent compose의
> `everyup-ebpf` 사이드카 주석을 해제하고, `BEYLA_OPEN_PORT`를 앱 포트로 설정한 뒤
> `docker compose up -d` 하세요. eBPF로 호스트의 서비스를 트레이싱합니다 — 전 언어(Go 포함),
> HTTPS까지 — 앱 재시작도 코드도 없이. Agent가 각 스팬을 알맞은 서비스에 자동 귀속시킵니다.
> [agent/README.md](agent/README.md)의 "Zero-Code Tracing" 참고.

### 4. (선택) 요청/응답 헤더·바디

앱을 건드리는 단계이며, 요청이 *왜* 실패했는지 진단할 수 있도록 더 풍부한 요청/응답
정보를 수집하는 방법입니다. Agent가 바로 쓸 수 있는 OpenTelemetry 번들(Java agent jar +
Node.js 부트스트랩)을 공유 볼륨에 실어 보냅니다. 웹 UI에서 프로젝트를 열고
**OTel 계측 설정**을 실행하면 감지된 Java/Node.js 런타임에 맞춘
`docker-compose.everyup.yml` 오버라이드가 생성됩니다. 그걸로 앱을 한 번만 재시작하세요.

번들 설정은 헤더와 실제 레이턴시가 포함된 전체 트레이스를 수집합니다. 자동 바디 캡처는
현재 Node.js에서 지원됩니다. Java, Python, 수동 SDK는 마스킹된 body span event를 명시적으로
추가할 수 있습니다. 바디는 앱 안에서 export 전에 마스킹되며 Web에서는 관리자 전용입니다
(열람은 감사 기록). 전체 안내와 스팬 계약, 언어별 참고는
[docs/OTEL_API_INSTRUMENTATION.ko.md](docs/OTEL_API_INSTRUMENTATION.ko.md) 참고.

## 수집되는 데이터

**자동으로, 모든 Agent에서 — 설정 없이, 읽기 전용** (Docker 소켓 + `/hostfs`):

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태, 이벤트 | Docker 소켓 |
| stdout/stderr 로그 | `docker logs` |
| API 요청 — method, path, status (latency 없음) | access log 파싱 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

**선택적 eBPF 사이드카로 — 여전히 앱 수정 없이:**

| 데이터 | 소스 |
| --- | --- |
| 실제 latency 포함 API 트레이스, 전 언어 + HTTPS | `everyup-ebpf` 사이드카(eBPF) |

**앱 재시작 1회로 (번들 OTel 계측):**

| 데이터 | 소스 |
| --- | --- |
| 요청/응답 헤더 | `http.*.header.*` 스팬 속성 |
| 요청/응답 바디 (Node 자동 캡처, 다른 런타임은 수동 span event; 마스킹, 관리자 전용) | `*_body_masked` 스팬 이벤트 |
| 앱 메트릭 — JVM 메모리, GC, 커스텀 카운터 | 앱 OTel → Agent `:4318` |

컨테이너 안의 파일에만 로그를 쓰는 서비스는 Agent가 볼 수 없습니다. 로그 수집을 위해
앱 로그를 stdout으로 출력하세요. API 상태코드는 앱이 access log(Nginx / Apache / 구조화
JSON)를 남겨야 보이며, 없어도 Agent는 health·로그·호스트 메트릭을 계속 수집합니다.

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

**네트워킹** — Agent는 마운트된 Docker 소켓으로 컨테이너·로그에 접근하므로, 자체
Compose 프로젝트에서도 동작합니다. 가장 깔끔한 구성은 `everyup-agent`를 그 서버의
앱 스택과 같은 Compose 파일에 두는 것입니다.

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
