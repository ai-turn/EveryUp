# OpenTelemetry API Instrumentation (Tier 2)

API **status codes** are collected for free in Tier 1 by parsing access logs — no
instrumentation needed (see the README). This document covers **Tier 2**: getting
full traces with real latency, plus request/response **headers and bodies**, by
instrumenting the application with OpenTelemetry.

There is no proxy and no extra container. The app sends OTLP/HTTP spans to the
Agent's OTLP gateway at `http://everyup-agent:4318` (which forwards to Web), or
directly to Web at `/api/v1/otlp/v1/traces`. Use any OpenTelemetry SDK or
auto-instrumentation for your language — see
[opentelemetry.io/docs](https://opentelemetry.io/docs/) for per-language setup.
EveryUp only cares about the span shape below.

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
Span duration becomes the request latency.

## Request/response bodies (optional)

To show bodies in the **Trace** panel's *Captured bodies* section, attach span
**events** to the request span:

- Event name **`request_body_masked`** and/or **`response_body_masked`**.
- Each event carries a `body` attribute holding the body text **you have already
  masked**. EveryUp does not mask for you on this path — strip secrets, tokens,
  and PII in your instrumentation before export.

Captured bodies are **admin-only**: Web redacts the `body` attribute for non-admin
users, records every admin view in `audit_events`, and deletes body-bearing spans
after `EVERYUP_RETENTION_BODYCAPTUREDAYS` days (default 7).

## Avoid double-counting

If a service already produces API rows from Tier 1 access-log parsing, do **not**
also instrument it with OTel for the same requests — each request would appear
twice in the request list. Pick one source per service.

> Planned: first-party SDKs and agent-based (eBPF) capture for
> zero-instrumentation header/body collection.
