# OpenTelemetry API 계측

서비스 health·로그·호스트 메트릭·API **상태코드**는 앱 수정이 필요 없고, 선택적
eBPF 사이드카가 코드 없이 실제 **레이턴시와 트레이스**까지 더합니다(Docker 수집기 README
참고). 이 문서는 앱을 건드리는 유일한 단계 — 요청/응답 **헤더·바디**를 앱에
OpenTelemetry로 계측해 수집하는 방법을 다룹니다.

계측된 스팬은 Docker 수집기의 OTLP 게이트웨이 `http://everyup-agent:4318`(알맞은
서비스에 귀속시켜 Web으로 포워딩)로 보내거나, Web에 직접
`/api/v1/otlp/v1/traces`로 보냅니다.

## 가장 빠른 길 — 번들 계측 (Java, Node.js)

Java와 Node.js는 코드를 한 줄도 안 써도 됩니다. Docker 수집기 설치 과정에서
`everyup-otel` CLI와 OpenTelemetry 번들(Java agent jar + Node.js 부트스트랩)을
함께 준비합니다.

1. 웹 UI에서 프로젝트를 열고 **상세 API 모니터링**을 선택합니다.
2. 애플리케이션 Compose 경로를 입력하고 표시된 명령 한 줄을 서버에서 실행합니다.

CLI는 원본 Compose를 수정하지 않고 옆에 `docker-compose.everyup.yml`을 생성합니다.
선택한 서비스만 다시 만들고, 기존 `JAVA_TOOL_OPTIONS`/`NODE_OPTIONS`, 번들 볼륨,
Docker 수집기 연결 네트워크와 컨테이너 health를 검증합니다. 검증 실패 시 직전 설정으로 자동
복구합니다. 수동 확인과 복구도 가능합니다:

```bash
sudo everyup-otel status ./docker-compose.yml
sudo everyup-otel verify ./docker-compose.yml
sudo everyup-otel rollback ./docker-compose.yml
```

바디는 옵트인입니다(Node만 자동 지원). 전체 동작은 Docker 수집기 README의
"App Instrumentation"을 참고하세요.

아래 내용은 **다른 언어, 수동 SDK 설정, 또는 번들이 만들어 내는 스팬 계약을 이해**
하려는 경우를 위한 것입니다.

## EveryUp이 스팬에서 읽는 것

서비스의 **API** 탭에 뜨려면, 요청마다 **SERVER** 종류 스팬을 아래 속성과 함께 방출:

| 속성 | 타입 | 용도 |
| --- | --- | --- |
| `http.request.method` (또는 `http.method`) | string | 필수 — 요청 메서드 |
| `http.response.status_code` (또는 `http.status_code`) | int | 필수 — 상태코드 |
| `url.path` (또는 `http.target`) | string | 요청 경로 |
| `http.route` | string | 선택 — 경로 템플릿 (예: `/users/:id`) |
| `client.address` (또는 `net.peer.ip`) | string | 선택 — 클라이언트 IP |

메서드나 상태코드가 없는 스팬은 무시됩니다(API 요청으로 투영 안 됨). 스팬 duration이
요청 레이턴시가 됩니다(1ms 미만은 1ms로 올림).

## 헤더

헤더는 표준 OTel 스팬 속성 `http.request.header.<이름>` /
`http.response.header.<이름>`로 실려 Trace 패널의 **Headers** 섹션에 보입니다. 캡처는
언어별 allowlist 방식:

| 언어 | 방법 |
| --- | --- |
| Java (agent jar) | `OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS=content-type,user-agent` (그리고 `..._CAPTURE_RESPONSE_HEADERS`) |
| Node (EveryUp 번들) | `OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST=content-type,user-agent` (그리고 `..._SERVER_RESPONSE`) |
| Python (`opentelemetry-instrument`) | `OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST=content-type,user-agent` |
| 기타 / 수동 SDK | SERVER 스팬에 속성을 직접 설정 |

민감 헤더(`authorization`, `cookie`, `set-cookie`, `x-api-key` 등)는 **무엇을 캡처하든**
ingest에서 마스킹됩니다 — 대시(`-`)·언더스코어(`_`) 표기 모두.

## 요청/응답 바디 (이벤트 계약)

바디는 표준 스팬 속성이 아니라서, 요청 스팬에 **이벤트**로 실립니다:

