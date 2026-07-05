# OpenTelemetry API Instrumentation (Tier 2)

API **status codes** are collected for free in Tier 1 by parsing access logs, and
**latency** for every language via the optional eBPF sidecar — no instrumentation
needed (see the agent README). This document covers **Tier 2**: request/response
**headers and bodies**, by instrumenting the application with OpenTelemetry.

**Prefer the bundle first**: for Java and Node.js the agent ships a ready-made
instrumentation bundle — one shared volume plus env vars, no code changes. See
"App Instrumentation" in the agent README. This document is for other languages,
custom setups, and the body-capture event contract itself.

The app sends OTLP/HTTP spans to the Agent's OTLP gateway at
`http://everyup-agent:4318` (which attributes and forwards to Web), or directly
to Web at `/api/v1/otlp/v1/traces`.

## What EveryUp reads from a span

To appear in a service's **API** tab, emit a **SERVER**-kind span per request with:

| Attribute | Type | Purpose |
| --- | --- | --- |
| `http.request.method` (or `http.method`) | string | required — request method |
| `http.response.status_code` (or `http.status_code`) | int | required — status code |
| `url.path` (or `http.target`) | string | request path |
| `http.route` | string | optional path template (e.g. `/users/:id`) |
| `client.address` (or `net.peer.ip`) | string | optional client IP |

A span missing method or status is ignored (not projected as an API request).
Span duration becomes the request latency (sub-millisecond rounds up to 1ms).

## Headers

Headers ride on the standard OTel span attributes
`http.request.header.<name>` / `http.response.header.<name>` and show up in the
Trace panel's **Headers** section. Capture is allowlist-based per language:

| Language | How |
| --- | --- |
| Java (agent jar) | `OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS=content-type,user-agent` (and `..._CAPTURE_RESPONSE_HEADERS`) |
| Node (EveryUp bundle) | `OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST=content-type,user-agent` (and `..._SERVER_RESPONSE`) |
| Python (`opentelemetry-instrument`) | `OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST=content-type,user-agent` |
| Other / manual SDK | set the attributes yourself on the SERVER span |

Sensitive headers (`authorization`, `cookie`, `set-cookie`, `x-api-key`, ...)
are masked at ingest **regardless of what you capture** — both dash and
underscore spellings.

## Request/response bodies (optional)

To show bodies in the **Trace** panel's *Captured bodies* section, attach span
**events** to the request span:

- Event name **`request_body_masked`** and/or **`response_body_masked`**.
- Each event carries a `body` attribute holding the body text **you have already
  masked** — strip secrets, tokens, and PII in your instrumentation before
  export. Optional attributes: `body_size` (int), `body_truncated` (bool).
- Keep bodies small (the bundle default is 8KiB). Web enforces a 64KiB
  server-side cap and flags anything above it as truncated.

Captured bodies are **admin-only**: Web redacts the `body` attribute for
non-admin users, records every admin view in `audit_events`, and deletes
body-bearing spans after `EVERYUP_RETENTION_BODYCAPTUREDAYS` days (default 7).

### Node.js

Covered by the EveryUp bundle — set `EVERYUP_CAPTURE_BODIES=true`
(`EVERYUP_BODY_MAX_BYTES`, `EVERYUP_MASKED_BODY_FIELDS` to tune). No code.

### Java (Spring Boot example)

The OTel Java agent does not capture bodies; add a small filter that feeds the
current span:

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

    // Mask secrets BEFORE export — extend to your own field names.
    private String mask(String body) {
        return body.replaceAll("(\"(?:password|token|secret|apiKey)\"\\s*:\\s*\")[^\"]*", "$1***");
    }
}
```

### Python (FastAPI/Starlette example)

```python
import json, re
from opentelemetry import trace

MASKED = re.compile(r'("(?:password|token|secret|api_key)"\s*:\s*")[^"]*')

@app.middleware("http")
async def capture_request_body(request, call_next):
    body = await request.body()  # Starlette caches it; handlers can still read it
    response = await call_next(request)
    span = trace.get_current_span()
    if span.is_recording() and body:
        text = body[:8192].decode("utf-8", "replace")
        span.add_event("request_body_masked", {"body": MASKED.sub(r"\1***", text)})
    return response
```

Response-body capture with streaming responses is more involved in Starlette;
start with request bodies.

## Double-counting

Handled automatically: while a service ships real spans through the agent
gateway, the agent pauses its access-log synthetic spans for that service (it
resumes ~10 minutes after real spans stop). Only apps that send OTLP **directly
to Web**, bypassing the gateway, can still double-count — point them at the
gateway instead.
