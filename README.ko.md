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
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24">
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
- 선택: 앱 측 OpenTelemetry로 요청/응답 **헤더·바디** 수집 (옵트인)

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

### 2. Agent key 만들기

대시보드에서 **Services → Add**로 Agent를 생성하고, 표시되는 API 키(`evup_svc_…`)를
복사합니다 — 이 키는 Agent 전용입니다.

### 3. 모니터링할 서버에 Agent 추가

Compose 서비스 하나로 컨테이너 health, stdout/stderr 로그, 호스트 메트릭, 그리고
**access log에서 파싱한 API 상태코드**를 얻습니다. 서비스별 설정도, 트래픽 가로채기도
없습니다 — Agent는 Docker 소켓을 *읽기만* 합니다.

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
docker compose up -d
```

약 30초 안에 Agent가 online으로 뜨고 호스트의 모든 컨테이너를 자동 발견합니다 —
health·로그·호스트 메트릭은 서비스별 설정 없이 곧바로 들어옵니다. 앱이 access log(Nginx
/ Apache / JSON)를 남기면 요청 method·path·status가 **API** 탭에 자동으로 표시됩니다
— 프록시도, 코드 수정도 없이. access log엔 latency가 없어 duration은 `—`로 보이고,
access log를 안 남기는 앱은 API 행만 안 뜰 뿐 나머지는 그대로 동작합니다(graceful degrade).

여기까지가 health·로그·호스트 메트릭·API 상태코드입니다 — **앱 수정 없이**.

> **선택 — 트레이스·latency·바디.** 실제 요청 latency, 전체 트레이스, 요청/응답
> **헤더·바디**는 Agent만으로는 수집되지 *않습니다*. 앱 측 OpenTelemetry가 필요합니다.
> 앱의 OTLP exporter를 Agent 게이트웨이로 향하게 하세요
> (`OTEL_EXPORTER_OTLP_ENDPOINT: http://everyup-agent:4318`). 이 단계를 안 해도 위의
> 것들은 그대로 동작합니다 — latency·트레이스·바디만 안 보일 뿐입니다. 자세한 내용은
> 아래 [API 헤더·바디](#api-헤더바디-선택) 참고.

## API 헤더·바디 (선택)

access log만 있으면 상태코드는 거저 얻습니다. 여기에 더해 실제 latency가 담긴 전체
트레이스와 요청/응답 **헤더·바디**까지 보고 싶다면 — 요청이 *왜* 실패했는지(문제의
payload, 빠진 필드)를 진단하려면 — 앱에 **OpenTelemetry**를 계측하세요.

> **현재 상태.** 트레이스와 latency는 표준 OTel 자동 계측만으로 동작합니다. 하지만
> **헤더·바디 수집은 아직 수동 계측이 필요합니다** — 바디를 스팬 이벤트로 직접 붙여야
> 합니다(언어별 문서 참고). 무계측 헤더·바디 수집(first-party SDK, eBPF)은 로드맵이며
> 아직 제공되지 않습니다.

앱이 (기록하기로 선택한 요청/응답 데이터를 담은) 스팬을 Agent의 OTLP 게이트웨이
`http://everyup-agent:4318`로 보냅니다. 추가 컨테이너도, 트래픽 가로채기도 없습니다.
언어별 설정은
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md) 참고.

- **서비스명 지정 불필요.** exporter를 게이트웨이로 향하게 하는 게 유일한 설정이고,
  그 주소는 모든 서비스가 동일합니다. `OTEL_SERVICE_NAME`을 설정할 필요가 없습니다:
  Agent가 커넥션의 source IP로 컨테이너의 Compose 서비스명을 찾아 각 페이로드에
  태깅하므로, 트레이스가 자동 디스커버리로 이미 만들어진 서비스 카드에 그대로 붙습니다.
  (host 네트워크 컨테이너나 다른 프록시를 거치는 앱은 고유 컨테이너 IP가 없으니,
  그 경우엔 `OTEL_SERVICE_NAME`을 직접 지정하면 그 값을 그대로 따릅니다.)

- API 탭의 요청이나 트레이스 링크가 달린 로그를 열면 **Trace** 패널에 스팬과
  **Captured bodies** 섹션이 보입니다. 바디는 **admin 전용** — 비admin에겐 가려지고,
  admin 열람은 모두 `audit_events`에 기록됩니다.
- 바디 포함 span은 7일 보존됩니다(`EVERYUP_RETENTION_BODYCAPTUREDAYS`). 시크릿·민감
  필드는 export 전에 계측 단계에서 마스킹하거나 빼세요.

> **중복 집계 주의.** 한 요청은 소스당 한 번 나타납니다. 어떤 서비스에 앱 측 OTel을
> 켜면 그 서비스의 access-log 기반 행도 *같은* 요청을 잡으므로, 요청 목록에 하나가 두 번
> 보일 수 있습니다. 서비스마다 한 소스만 쓰세요 — access log *또는* OTel.

> **로그를 요청에 연결.** 로그에 trace id를 출력하면 EveryUp이 트레이스된 요청과
> 애플리케이션 로그를 연결할 수 있습니다.

> **로드맵.** 무계측 헤더·바디 수집을 위한 first-party SDK와 에이전트 기반(eBPF) 수집이
> 예정되어 있습니다.

## 수집되는 데이터

**자동으로, 모든 Agent에서 — 설정 없이, 읽기 전용** (Docker 소켓 + `/hostfs`):

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태, 이벤트 | Docker 소켓 |
| stdout/stderr 로그 | `docker logs` |
| API 요청 — method, path, status (latency 없음) | access log 파싱 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

**앱에 OpenTelemetry를 계측한 경우에만** (선택):

| 데이터 | 소스 |
| --- | --- |
| API 요청 + 트레이스, 실제 latency 포함 | 앱 OTel → Agent `:4318` |
| 요청/응답 헤더·바디 | 앱 계측 단계에서 기록 |

컨테이너 안의 파일에만 로그를 쓰는 서비스는 Agent가 볼 수 없습니다. 로그 수집을 위해
앱 로그를 stdout으로 출력하세요. API 상태코드는 앱이 access log(Nginx / Apache / 구조화
JSON)를 남겨야 보이며, 없어도 Agent는 health·로그·호스트 메트릭을 계속 수집합니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [web/README.md](web/README.md) | Web 설정, 환경변수, API 영역, 로컬 개발 |
| [agent/README.md](agent/README.md) | Agent 설정, 전체 환경변수 레퍼런스, Compose 설정 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram / Discord / Slack 채널 자격증명·설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | `/app/data` 디렉토리 백업·복원 |
| [docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md) | OpenTelemetry 계측으로 요청별 API 수집(언어별) |
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
