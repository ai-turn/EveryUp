# API 요청 수집 — OpenTelemetry 자동 계측 가이드

EveryUp의 **API 요청 탭**은 OpenTelemetry로 보낸 HTTP 서버 스팬에서 채워집니다.
앱에 OTel 공식 자동 계측(auto-instrumentation)을 붙이고, 그걸 **everyup-agent의
텔레메트리 게이트웨이(`:4318`)**로 보내면 됩니다.

```
앱(OTel 자동계측) ──OTLP──▶ everyup-agent:4318 ──(agent 키 자동첨부)──▶ EveryUp Web ──▶ API 탭
```

- **OS 무관**: 인프로세스 계측이라 Linux/macOS/Windows 어디서나 동작
- **앱 키 불필요**: 게이트웨이는 내부망 무인증, 에이전트가 자기 키를 붙여 전송
- **메타데이터만**: method/path/status/duration만 — 요청/응답 본문은 안 보냄

---

## 모든 언어 공통 환경변수

어떤 언어든 아래를 앱 컨테이너에 설정합니다.

```bash
# ★ EveryUp UI에 보이는 서비스명과 똑같이. 안 맞으면 엉뚱한 카드에 생기거나 안 보임
OTEL_SERVICE_NAME=demo

# everyup-agent 게이트웨이로 전송 (앱과 agent가 같은 docker 네트워크일 것)
OTEL_EXPORTER_OTLP_ENDPOINT=http://everyup-agent:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf   # 게이트웨이는 protobuf만 받음

OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=none   # 게이트웨이엔 /v1/metrics 없음 → none 필수
OTEL_LOGS_EXPORTER=none      # 로그는 이미 docker stdout으로 수집 중 (중복 방지)
```

> **중복 방지**: 에이전트가 stdout 액세스로그를 또 요청으로 파싱하면 이중 집계됩니다.
> OTel로 요청을 보낸다면 에이전트에 `EVERYUP_API_CAPTURE_MODE=otlp`를 줘서
> 액세스로그 요청 생성을 끄세요. (로그 수집은 그대로 유지됩니다)

---

## 주요 언어 (Java / Python / Node)

### Java — 코드 0줄
```dockerfile
# opentelemetry-javaagent.jar를 이미지에 포함하거나 마운트
ENV JAVA_TOOL_OPTIONS="-javaagent:/otel/opentelemetry-javaagent.jar"
```
jar: https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases

### Python — 코드 0줄
```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install          # 설치된 라이브러리에 맞는 계측 자동 설치
opentelemetry-instrument python app.py      # 이 래퍼로 실행
```

### Node.js — 코드 0줄
```bash
npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
node --require @opentelemetry/auto-instrumentations-node/register app.js
# 또는 ENV NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"
```

---

## 그 외 언어

### Ruby — 초기화 몇 줄
```ruby
# Gemfile: opentelemetry-sdk, opentelemetry-instrumentation-all, opentelemetry-exporter-otlp
require 'opentelemetry/sdk'
require 'opentelemetry/instrumentation/all'
OpenTelemetry::SDK.configure { |c| c.use_all }   # OTEL_* 환경변수는 자동 인식
```

### .NET / C# — 코드 0줄 (자동 계측 모듈)
```bash
# OpenTelemetry .NET Automatic Instrumentation 설치 후 환경변수 설정
CORECLR_ENABLE_PROFILING=1
CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
OTEL_DOTNET_AUTO_HOME=/otel-dotnet
# + 위 "공통 환경변수"
```
설치 스크립트/모듈: https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation

### PHP — 확장 + composer
```bash
pecl install opentelemetry                       # OTel 확장
composer require open-telemetry/sdk open-telemetry/exporter-otlp
# php.ini: extension=opentelemetry
OTEL_PHP_AUTOLOAD_ENABLED=true                   # + 공통 환경변수
```

### Go — ⚠ 드롭인 에이전트 없음
Go는 컴파일 언어라 javaagent 같은 자동 부착이 안 됩니다. HTTP 핸들러를
`otelhttp.NewHandler(mux, "server")`로 감싸면 됩니다 (몇 줄).

---

## service.name 매핑 (가장 흔한 실수)

API 탭은 `agent_id + service_name`으로 조회합니다. `OTEL_SERVICE_NAME`이 EveryUp이
디스커버리한 서비스명(보통 compose 서비스명 또는 컨테이너명)과 **정확히 일치**해야
해당 서비스 카드의 API 탭에 들어갑니다. 다르면 데이터는 저장돼도 안 보입니다.

EveryUp UI의 서비스 카드에 표시된 이름을 그대로 쓰세요.

---

## 검증

1. 앱 재시작 후 요청 몇 번 발생
2. 개발자도구/agent 로그에서 `POST /otlp/v1/traces` 호출이 생기는지
3. EveryUp → 해당 서비스 → **요청 탭**에 뜨는지
4. API로 직접: `GET /api/v1/agents/{agentId}/services/{key}/requests` → `total > 0`

안 되면 흔한 원인:
- `Unsupported Media Type` → `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` 누락
- web 로그 `/v1/metrics` 404 → `OTEL_METRICS_EXPORTER=none` 누락
- 저장은 되는데 카드에 없음 → `OTEL_SERVICE_NAME` 불일치
- 요청 2배 집계 → 에이전트 `EVERYUP_API_CAPTURE_MODE=otlp` 미설정