- 이벤트 이름 **`request_body_masked`** 그리고/또는 **`response_body_masked`**.
- 각 이벤트는 **이미 마스킹한** 본문 텍스트를 `body` 속성에 담습니다 — 시크릿·토큰·PII는
  export 전에 계측 단계에서 제거하세요. 선택 속성: `body_size`(int), `body_truncated`(bool).
- 바디는 작게 유지하세요(번들 기본 8KiB). Web은 서버측에서 64KiB로 캡하고 초과분은
  truncated로 표시합니다.

수집된 바디는 **admin 전용**입니다: Web은 비admin에게 `body` 속성을 가리고, admin
열람은 모두 `audit_events`에 기록하며, 바디 포함 스팬은
`EVERYUP_RETENTION_BODYCAPTUREDAYS`일(기본 7) 후 삭제합니다.

### Node.js

EveryUp 번들이 처리 — `EVERYUP_CAPTURE_BODIES=true`만 켜면 됩니다
(`EVERYUP_BODY_MAX_BYTES`, `EVERYUP_MASKED_BODY_FIELDS`로 조정). 코드 불필요.

### Java (Spring Boot 예시)

OTel Java agent는 바디를 캡처하지 않으므로, 현재 스팬에 넣어 주는 작은 필터를 추가:

```java
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Component
public class BodyCaptureFilter extends OncePerRequestFilter {
    private static final int MAX = 8192;
    private static final AttributeKey<String> BODY = AttributeKey.stringKey("body");

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        var reqW = new ContentCachingRequestWrapper(req, MAX);
        var resW = new ContentCachingResponseWrapper(res);
        try {
            chain.doFilter(reqW, resW);
        } finally {
            Span span = Span.current();
            span.addEvent("request_body_masked",
                Attributes.of(BODY, mask(new String(reqW.getContentAsByteArray(), StandardCharsets.UTF_8))));
            span.addEvent("response_body_masked",
                Attributes.of(BODY, mask(new String(resW.getContentAsByteArray(), StandardCharsets.UTF_8))));
            resW.copyBodyToResponse();
        }
    }

    // export 전에 시크릿을 마스킹 — 필요한 필드명으로 확장하세요.
    private String mask(String body) {
        return body.replaceAll("(\"(?:password|token|secret|apiKey)\"\\s*:\\s*\")[^\"]*", "$1***");
    }
}
```

### Python (FastAPI/Starlette 예시)

```python
import json, re
from opentelemetry import trace

MASKED = re.compile(r'("(?:password|token|secret|api_key)"\s*:\s*")[^"]*')

@app.middleware("http")
async def capture_request_body(request, call_next):
    body = await request.body()  # Starlette이 캐시하므로 핸들러도 계속 읽을 수 있음
    response = await call_next(request)
    span = trace.get_current_span()
    if span.is_recording() and body:
        text = body[:8192].decode("utf-8", "replace")
        span.add_event("request_body_masked", {"body": MASKED.sub(r"\1***", text)})
    return response
```

Starlette에서 스트리밍 응답의 응답 바디 캡처는 더 복잡하니, 요청 바디부터 시작하세요.

## 로그를 요청에 연결하기

Trace 패널은 같은 **trace id**를 공유하는 로그·스팬을 한 요청으로 엮어 보여줍니다.
애플리케이션 로그를 거기 뜨게 하려면:

- **OTLP 로그 사용 시**(SDK 로그 exporter): 트레이스된 요청 안에서 로그를 남기면 trace
  id가 자동 주입됩니다 — 할 일 없음.
- **평문 stdout 로그 사용 시**(Docker 수집기가 수집): 각 로그 줄에 trace id(또는 `x-request-id`
  헤더로 전파하는 `request_id`)를 출력하세요. 그 id로 검색해 로그를 요청과 맞출 수 있습니다.

바디 캡처를 꺼둔 곳에서도 이렇게 하면 전체 요청/응답 내용을 복원할 수 있습니다 — 바디는
서비스 자체 로그에 남고, 공유 id로 찾을 수 있으니까요.

## 중복 집계

자동 처리됩니다: 어떤 서비스가 Docker 수집기 게이트웨이로 실제 스팬을 보내는 동안,
Docker 수집기는 그 서비스의 access-log 합성 스팬을 잠시 멈춥니다(실제 스팬이 끊긴 뒤
~10분 후 재개).
게이트웨이를 우회해 **Web으로 직접** OTLP를 보내는 앱만 여전히 중복될 수 있으니,
게이트웨이를 향하게 하세요.
