# API Request Monitoring Spec

## Overview

Per-request HTTP capture, storage, and inspection for monitored services. Separate from log ingestion — designed to record individual API calls (method, path, status code, latency, headers, body) with configurable sampling, masking, and retention.

---

## Data Model

### `api_requests` table

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID |
| `service_id` | TEXT FK | References `services.id` |
| `captured_at` | DATETIME | Server-side capture timestamp |
| `method` | TEXT | HTTP method (GET, POST, …) |
| `path` | TEXT | Normalized URL path (query stripped) |
| `status_code` | INTEGER | HTTP response status code |
| `duration_ms` | INTEGER | Round-trip latency in milliseconds |
| `req_headers` | TEXT | JSON object — masked per masking rules |
| `req_body` | TEXT | Request body — masked + truncated |
| `res_body` | TEXT | Response body — masked + truncated |
| `client_ip` | TEXT | Optional — forwarded by sender |
| `user_agent` | TEXT | Optional |

### `service_api_capture_config` table

| Column | Type | Description |
|---|---|---|
| `service_id` | TEXT PK FK | References `services.id` |
| `mode` | TEXT | Capture mode (see below) |
| `sample_rate` | REAL | 0.0–1.0, used when mode = `sampled` |
| `capture_req_headers` | BOOLEAN | Include request headers |
| `capture_req_body` | BOOLEAN | Include request body |
| `capture_res_body` | BOOLEAN | Include response body |
| `body_size_limit` | INTEGER | Max body bytes before truncation (default 8192) |
| `updated_at` | DATETIME | Last config change |

---

## Capture Config

### Modes

| Mode | Description |
|---|---|
| `disabled` | No requests are stored |
| `errors_only` | Only requests with status ≥ 400 are stored |
| `sampled` | Random sample at `sample_rate` (default 10%); errors always captured |
| `all` | Every request is stored (high volume — use with short retention) |

**Defaults:** mode = `sampled`, sample_rate = `0.10`. Error responses (≥ 400) are always captured regardless of sampling.

### Header Masking

The following request/response headers are always replaced with `"***"` before storage:

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`
- `proxy-authorization`

### Body Masking

JSON body fields whose keys match any of the following patterns (case-insensitive) are replaced with `"***"`:

`password`, `token`, `secret`, `api_key`, `apikey`, `access_token`, `refresh_token`, `private_key`

### Body Size Cap

Bodies are truncated to `body_size_limit` bytes (default **8 KiB**). Truncated bodies receive the suffix:

```
…[truncated, <original_size> bytes]
```

### Retention

Default: **14 days** (`retention.apiRequestsDays` in config). Older rows are pruned by the same retention job that handles log entries.

---

## Ingest API

### `POST /api/v1/ingest/requests`

Receives one or a batch of captured API requests from an external service.

**Auth:** `X-API-Key: <service_api_key>` header

**Rate limit:** 100 requests/second per API key (separate bucket from log ingest)

**Body size limit:** 1 MiB

**Batch:** Up to 50 entries per request

#### Single entry payload

```json
{
  "method": "POST",
  "path": "/api/users/42",
  "statusCode": 201,
  "durationMs": 45,
  "reqHeaders": { "Content-Type": "application/json" },
  "reqBody": "{\"name\":\"Alice\"}",
  "resBody": "{\"id\":42,\"name\":\"Alice\"}"
}
```

#### Batch payload

```json
[
  { "method": "GET",  "path": "/api/health", "statusCode": 200, "durationMs": 3 },
  { "method": "POST", "path": "/api/orders", "statusCode": 422, "durationMs": 120,
    "resBody": "{\"error\":\"validation_failed\"}" }
]
```

#### Response

```json
{ "success": true, "data": { "accepted": 2 } }
```

---

## Query API

All query endpoints require JWT auth (`Authorization: Bearer <token>`).

### `GET /services/:id/api-requests`

List captured requests with optional filters.

| Query param | Type | Description |
|---|---|---|
| `errorsOnly` | bool | Only return status ≥ 400 |
| `method` | string | Filter by HTTP method |
| `minStatus` | int | Minimum status code (inclusive) |
| `maxStatus` | int | Maximum status code (inclusive) |
| `pathPrefix` | string | Path prefix match |
| `search` | string | Full-text search across path + bodies |
| `from` | ISO8601 | Start of time range |
| `to` | ISO8601 | End of time range |
| `limit` | int | Page size (default 50, max 200) |
| `offset` | int | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1024,
    "items": [ { "id": "...", "method": "POST", "path": "...", "statusCode": 201, "durationMs": 45, "capturedAt": "..." } ]
  }
}
```

### `GET /services/:id/api-requests/:requestId`

Retrieve a single request record including headers and bodies.

### `GET /services/:id/api-capture-config`

Return current capture configuration for the service.

**Response:**
```json
{
  "success": true,
  "data": {
    "mode": "sampled",
    "sampleRate": 0.1,
    "captureReqHeaders": true,
    "captureReqBody": true,
    "captureResBody": true,
    "bodySizeLimit": 8192
  }
}
```

### `PUT /services/:id/api-capture-config`

Update capture configuration.

**Body:**
```json
{
  "mode": "errors_only",
  "sampleRate": 0.05,
  "captureResBody": false
}
```

---

## cURL Examples

### Ingest a single request

```bash
curl -X POST https://your-mt-app/api/v1/ingest/requests \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "POST",
    "path": "/api/users/42",
    "statusCode": 201,
    "durationMs": 45,
    "reqBody": "{\"name\":\"Alice\"}",
    "resBody": "{\"id\":42,\"name\":\"Alice\"}"
  }'
```

### Query recent errors

```bash
curl "https://your-mt-app/api/v1/services/MY_SERVICE_ID/api-requests?errorsOnly=true&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## SDK Integration

Code snippets for cURL, Express.js middleware, and Go `net/http` middleware are available in the **Integration** tab of each service page in the MT UI (API Capture category). The snippets are pre-filled with the service's endpoint URL for easy copy-paste.
