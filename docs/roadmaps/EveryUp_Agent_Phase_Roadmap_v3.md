# EveryUp Agent 개발 전체 계획서

**개정판 v3 · MVP 재정렬본**

> Self-hosted Monitoring AI Agent · Docker Discovery + Local Alert + OpenTelemetry Sidecar + Telegram ChatOps + LLM Summary

---

## 목차

- [0. v2 대비 개정 요약](#0-v2-대비-개정-요약)
- [1. 제품 포지션](#1-제품-포지션)
- [2. 핵심 설계 원칙](#2-핵심-설계-원칙)
- [3. 운영 모드](#3-운영-모드)
- [4. 권장 아키텍처](#4-권장-아키텍처)
- [5. Phase 0에서 확정할 핵심 계약](#5-phase-0에서-확정할-핵심-계약)
- [6. MVP 범위 재정의](#6-mvp-범위-재정의)
- [7. 전체 Phase 요약](#7-전체-phase-요약)
- [8. Phase 상세 계획](#8-phase-상세-계획)
- [9. 복붙용 설치 예시](#9-복붙용-설치-예시)
- [10. 8주 개발 실행안](#10-8주-개발-실행안)
- [11. 주요 의사결정](#11-주요-의사결정)
- [12. 리스크 및 완화책](#12-리스크-및-완화책)
- [13. 최종 컨셉 문장](#13-최종-컨셉-문장)

---

## 0. v2 대비 개정 요약

v2는 제품 방향이 좋았지만 MVP에 들어간 기능이 많았다. v3는 MVP를 두 단계로 나누고, 기존 EveryUp Web이 이미 가진 OTLP/알림/룰 자산과의 접점을 초반에 명확히 한다.

| 항목 | v2 | v3 |
|---|---|---|
| MVP 범위 | Phase 0~6 전체: OTel, LLM, Telegram ChatOps까지 한 번에 포함 | **MVP-A / MVP-B로 분리.** 먼저 로컬 감시와 단방향 알림을 완성하고, 이후 OTel/LLM/ChatOps를 얹는다 |
| Web 연동 | Phase 10 후순위 | **Phase 0에서 계약만 먼저 확정.** 구현은 후순위지만 데이터 모델과 OTLP forward 방향은 초반에 고정 |
| OTel Collector | Agent가 config 자동 생성, 별도 컨테이너 | **로컬 수집/전처리/라우팅 계층으로 명확화.** Standalone에서는 로컬 알림, Connected에서는 EveryUp Web OTLP endpoint로 forward |
| Notifier | 새 Agent 인터페이스 중심 | 기존 EveryUp의 `AlertProvider`/채널 모델과 호환되는 **Agent Notifier 계약**으로 정의 |
| 보안 | 원칙 수준 | **명령 권한, 승인 flow, socket-proxy 옵션, secret masking**을 Phase 0 산출물에 포함 |
| 자동 조치 | Phase 6 `/restart` 후보 | 읽기 명령과 조치 명령을 분리. `/restart`는 MVP-B 이후 승인형 조치로 이동 |
| 일정 | 8주 안에 Phase 0~6 | 8주는 **MVP-A + MVP-B 일부**를 현실 목표로 설정 |

---

## 1. 제품 포지션

EveryUp Web은 사람이 보는 관제 화면이고, EveryUp Agent는 서버 옆에서 상태를 수집하고 장애를 설명하며 알림을 보내는 운영 에이전트다.

Agent는 Web을 대체하지 않는다. 기본은 중앙 서버 없이도 돌아가는 Standalone 모드이며, 나중에 EveryUp Web과 연결하면 이력 저장, 대시보드, 중앙 설정, 여러 Agent 관리까지 확장된다.

| 구분 | 역할 |
|---|---|
| EveryUp Web | 대시보드, 알림 정책, 장애 이력, 서비스/호스트 관리, OTLP 로그·트레이스 수신 |
| EveryUp Agent | Docker Compose 기반 설치, 로컬 discovery, health/resource/log 감시, Telegram 알림, LLM 요약, ChatOps 명령 응답 |
| 초기 차별점 | Prometheus/Grafana 같은 큰 스택 없이, 서버 옆에 붙여서 즉시 알림과 장애 설명을 받는 self-hosted AI agent |
| 장기 방향 | Standalone Agent → Connected Agent → Runbook/Memory 기반 운영 보조 에이전트 |

---

## 2. 핵심 설계 원칙

- **먼저 작동하고, 나중에 똑똑해진다.** LLM·ChatOps보다 로컬 감시와 안정적인 알림을 먼저 완성한다.
- **중앙 서버 없이도 쓸 수 있어야 한다.** Standalone 모드는 기본 기능의 기준선이다.
- **EveryUp Web과 충돌하지 않는다.** Agent는 Web의 OTLP/알림/이력 모델과 호환되게 설계한다.
- **OTel은 수집 표준, Agent는 판단 계층이다.** Collector는 metric/log/trace를 모으고, Agent는 알림 판단·요약·대화 UX를 담당한다.
- **알림은 절대 막히지 않는다.** Collector나 LLM이 실패해도 raw Telegram 알림은 나가야 한다.
- **AI는 처음에는 설명자다.** 자동 복구 실행은 기본 비활성이고, 승인형 조치로만 확장한다.
- **설정은 복붙 가능해야 한다.** docker-compose 블록 + `.env` 블록 + Docker label로 시작한다.
- **보안은 기능이다.** Docker socket, bot token, LLM 전송 데이터, ChatOps 명령 권한을 Phase 0에서 설계한다.

---

## 3. 운영 모드

| 모드 | 설명 | 초기 우선순위 |
|---|---|---|
| Standalone | Agent가 로컬에서 수집·판단·Telegram 알림까지 직접 수행. EveryUp Web 없이 동작 | 1순위 |
| Connected | Agent/Collector가 EveryUp Web의 OTLP endpoint와 Agent API로 데이터와 이력을 전송 | 2순위 |
| Hybrid | 로컬 알림은 Agent가 즉시 보내고, 이력/대시보드는 Web에 동기화 | 2순위 |
| Watchdog | 외부 heartbeat로 Agent/서버 자체 다운을 감지 | 후순위 |

---

## 4. 권장 아키텍처

```text
[대상 서버 / Docker Compose]

  app / nginx / db / redis
        │
        │ Docker label, health endpoint, logs, OTLP
        ▼
  ┌─ everyup-agent (Go) ───────────────────────────────┐
  │  · Docker discovery                                 │
  │  · health/resource/log alert 판단                   │
  │  · cooldown/recovery/dedup state                    │
  │  · Telegram notifier                                │
  │  · LLMProvider(OpenAI 호환)                          │
  │  · Telegram ChatOps 읽기 명령                        │
  │  · Collector config 생성/검증                        │
  │  · optional heartbeat ping                          │
  └─────────────────────────────────────────────────────┘
        │ shared config volume
        ▼
  ┌─ otel-collector (otelcol-contrib) ──────────────────┐
  │  · hostmetrics / docker_stats / filelog / otlp       │
  │  · local pipeline                                    │
  │  · optional forward to EveryUp Web OTLP endpoint      │
  └─────────────────────────────────────────────────────┘

[알림/대화] Telegram 우선, Discord/Slack은 후속
[선택 연동] EveryUp Web, external watchdog, local LLM
```

핵심은 Agent와 Collector를 분리하되, 둘을 하나의 설치 경험으로 제공하는 것이다. Agent는 config를 생성하고 검증하며, Collector는 표준 수집 파이프라인을 담당한다.

---

## 5. Phase 0에서 확정할 핵심 계약

### 5.1 Agent Notifier 계약

기존 EveryUp backend의 알림 모델과 호환되는 형태로 정의한다. Agent 내부에서는 `Notifier`라고 부르되, 메시지 타입과 severity, channel type은 Web의 `AlertProvider`/notification model과 맞춘다.

| 항목 | 방향 |
|---|---|
| 기본 채널 | Telegram |
| 후속 채널 | Discord, Slack, Webhook |
| 필수 메서드 | `SendAlert`, `SendRecovery`, `SendSystem`, `SendInteractionResponse` |
| 공통 필드 | alert type, severity, service/host, message, timestamp, metadata |
| 실패 정책 | retry + bounded queue. 큐가 꽉 차도 critical raw alert는 우선 전송 |

### 5.2 LLMProvider 계약

OpenAI 호환 chat completions 규격을 기준으로 한다.

| 항목 | 방향 |
|---|---|
| 설정 | `base_url`, `api_key`, `model`, `timeout`, `max_tokens` |
| 지원 대상 | OpenAI API, Ollama OpenAI-compatible endpoint, vLLM, LM Studio, llama.cpp server |
| 실패 정책 | timeout 이후 raw alert로 degrade |
| 출력 | 원인 후보, 근거, 조치 제안, 위험도, 확신도 |
| 금지 | 초기 버전에서 명령 자동 실행 금지 |

### 5.3 Collector Config 계약

Agent가 기본 config를 생성하고, 사용자는 override만 추가한다.

| 항목 | 방향 |
|---|---|
| 생성 위치 | shared volume: `/etc/everyup/generated/otel-config.yaml` |
| override 위치 | bind mount: `/etc/everyup/conf.d/*.yaml` |
| Collector mount | generated config는 read-only, conf.d도 read-only |
| 기본 receiver | otlp, hostmetrics, docker_stats, filelog |
| exporter | local debug/logging, optional OTLP/HTTP to EveryUp Web |

### 5.4 보안 계약

| 영역 | 원칙 |
|---|---|
| Telegram 권한 | chat_id allowlist 필수 |
| ChatOps 명령 | 읽기 명령과 조치 명령 분리 |
| 조치 명령 | 기본 비활성, allowlist + confirm token 필요 |
| Docker socket | 기본 read-only, 권장 옵션으로 docker-socket-proxy 제공 |
| Secret masking | bot token, API key, Authorization header, DB password, URL credential masking |
| 감사 로그 | ChatOps 명령, silence, 조치 승인/거절을 로컬에 저장 |

### 5.5 EveryUp Web 연동 계약

구현은 후순위지만 계약은 Phase 0에서 정한다.

| 항목 | 방향 |
|---|---|
| OTLP forward | Collector가 EveryUp Web `/api/v1/otlp`로 logs/traces를 전송 |
| Agent enrollment | 후속 Phase에서 token 기반 등록 |
| 서비스 매핑 | Docker label의 service name과 Web service를 매핑 |
| 이력 동기화 | incident, alert, command audit를 후속 API로 업로드 |

---

## 6. MVP 범위 재정의

### MVP-A: Local Alert Agent

첫 공개 가능한 최소 버전이다. LLM 없이도 운영 가치가 있어야 한다.

| 포함 | 제외 |
|---|---|
| Go Agent binary | LLM summary |
| Docker Compose 설치 | Telegram 양방향 ChatOps |
| Docker discovery | EveryUp Web enrollment |
| health check | 복잡한 OTel trace 분석 |
| host/container resource threshold | 자동 재시작 실행 |
| log keyword alert | Runbook/Memory |
| Telegram 단방향 알림 | 다중 채팅 플랫폼 |
| cooldown/recovery/dedup | 완전 Watchdog |
| local state volume |  |

### MVP-B: AI + OTel + Read-only ChatOps

MVP-A 위에 에이전트다운 경험을 얹는 단계다.

| 포함 | 제외 |
|---|---|
| otelcol-contrib sidecar | 자동 복구 실행 |
| generated collector config | 복잡한 skill system |
| optional OTLP forward to EveryUp Web | 장기 memory |
| LLM incident summary | 여러 Agent 중앙 관리 |
| Telegram `/status`, `/services`, `/logs`, `/explain`, `/silence` | `/restart` 기본 활성화 |
| command audit log |  |

### Beta: 승인형 조치와 Web 연동

MVP 이후 첫 고도화 버전이다.

| 포함 |
|---|
| `/restart` 같은 승인형 조치 명령 |
| Agent enrollment |
| Web으로 incident/alert history 동기화 |
| 기본 Runbook |
| external heartbeat/watchdog |

---

## 7. 전체 Phase 요약

| # | 이름 | 목표 | 산출물 |
|---|---|---|---|
| 0 | Product & Contracts | 제품 범위, 보안, Web 호환 계약 확정 | 컨셉 문서, interface spec, config schema, security policy |
| 1 | Agent Skeleton + Telegram | 실행 가능한 Agent와 단방향 알림 | Go binary, Dockerfile, env config, Telegram notifier |
| 2 | Docker Discovery + Local Checks | label 기반 서비스 발견과 기본 감시 | discovery module, health/resource/log checks |
| 3 | Local Alert State | cooldown/recovery/dedup과 로컬 상태 저장 | state store, alert engine v1, audit base |
| 4 | OTel Collector Sidecar | Collector 별도 컨테이너와 config 생성 | generated otel config, sidecar compose, optional forward |
| 5 | LLM Incident Summary | 장애 설명과 조치 제안 | LLMProvider, masking, summary schema |
| 6 | Read-only Telegram ChatOps | 채팅으로 상태 조회와 설명 | `/status`, `/services`, `/logs`, `/explain`, `/silence` |
| 7 | Approved Actions | 승인형 조치 명령 | confirm flow, `/restart`, action audit |
| 8 | Web Connected Mode | EveryUp Web과 연결 | enrollment API, service mapping, history sync |
| 9 | Runbook System | 장애 유형별 대응 절차 | YAML/Markdown runbook loader |
| 10 | Memory / Watchdog | 반복 장애 기억과 자기 감시 | SQLite incident memory, heartbeat/watchdog |

---

## 8. Phase 상세 계획

### Phase 0. Product & Contracts `[필수 선행]`

| 항목 | 내용 |
|---|---|
| 목표 | MVP-A/MVP-B 범위와 Agent/Web 호환 계약을 확정한다. |
| 주요 기능 | 운영 모드 정의, Notifier/LLMProvider/Collector Config 계약, Docker label schema, 보안 정책, Web 연동 방향 |
| 산출물 | 제품 컨셉, interface spec, config schema, Docker label spec, security policy, Quick Start 초안 |
| 성공 기준 | 무엇을 먼저 만들고 무엇을 미룰지 합의. Web과 Agent가 나중에 충돌하지 않을 계약 확보 |
| 주의사항 | 이 단계에서 구현 욕심을 내지 않는다. 계약과 경계를 고정하는 것이 목표다. |

### Phase 1. Agent Skeleton + Telegram `[MVP-A]`

| 항목 | 내용 |
|---|---|
| 목표 | Docker Compose에 Agent 하나를 추가해 시작 알림과 기본 health 실패 알림을 보낸다. |
| 주요 기능 | Go Agent 실행, env loader, config validation, Telegram sendMessage, startup/recovery/failure alert |
| 산출물 | `everyup-agent` binary, Dockerfile, compose 예시, `.env.example`, Telegram template |
| 성공 기준 | compose up 후 Telegram 시작 알림 수신. health check 실패 알림 수신 |
| 주의사항 | 이 시점부터 token masking과 chat_id allowlist를 적용한다. |

### Phase 2. Docker Discovery + Local Checks `[MVP-A]`

| 항목 | 내용 |
|---|---|
| 목표 | Docker label만으로 감시 대상을 자동 발견한다. |
| 주요 기능 | Docker socket read-only 연동, container list, label parsing, HTTP/TCP health check, host/container metric, log keyword scan |
| 산출물 | discovery module, label spec, local check runner |
| 성공 기준 | label만 추가해도 서비스가 자동 감시된다. CPU/memory/disk/log keyword 알림이 동작한다 |
| 주의사항 | Docker socket-proxy compose 예시를 함께 제공한다. |

### Phase 3. Local Alert State `[MVP-A]`

| 항목 | 내용 |
|---|---|
| 목표 | 알림 폭탄을 막고 장애/복구 흐름을 안정화한다. |
| 주요 기능 | cooldown, dedup fingerprint, recovery alert, silence, local state volume, command/audit base |
| 산출물 | alert engine v1, state store, recovery templates, audit log base |
| 성공 기준 | 반복 장애에서 알림 폭탄 없음. 복구 알림이 별도로 전송됨. 재시작 후에도 cooldown 상태 유지 |
| 주의사항 | SQLite 또는 작은 embedded store를 사용하되, 파일 손상 복구 전략을 둔다. |

### Phase 4. OTel Collector Sidecar `[MVP-B]`

| 항목 | 내용 |
|---|---|
| 목표 | otelcol-contrib를 별도 컨테이너로 띄우고 Agent가 기본 config를 생성·검증한다. |
| 주요 기능 | generated config, conf.d override, hostmetrics/docker_stats/filelog/otlp receiver, optional EveryUp Web OTLP forward |
| 산출물 | sidecar compose, generated config template, config validator, Web forward sample |
| 성공 기준 | Collector가 host/container/log/trace를 수집한다. Connected 모드에서 EveryUp Web OTLP endpoint로 전송 가능 |
| 주의사항 | Agent가 config를 생성할 수 있도록 shared volume 구조를 사용한다. |

### Phase 5. LLM Incident Summary `[MVP-B]`

| 항목 | 내용 |
|---|---|
| 목표 | 장애 알림에 원인 후보와 조치 제안을 추가한다. |
| 주요 기능 | incident context builder, masking, OpenAI-compatible LLMProvider, timeout/degrade, summary template |
| 산출물 | LLMProvider implementation, summary schema, prompt, masking tests |
| 성공 기준 | LLM 실패 시 raw alert가 즉시 나간다. 성공 시 원인 후보/근거/조치 제안이 함께 전송된다 |
| 주의사항 | LLM은 어떤 명령도 실행하지 않는다. |

### Phase 6. Read-only Telegram ChatOps `[MVP-B]`

| 항목 | 내용 |
|---|---|
| 목표 | Telegram에서 읽기 중심 명령으로 상태를 조회한다. |
| 주요 기능 | getUpdates long polling, chat_id allowlist, `/status`, `/services`, `/logs [svc] [n]`, `/explain [svc]`, `/silence [svc] [duration]` |
| 산출물 | command router, permission policy, command audit log |
| 성공 기준 | 대시보드 없이 채팅에서 현재 상태와 장애 설명을 조회할 수 있다 |
| 주의사항 | `/silence`는 운영 영향이 있으므로 audit와 duration 제한을 둔다. |

### Phase 7. Approved Actions `[Beta]`

| 항목 | 내용 |
|---|---|
| 목표 | 위험한 조치 명령을 승인형 flow로 제공한다. |
| 주요 기능 | action allowlist, confirm token, timeout, `/restart [svc]`, dry-run, rollback hint |
| 산출물 | action runner, approval flow, action audit |
| 성공 기준 | 승인 없이는 조치가 실행되지 않는다. 모든 조치가 감사 로그에 남는다 |
| 주의사항 | 기본값은 disabled다. |

### Phase 8. Web Connected Mode `[Beta]`

| 항목 | 내용 |
|---|---|
| 목표 | EveryUp Web과 Agent를 연결한다. |
| 주요 기능 | Agent enrollment, service mapping, incident/alert/audit sync, Web OTLP forward guide |
| 산출물 | enrollment API spec, sync client, Web integration doc |
| 성공 기준 | Standalone과 Connected를 모두 지원한다. 기존 EveryUp 대시보드에서 Agent 이력을 볼 수 있다 |
| 주의사항 | Web 연동이 Standalone 안정성을 깨면 안 된다. |

### Phase 9. Runbook System `[후속]`

| 항목 | 내용 |
|---|---|
| 목표 | 반복 장애 유형별 대응 절차를 재사용한다. |
| 주요 기능 | YAML/Markdown runbook, pattern matching, service type matching, risk level |
| 산출물 | runbook loader, 기본 runbook(HikariCP, Nginx 502, Disk Full, Container Restart) |
| 성공 기준 | 장애 유형별 설명과 조치 순서가 일관된다 |
| 주의사항 | auto_execute는 기본 false다. |

### Phase 10. Memory / Watchdog `[후속]`

| 항목 | 내용 |
|---|---|
| 목표 | 반복 장애를 기억하고 Agent/서버 자체 다운을 감지한다. |
| 주요 기능 | incident history, similar incident search, postmortem draft, external heartbeat/watchdog |
| 산출물 | SQLite schema, similarity matcher, watchdog endpoint |
| 성공 기준 | 현재 장애가 과거 어떤 장애와 유사한지 설명하고, 서버 다운도 외부에서 알림 가능 |
| 주의사항 | 장기 저장 데이터는 masking과 retention 정책이 필요하다. |

---

## 9. 복붙용 설치 예시

구현 시 확정할 예시다. v3에서는 Agent가 Collector config를 생성할 수 있도록 shared volume 구조를 명확히 한다.

**docker-compose.yml**

```yaml
services:
  everyup-agent:
    image: everyup/agent:0.1
    restart: unless-stopped
    environment:
      EVERYUP_MODE: standalone

      EVERYUP_TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      EVERYUP_TELEGRAM_CHAT_IDS: ${TELEGRAM_CHAT_IDS}

      EVERYUP_LLM_BASE_URL: ${LLM_BASE_URL:-}
      EVERYUP_LLM_API_KEY: ${LLM_API_KEY:-}
      EVERYUP_LLM_MODEL: ${LLM_MODEL:-}
      EVERYUP_LLM_TIMEOUT_SECONDS: ${LLM_TIMEOUT_SECONDS:-8}

      EVERYUP_WEB_OTLP_ENDPOINT: ${EVERYUP_WEB_OTLP_ENDPOINT:-}
      EVERYUP_WEB_API_KEY: ${EVERYUP_WEB_API_KEY:-}

      EVERYUP_HEARTBEAT_URL: ${HEARTBEAT_URL:-}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - everyup-data:/data
      - everyup-config:/etc/everyup/generated
      - ./everyup-conf.d:/etc/everyup/conf.d:ro
    depends_on:
      - otel-collector

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.110.0
    restart: unless-stopped
    command: ["--config=/etc/everyup/generated/otel-config.yaml"]
    volumes:
      - everyup-config:/etc/everyup/generated:ro
      - ./everyup-conf.d:/etc/everyup/conf.d:ro
      - /:/hostfs:ro
    ports:
      - "4317:4317"
      - "4318:4318"

volumes:
  everyup-data:
  everyup-config:
```

**.env**

```bash
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_IDS=123456789

# Local LLM example: Ollama OpenAI-compatible endpoint
LLM_BASE_URL=http://ollama:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1

# Optional: forward OTLP logs/traces to EveryUp Web
EVERYUP_WEB_OTLP_ENDPOINT=
EVERYUP_WEB_API_KEY=

# Optional: external heartbeat
HEARTBEAT_URL=
```

**Docker label 예시**

```yaml
services:
  api:
    image: my-api:latest
    labels:
      everyup.enabled: "true"
      everyup.service.name: "api"
      everyup.health.type: "http"
      everyup.health.url: "http://api:8080/health"
      everyup.alert.logs.keywords: "ERROR,FATAL,panic"
      everyup.alert.enabled: "true"
```

---

## 10. 8주 개발 실행안

8주는 MVP-A 완성 + MVP-B 핵심 일부를 현실 목표로 둔다.

| 기간 | 개발 항목 | 완료 기준 |
|---|---|---|
| 1주차 | Phase 0 계약 확정, repo 구조 결정, Agent skeleton, env config | interface/config/security spec 확정, Agent 실행 |
| 2주차 | Telegram notifier, startup/failure/recovery alert, token masking | Telegram 단방향 알림 안정 동작 |
| 3주차 | Docker discovery, label parser, HTTP/TCP health check | label만으로 서비스 자동 감시 |
| 4주차 | host/container metric, log keyword alert, local check runner | resource/log 알림 동작 |
| 5주차 | cooldown/dedup/recovery, state volume, silence base | 알림 폭탄 없음, 재시작 후 상태 유지 |
| 6주차 | OTel collector sidecar, generated config, conf.d override | Collector가 config로 정상 기동 |
| 7주차 | optional EveryUp Web OTLP forward, LLMProvider skeleton, masking | Web forward 샘플 동작, LLM 실패 시 raw alert 보장 |
| 8주차 | LLM summary 첫 버전, Quick Start 문서, 통합 테스트 | MVP-A 릴리스 + MVP-B preview |

Telegram read-only ChatOps는 8주 안에 여유가 있으면 `/status`와 `/services`만 preview로 넣고, `/logs`, `/explain`, `/silence`는 다음 마일스톤으로 넘긴다.

---

## 11. 주요 의사결정

| 항목 | 결정 |
|---|---|
| 기본 모드 | Standalone |
| MVP 분리 | MVP-A(Local Alert Agent), MVP-B(AI + OTel + read-only ChatOps) |
| Agent 언어 | Go |
| 알림 채널 | Telegram 우선 |
| LLM | OpenAI-compatible provider |
| OTel | otelcol-contrib sidecar |
| Web 연동 | 구현은 후순위, 계약은 Phase 0에서 확정 |
| 자동 조치 | MVP 제외. Beta에서 승인형 조치로 제공 |
| 상태 저장 | local persistent volume |
| 보안 | chat allowlist, secret masking, command audit, docker-socket-proxy 옵션 |

---

## 12. 리스크 및 완화책

| 리스크 | 완화책 |
|---|---|
| MVP 범위 과대 | MVP-A/B/Beta로 분리 |
| 기존 EveryUp 기능과 중복 | Phase 0에서 Web 호환 계약과 OTLP forward 방향 확정 |
| Docker socket 보안 | read-only 기본, docker-socket-proxy 권장 compose 제공 |
| 알림 폭탄 | cooldown/dedup/recovery를 MVP-A에 포함 |
| LLM 지연 또는 장애 | timeout + raw alert graceful degrade |
| 민감정보 노출 | masking pipeline과 테스트를 Phase 5 필수 산출물로 지정 |
| Collector config 생성 타이밍 | shared volume + Agent config validation + Collector restart policy |
| ChatOps 오남용 | allowlist, read-only first, action disabled by default |
| 상태 파일 손상 | 백업 가능한 local DB, corruption fallback, state rebuild |
| 8주 일정 압박 | 8주 목표를 MVP-A 릴리스 + MVP-B preview로 조정 |

---

## 13. 최종 컨셉 문장

> **EveryUp Agent**는 Docker Compose에 붙여 쓰는 self-hosted monitoring AI agent다. 서버 옆에서 Docker 서비스를 자동 발견하고 health, logs, metrics, traces를 수집해 로컬에서 즉시 알림을 판단한다. 장애가 발생하면 Telegram으로 복구 상태까지 알려주고, LLM이 가능한 환경에서는 원인 후보와 조치 제안을 함께 요약한다. EveryUp Web과 연결하면 OTLP 데이터와 장애 이력을 대시보드로 확장할 수 있다.
