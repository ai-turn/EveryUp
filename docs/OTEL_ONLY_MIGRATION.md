# OpenTelemetry-only migration

EveryUp now accepts logs and traces through OpenTelemetry OTLP/HTTP only.

## Breaking changes

- Removed legacy JSON log ingest endpoints:
  - `POST /api/v1/ingest/logs`
  - `POST /api/v1/logs/ingest`
- Removed legacy API request direct ingest:
  - `POST /api/v1/ingest/requests`
- Removed per-service API capture configuration endpoints:
  - `GET /api/v1/services/:id/api-capture-config`
  - `PUT /api/v1/services/:id/api-capture-config`
- Removed the `log-agent/` source tree and Docker publish job for `aiturn/everyup-log-agent`.

## Replacement

Configure OpenTelemetry SDKs or auto-instrumentation to export OTLP/HTTP.
The endpoint is whatever URL fronts your EveryUp deployment:

- **Behind a reverse proxy / public hostname:** `https://everyup.example.com/api/v1/otlp`
- **Direct to the backend (typical local dev):** `http://localhost:3001/api/v1/otlp`

```bash
export OTEL_SERVICE_NAME="my-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="https://everyup.example.com/api/v1/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer everyup_your_api_key"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="none"
```

The backend receives:

- `POST /api/v1/otlp/v1/logs`
- `POST /api/v1/otlp/v1/traces`

HTTP request rows in `api_requests` are now projections from OTel `SERVER` spans with HTTP attributes.
