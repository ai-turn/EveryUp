# Legacy OpenTelemetry API Instrumentation Notes

EveryUp no longer supports app-side API request collection modes as the recommended path.
API request and request/response body capture should go through the EveryUp Agent image
running in `proxy` mode.

Use OpenTelemetry in applications only for ordinary trace/log correlation when you need it.
Do not use it as the primary API request capture path, and do not set
`EVERYUP_API_CAPTURE_MODE`; that setting has been removed from the Agent.

```yaml
services:
  everyup-proxy:
    image: aiturn/everyup-agent:latest
    environment:
      EVERYUP_AGENT_MODE: "proxy"
      EVERYUP_PROXY_LISTEN_ADDR: ":8080"
      EVERYUP_PROXY_UPSTREAM_URL: "http://app:8080"
      EVERYUP_PROXY_OTLP_ENDPOINT: "http://everyup-agent:4318"
      EVERYUP_CAPTURE_ENABLED: "false"
      EVERYUP_CAPTURE_ROUTES: "/api/..."
    ports:
      - "8080:8080"
```

The proxy path keeps request accounting, body capture policy, masking, and retention in one
place. Captured body span events are visible only to admin users through the trace API;
admin views are recorded in `audit_events`, and body-bearing spans use
`EVERYUP_RETENTION_BODYCAPTUREDAYS` retention (default 7 days).
