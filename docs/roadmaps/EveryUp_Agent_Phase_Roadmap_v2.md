# EveryUp Agent 개발 전체 계획서

**개정판 v2 · 평가 반영본**

> Self-hosted Monitoring AI Agent · OpenTelemetry + Local Alert + Telegram ChatOps(양방향) + LLM(로컬/API)

---

## 목차

- [0. v1 대비 개정 요약](#0-v1-대비-개정-요약)
- [1. 제품 포지션](#1-제품-포지션)
- [2. 핵심 설계 원칙](#2-핵심-설계-원칙)
- [3. 권장 아키텍처](#3-권장-아키텍처)
- [4. 핵심 추상화 인터페이스](#4-핵심-추상화-인터페이스-phase-0에서-확정)
- [5. 전체 Phase 요약](#5-전체-phase-요약)
- [6. Phase 상세 계획](#6-phase-상세-계획)
- [7. MVP 범위 정의](#7-mvp-범위-정의-phase-06)
- [8. 복붙용 설치 예시](#8-복붙용-설치-예시-예시--구현-시-확정)
- [9. 8주 개발 실행안](#9-8주-개발-실행안-mvp-phase-06)
- [10. 주요 의사결정](#10-주요-의사결정-확정안)
- [11. 리스크 및 완화책](#11-리스크-및-완화책)
- [12. 최종 컨셉 문장](#12-최종-컨셉-문장)

---

## 0. v1 대비 개정 요약

원래 계획은 구조가 탄탄했으나, 요청하신 세 가지(쉬운·유연한 setup / OTel를 MVP에 / Telegram 양방향 + LLM)가 모두 Phase 3~6 이후로 밀려 있었다. 이 개정판은 핵심 추상화를 Phase 0에 두고, OTel·LLM·Telegram 양방향을 MVP(Phase 0~6) 안으로 끌어올렸다.

| 항목 | 기존 v1 | 개정 v2 |
|---|---|---|
| OTel Collector | Phase 3 / 4주차, Agent 내부에 임베디드 + supervisor | **MVP 편입.** compose의 별도 컨테이너로 분리, OTLP를 1일차부터 노출 |
| Telegram | Phase 6, Discord 우선 / 단방향 위주 | **MVP 편입.** 단방향(P1) → 양방향 ChatOps(P6). Telegram 1순위 |
| LLM | Phase 5에서 등장 | **Phase 0에서 OpenAI 호환 LLMProvider 인터페이스 확정** → 로컬/API 교체 |
| 알림 폭탄 방지 | Phase 4의 cooldown | **Phase 1 첫 알림 구현부터** cooldown/dedup 포함 |
| Agent 자기 죽음 | Phase 9 Watchdog만 | **MVP에 경량 dead-man's-switch(heartbeat) 옵션** + 완전 Watchdog은 P9 |
| 설치 유연성 | Collector config를 숨김 | 기본값 자동생성 + **override(conf.d 드롭인)**로 호환성 확보, 복붙 compose 제공 |
| 일정 | 6주 | **8주**(양방향 ChatOps 포함 현실화) |

---

## 1. 제품 포지션

EveryUp Web은 사람이 보는 관제 화면이고, EveryUp Agent는 서버 옆에서 상태를 수집하고 장애를 설명하며 알림을 보내는 운영 에이전트다. Agent는 Web을 대체하지 않고, Docker Compose에 가볍게 추가되는 self-hosted 버전으로 설계한다.

| 구분 | 정리 내용 |
|---|---|
| EveryUp Web | 대시보드, 알림 설정, 장애 이력 조회, 서비스 등록, 시각화 중심 |
| EveryUp Agent | Docker Compose 기반 설치, 로컬 수집, 직접 알림(Telegram), AI 장애 요약, Runbook 기반 조치 제안, 채팅 명령 응답 |
| 벤치마킹 방향 | Hermes Agent의 메시징 기반 운영·스킬·메모리·self-hosted 구조를 모니터링 특화로 재해석 |
| 초기 원칙 | 중앙 서버 필수 의존을 줄이고 Standalone Agent를 기본 모드로 제공 |

---

## 2. 핵심 설계 원칙

- **설치는 복붙으로.** 5줄 미만의 극단적 미니멀이 아니라, docker-compose 한 블록 + .env 한 블록으로 그대로 붙여 쓸 수 있어야 한다.
- **config를 숨기지 않는다.** 기본값은 자동 생성하되, 고급 사용자가 덮어쓰거나 확장할 통로(conf.d 드롭인, 볼륨 마운트)를 항상 둔다.
- **교체 가능한 추상화.** 알림 채널(Notifier)과 LLM(LLMProvider)은 인터페이스로 정의해, 구현을 바꿔도 설정만 바뀌게 한다.
- **OTel을 1급 시민으로.** metric/log/trace를 OpenTelemetry로 수집하고 OTLP를 처음부터 노출해 프로덕션 수준을 보장한다.
- **AI는 설명자, 행위자가 아니다.** 초기에는 요약·조치 제안까지만. 실행 명령은 allowlist + 승인 절차를 통과해야 한다.
- **알림은 절대 막히지 않는다.** LLM·Collector가 실패해도 raw 알림은 반드시 나간다(graceful degrade).
- **프라이버시 우선.** 로그·메트릭을 LLM에 보내기 전과 저장 전에 민감정보를 masking한다.
- **자기 자신도 감시한다.** Agent/서버가 죽는 상황은 외부 heartbeat(dead-man's-switch)로 보완한다.

---

## 3. 권장 아키텍처

기본형은 Agent가 직접 알림을 보내는 Standalone 구조다. Collector는 임베디드 supervisor 대신 compose의 별도 컨테이너로 분리해 업그레이드·디버깅을 쉽게 한다. 서버 자체 다운 감지는 외부 heartbeat 또는 Watchdog 옵션으로 보완한다.

```text
[대상 서버 / Docker Compose]

  app / nginx / db / redis              (사용자 서비스)
        │  health, logs, OTLP
        ▼
  ┌─ everyup-agent (Go) ──────────────────────────────┐
  │   · Docker discovery (label 기반, socket read-only) │
  │   · health check / host·container metric           │
  │   · Local Alert Engine (임계치·cooldown·recovery)   │
  │   · Notifier 인터페이스  → Telegram(우선)/Slack...  │
  │   · LLMProvider 인터페이스 → 로컬 LLM / LLM API     │
  │   · Telegram ChatOps (양방향: /status /explain ...) │
  │   · otel-config 자동 생성 + heartbeat(옵션)         │
  └────────────────────────────────────────────────────┘
        │ generated-otel-config.yaml
        ▼
  ┌─ otel-collector (otelcol-contrib, 별도 컨테이너) ──┐
  │   hostmetrics · docker_stats · filelog · otlp       │
  │   OTLP 수신: 4317(gRPC) / 4318(HTTP)                │
  └────────────────────────────────────────────────────┘

[알림/대화 채널]  Telegram(양방향) · Discord · Slack webhook
[선택 옵션]       External Watchdog · EveryUp Web · 중앙 AI 분석 서버
```

---

## 4. 핵심 추상화 인터페이스 (Phase 0에서 확정)

요청하신 유연성·호환성은 대부분 아래 세 가지 추상화에서 나온다. 구현 전에 인터페이스부터 못박는다.

| 인터페이스 | 역할 / 핵심 설계 |
|---|---|
| **Notifier** | 알림·대화 채널 추상화. `Send(message)`와 양방향 명령 수신을 표준화. Telegram을 1순위로 구현하고 Discord/Slack은 같은 인터페이스로 추가. 채널 전환은 env 설정만으로. |
| **LLMProvider** | OpenAI 호환 chat completions 규격으로 정의. `base_url + api_key + model` 세 값만 바꾸면 로컬(Ollama/vLLM/LM Studio/llama.cpp)과 호스티드 API(OpenAI 등)가 동일 코드로 동작. |
| **Collector Config** | Agent가 기본 `otel-config.yaml`을 자동 생성하되, 볼륨 마운트와 conf.d 드롭인으로 사용자가 receiver/exporter를 덮어쓰거나 확장 가능. |

---

## 5. 전체 Phase 요약

| # | 이름 | 핵심 목표 | 주요 산출물 |
|---|---|---|---|
| 0 | Product Definition & Interfaces | 방향·MVP 범위 확정 + Notifier/LLMProvider/Config 추상화 | 컨셉·인터페이스 명세, Quick Start |
| 1 | Standalone Agent + Telegram | Agent 하나 추가로 기본 감시 + Telegram 알림(단방향) + cooldown | 바이너리, Dockerfile, compose/.env |
| 2 | Docker Discovery | label 기반 서비스 자동 등록 | discovery 모듈, health target 자동생성 |
| 3 | OpenTelemetry Collector | otelcol-contrib 별도 컨테이너 + OTLP 노출 | generated-otel-config, override 메커니즘 |
| 4 | Local Alert Engine | 임계치·restart·log keyword·recovery·dedup | 룰 엔진, 복구 알림 로직 |
| 5 | LLM Incident Summary | OpenAI 호환 LLM으로 원인·조치 요약 | summary schema, 프롬프트, LLMProvider 구현 |
| 6 | Telegram ChatOps (양방향) | 채팅 명령으로 상태 조회·장애 설명 | 명령 핸들러, 권한 정책, 감사 로그 |
| 7 | Skill / Runbook System | 장애 유형별 대응 절차 재사용 | Runbook loader, 기본 skill |
| 8 | Memory / Incident History | 과거 장애 기억·비교 | SQLite history, postmortem 초안 |
| 9 | Optional Watchdog | 서버 자체 다운 감지 보완 | heartbeat endpoint, timeout 알림 |
| 10 | Web Version 연동 | EveryUp Web과 연결 | enrollment, 이력 동기화 |

> **MVP 범위 = Phase 0 ~ 6.** Phase 7~10은 후속.

---

## 6. Phase 상세 계획

### Phase 0. Product Definition & Core Interfaces `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | 제품 방향·설치 철학·MVP 범위를 확정하고, Notifier·LLMProvider·Config 추상화를 설계한다. |
| 주요 기능 | 제품 소개 문구 정의 · Standalone/Connected/Watchdog 모드 구분 · Notifier 인터페이스(채널 교체 가능) 정의 · LLMProvider 인터페이스(OpenAI 호환) 정의 · 설정 철학 확정(env + Docker label + config override) · 보안 원칙·자동 조치 제한 범위 정의 |
| 산출물 | 제품 컨셉 문서, 아키텍처 초안 · 인터페이스 명세(Notifier/LLMProvider/Config) · 복붙용 Quick Start(compose/.env) · MVP 기능 범위표 |
| 성공 기준 | 팀 내 '무엇을 만들고 안 만들지' 합의 · compose 설치 흐름 설명 가능 · 설계상 채널·LLM을 설정만으로 교체 가능함이 보장됨 |
| 주의사항 | 처음부터 중앙 서버·대시보드·자동 복구까지 넣으면 범위가 커진다. |

### Phase 1. Standalone Agent + Telegram Notifier `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | Docker Compose에 everyup-agent 하나만 추가해 기본 감시와 Telegram 알림(단방향)을 수행한다. |
| 주요 기능 | Go 기반 Agent 실행, 환경변수 기반 설정 · Notifier 인터페이스 위에 Telegram 구현(sendMessage) · HTTP health check, host CPU/Memory/Disk 체크 · Agent 시작/복구 알림 · cooldown·중복 방지(첫 구현부터 포함) · 옵션: dead-man's-switch(heartbeat URL ping) |
| 산출물 | everyup-agent 초기 바이너리, Dockerfile(multi-arch: amd64/arm64) · docker-compose 예시, .env 예시 · 기본 알림 템플릿 |
| 성공 기준 | compose up 후 Telegram으로 시작 알림 수신 · health check 실패·disk 임계 초과 알림 수신 · 반복 장애에서도 알림 폭탄이 없음 |
| 주의사항 | 서버 자체가 죽으면 Agent도 죽어 즉시 알림 불가 → heartbeat 옵션으로 보완. |

### Phase 2. Docker Discovery / Label 기반 자동 등록 `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | 사용자가 health target을 나열하지 않아도 Docker label로 서비스를 자동 발견한다. |
| 주요 기능 | Docker socket read-only 연동 · 컨테이너 목록 조회 · everyup.service / health path·port label 인식 · 서비스별 알림 enable/disable |
| 산출물 | label 규칙 문서 · 자동 discovery 모듈 · 서비스별 health target 생성 로직 |
| 성공 기준 | label만 추가해도 자동 감시 시작 · 웹 설정 없이 서비스 목록·health check 구성 |
| 주의사항 | Docker socket 마운트는 민감하므로 기본 read-only. 한 단계 더: docker-socket-proxy로 최소 권한만 노출. |

### Phase 3. Embedded OpenTelemetry Collector (별도 컨테이너) `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | otelcol-contrib를 compose의 별도 서비스로 띄우고 Agent가 config를 자동 생성·관리한다. OTLP를 1일차부터 노출. |
| 주요 기능 | otelcol-contrib 별도 컨테이너 실행 · Agent가 generated-otel-config.yaml 자동 생성 · receiver: hostmetrics·docker_stats·filelog·otlp · OTLP 수신: 4317(gRPC)/4318(HTTP) · config override: 볼륨 마운트 + conf.d 드롭인 |
| 산출물 | generated-otel-config.yaml · config override 메커니즘 · metric/log/trace 수집 기본 파이프라인 |
| 성공 기준 | Agent 연동으로 host/container metric 수집 · container log tail, 앱 OTLP trace 수신 · 사용자가 config를 덮어쓰거나 확장 가능 |
| 주의사항 | 임베디드 supervisor 대신 별도 컨테이너로 시작(업그레이드·디버깅 용이). 단일 컨테이너 편의 버전은 후순위 옵션. 콜렉터 이미지 태그는 핀 고정. |

### Phase 4. Local Alert Engine `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | 중앙 서버 없이 Agent가 직접 알림을 판단·전송한다(Phase 1의 cooldown을 룰 엔진으로 일반화). |
| 주요 기능 | 임계치 기반 알림, health 실패 알림 · container restart 감지, log keyword 감지 · cooldown, recovery 알림, 중복 방지 · 서비스별 알림 설정 |
| 산출물 | 알림 룰 엔진 · 알림 포맷(Notifier 공통) · cooldown 상태 저장(data 볼륨), 복구 알림 로직 |
| 성공 기준 | 장애·복구 알림이 분리됨 · 반복 장애에서 알림 폭탄 없음 · 서비스별 알림 설정 가능 |
| 주의사항 | 채널 토큰은 env로 관리하고 로그에 masking. 상태(cooldown/history)는 영속 볼륨 필요. |

### Phase 5. LLM Incident Summary `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | 단순 알림이 아니라 장애 원인 후보·조치 방법을 LLM이 요약해 전송한다. 로컬/API 교체 가능. |
| 주요 기능 | 장애 시 metric snapshot·최근 로그·컨테이너 상태·trace sample 수집 · masking 후 LLMProvider(OpenAI 호환)로 요약 요청 · 원인 후보/근거/조치 제안 생성 · LLM 실패·지연 시 raw 알림으로 graceful degrade(타임아웃 포함) |
| 산출물 | AI summary payload schema, 장애 요약 프롬프트 · 알림 메시지 템플릿 · LLMProvider 구현(OpenAI 호환), 기본 장애 유형 샘플 |
| 성공 기준 | 기존 알림보다 읽기 쉬운 설명 · 원인 후보 2~3개 + 근거 로그 + 조치 제안 · base_url/api_key/model 3개로 로컬↔API 전환 |
| 주의사항 | AI는 초기에는 실행 금지(요약·제안만). 호스티드 전송 전 masking 필수. LLM 장애가 알림을 막지 않게 한다. |

### Phase 6. Telegram ChatOps (양방향) `[MVP]`

| 항목 | 내용 |
|---|---|
| 목표 | Telegram에서 명령어로 상태 조회·장애 설명을 수행한다(양방향). |
| 주요 기능 | getUpdates 롱폴링 또는 webhook 수신 · `/status`, `/services`, `/logs [svc] [n]`, `/explain [svc]` · `/silence [svc] [duration]`, `/restart [svc]` 후보 · 명령 권한: chat_id allowlist, 조치 명령 승인 절차 · 명령 실행 감사 로그 |
| 산출물 | Telegram 명령 핸들러(interaction handler) · 명령 권한 정책 · 명령 실행 감사 로그 |
| 성공 기준 | 대시보드 없이 채팅에서 상태·로그·장애 요약 조회 · restart 같은 조치는 allowlist + 승인을 거침 |
| 주의사항 | 조치 명령은 allowlist와 승인 필요. 봇 토큰은 env로 관리하고 로그 masking. |

---

> **── 이하 Phase 7~10은 MVP 이후 후속 단계 ──**

### Phase 7. Skill / Runbook System `[후속]`

| 항목 | 내용 |
|---|---|
| 목표 | 반복 장애 유형을 Runbook Skill로 정의하고 재사용한다. |
| 주요 기능 | YAML/Markdown 기반 Runbook, 로그 패턴 매칭 · 서비스 타입별 skill 적용, 조치 단계·위험도 정의 · auto_execute 기본 false |
| 산출물 | 기본 Runbook: HikariCP, Nginx 502, Disk Full, Container Restart · Runbook loader, Skill matching engine |
| 성공 기준 | 장애 유형별 설명·조치 순서가 일관됨 · 사용자가 자체 Runbook 추가 가능 |
| 주의사항 | Runbook이 틀리면 잘못된 조치가 나가므로 검증 필요. |

### Phase 8. Memory / Incident History `[후속]`

| 항목 | 내용 |
|---|---|
| 목표 | 과거 장애와 현재 장애를 비교하고 반복 이슈를 기억한다. |
| 주요 기능 | SQLite 기반 local history(incidents/alerts/command_history) · known issue 관리, 과거 장애 유사도 비교 |
| 산출물 | 로컬 DB schema, incident timeline · postmortem 초안 생성, 유사 장애 비교 로직 |
| 성공 기준 | 현재 장애가 과거 어떤 장애와 유사한지 설명 · 복구 후 요약 리포트 생성 |
| 주의사항 | 장기 저장 시 로그 내 민감정보 masking 필요. |

### Phase 9. Optional Watchdog `[후속]`

| 항목 | 내용 |
|---|---|
| 목표 | Agent가 죽거나 서버가 꺼지는 상황을 외부 heartbeat로 보완한다(MVP의 경량 dead-man's-switch를 확장). |
| 주요 기능 | heartbeat URL 설정, 30초 단위 ping · timeout 감지, 서버 다운·복구 알림 |
| 산출물 | lightweight watchdog endpoint, heartbeat token · timeout alert template |
| 성공 기준 | Agent/서버 중단 시 외부에서 알림 가능 · Standalone 구조를 유지하면서 서버 다운 감지 제공 |
| 주의사항 | 완전한 중앙 모니터링 서버는 아니지만 외부 의존성이 생긴다. |

### Phase 10. Web Version 연동 `[후속]`

| 항목 | 내용 |
|---|---|
| 목표 | 기존 EveryUp Web과 연결해 설정·이력·대시보드 기능을 확장한다. |
| 주요 기능 | Standalone/Connected Mode 구분, Agent enrollment · 서비스 목록 동기화, 장애 이력 업로드 · 알림 정책 중앙 관리, 중앙 AI 분석 서버 연동 |
| 산출물 | EveryUp Web 연동 API, 프로젝트/서비스 매핑 · 웹 대시보드 연동 화면 |
| 성공 기준 | Agent 단독·Web 연동 운영 모두 지원 · 기존 웹버전 자산 재활용 |
| 주의사항 | 초기 MVP에 넣으면 범위가 커지므로 후순위. |

---

## 7. MVP 범위 정의 (Phase 0~6)

**MVP 목표:** Docker Compose에 everyup-agent + otel-collector 추가 → label로 서비스 자동 감시 → metric/log/trace 수집 → 장애 시 Telegram 알림 + LLM 요약 → Telegram 명령으로 상태 조회·장애 설명(양방향).

| 구분 | 내용 |
|---|---|
| **필수 포함** | Go Agent, Docker Compose 설치, Telegram 알림(단방향)+양방향 ChatOps, health check, container status, host metric, container log, OTLP/trace 수신, LLM 요약(로컬/API), cooldown/recovery |
| **초기 제외** | 자동 재시작 실행, 중앙 서버 필수 연동, Runbook/Memory, 복잡한 trace 분석, custom collector, 여러 채팅 플랫폼 동시 운영 |
| **기술 선택** | Agent=Go, 수집=otelcol-contrib(별도 컨테이너), 알림/대화=Telegram(Notifier 인터페이스), AI=OpenAI 호환 LLMProvider(로컬 LLM 또는 LLM API) |
| **설치 철학** | env + Docker label 중심. 사용자가 Collector 설정을 처음부터 직접 쓰지 않게 하되, 덮어쓰기 통로(override)는 항상 제공 |

---

## 8. 복붙용 설치 예시 (예시 — 구현 시 확정)

'5줄 미만 미니멀' 대신, 그대로 붙여 쓰고 필요한 곳만 바꾸는 형태. Agent + Collector 2개 컨테이너 구성. 변수는 `.env`로 분리한다.

**docker-compose.yml**

```yaml
services:
  everyup-agent:
    image: everyup/agent:0.1            # 태그 핀 고정 (latest 금지)
    restart: unless-stopped
    environment:
      # 알림/대화 채널 (Telegram, 양방향)
      EVERYUP_TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      EVERYUP_TELEGRAM_CHAT_ID:   ${TELEGRAM_CHAT_ID}   # allowlist
      # LLM (OpenAI 호환: 로컬이든 API든 동일)
      EVERYUP_LLM_BASE_URL: ${LLM_BASE_URL}
      EVERYUP_LLM_API_KEY:  ${LLM_API_KEY}
      EVERYUP_LLM_MODEL:    ${LLM_MODEL}
      # OTel Collector 연결
      EVERYUP_OTEL_ENDPOINT: http://otel-collector:4317
      # 옵션: 서버 다운 감지 dead-man's-switch
      EVERYUP_HEARTBEAT_URL: ${HEARTBEAT_URL:-}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro  # discovery (read-only)
      - everyup-data:/data                            # cooldown/history
    depends_on: [otel-collector]

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.110.0
    restart: unless-stopped
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./otel-config.yaml:/etc/otelcol/config.yaml:ro # 자동생성+덮어쓰기 가능
      - /:/hostfs:ro                                   # hostmetrics
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP

volumes:
  everyup-data:
```

**.env**

```bash
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789

# (A) 로컬 LLM 예시 — Ollama
LLM_BASE_URL=http://ollama:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1

# (B) 호스티드 API 예시 — 위 3줄 대신 주석 해제
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=sk-...
# LLM_MODEL=gpt-4o-mini

# 옵션: 외부 heartbeat (서버 다운 감지)
HEARTBEAT_URL=
```

> **핵심:** 로컬 LLM과 API의 차이는 `.env` 3줄(BASE_URL/API_KEY/MODEL)뿐이다. `otel-config.yaml`은 Agent가 기본값을 생성하지만, 위처럼 볼륨으로 노출되어 사용자가 receiver/exporter를 추가·수정할 수 있다.

---

## 9. 8주 개발 실행안 (MVP, Phase 0~6)

| 기간 | 개발 항목 | 완료 기준 |
|---|---|---|
| 1주차 | Phase 0 인터페이스 설계(Notifier/LLMProvider/Config) + Go Agent 골격, env 설정, Telegram 단방향 알림, health check | 시작 알림·health 실패 알림 수신(Telegram) |
| 2주차 | host/docker metric, disk threshold, cooldown/recovery, dead-man's-switch 옵션 | 임계치·복구 알림 정상, 알림 폭탄 없음 |
| 3주차 | Docker socket 연동, 컨테이너 discovery, label 기반 등록 | label만으로 서비스 자동 감시 |
| 4주차 | otelcol-contrib 별도 컨테이너, config 자동 생성, filelog/OTLP 수집 | Collector 연동으로 로그/메트릭/trace 수집 |
| 5주차 | Local Alert Engine 일반화(restart 감지, log keyword, dedup, 서비스별 설정) | 다양한 장애 유형에서 정확한 알림 |
| 6주차 | LLMProvider(OpenAI 호환), 장애 요약, masking, graceful degrade | 원인후보+조치 포함 알림, 로컬↔API 전환 확인 |
| 7주차 | Telegram ChatOps 양방향(/status /logs /explain /silence), 권한 allowlist, 감사 로그 | 채팅에서 상태·로그·요약 조회 가능 |
| 8주차 | 통합 테스트, 복붙 compose/.env/문서 정리, 기본 Runbook 초안 일부(HikariCP/Nginx502/DiskFull) | MVP 릴리스, Quick Start로 재현 가능 |

---

## 10. 주요 의사결정 (확정안)

| 의사결정 항목 | 확정 방향 |
|---|---|
| 기본 모드 | 중앙 서버 없는 Standalone (확정) |
| MVP 알림 채널 | Telegram 우선(단방향→양방향). Discord/Slack은 Notifier 인터페이스로 후속 (확정) |
| AI 요약 | MVP 포함하되 부가 기능 성격 — 실패 시 raw 알림으로 degrade (확정) |
| 서버 다운 감지 | MVP는 경량 heartbeat 옵션, 완전 Watchdog은 Phase 9 (확정) |
| 자동 조치 | Phase 6 `/restart` 후보부터 allowlist+승인. 자동 실행은 후순위 |
| OTel Collector | 공식 otelcol-contrib를 별도 컨테이너로 운영. 임베디드 supervisor는 후순위 (확정) |
| LLM | OpenAI 호환 LLMProvider — 로컬/API 모두, env 3개로 전환 (확정) |

---

## 11. 리스크 및 완화책

| 리스크 | 완화책 |
|---|---|
| Agent 자기 죽음(서버 다운) | MVP에 dead-man's-switch(heartbeat) 옵션, 완전 Watchdog은 Phase 9 |
| 알림 폭탄 | cooldown·dedup을 Phase 1 첫 알림부터 포함 |
| Docker socket 보안 | 기본 read-only + docker-socket-proxy로 최소 권한 옵션 제공 |
| LLM 장애·지연 | 타임아웃 + graceful degrade로 raw 알림 보장. AI는 부가 정보 |
| 로그 민감정보 노출 | LLM 전송 전·저장 전 masking. 우려 시 로컬 LLM 권장 |
| 잘못된 Runbook 조치 | auto_execute=false 기본, 조치 명령 allowlist+승인, Runbook 검증 |
| 상태 유실 | cooldown/incident history를 data 볼륨에 영속화 |
| Collector 버전 호환 | 이미지 태그 핀 고정 + 별도 컨테이너로 독립 업그레이드 |
| 일정 압박(8주) | Runbook(P7)·Memory(P8)는 MVP 밖. 양방향 ChatOps까지만 MVP |

---

## 12. 최종 컨셉 문장

> **EveryUp Agent —** Docker Compose에 가볍게 추가하는 self-hosted monitoring AI agent. 서비스의 health·logs·metrics·traces를 OpenTelemetry로 수집하고, 장애가 발생하면 Telegram으로 원인 후보와 조치 방법을 요약해 알려주며, 채팅 명령으로 상태 조회와 장애 설명에 양방향으로 응답한다. LLM은 로컬이든 API든 설정만으로 교체된다.
