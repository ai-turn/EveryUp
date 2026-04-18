# API Request Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 로그 메뉴에 개별 API 요청/응답(method, path, status, 헤더, 본문, 지연시간)을 수집·조회할 수 있는 인스펙터를 추가한다. 수집 범위는 서비스별로 조정 가능.

**Architecture:**
- 새로운 ingest 엔드포인트 `POST /api/v1/ingest/requests` (API key auth) → 새로운 `api_requests` 테이블에 저장.
- 기존 로그와 별도 트랙(payload가 구조적이라 포맷 자동감지가 불필요하고, UI/저장 정책이 다름).
- 서비스별 `api_capture_config`(캡처 모드, 샘플링률, 본문 크기 캡, 마스킹 리스트)로 서버사이드 필터·마스킹·트렁케이트.
- 로그 서비스 상세 페이지에 "Requests" 탭 추가 + "Settings" 탭에 캡처 설정 섹션.

**Tech Stack:**
- Backend: Go (Fiber v2), SQLite (modernc.org), 기존 `ApiKeyAuth` 미들웨어, 기존 `LogIngestHandler` 패턴 준용.
- Frontend: React 19 + TS + Tailwind v4, 기존 `features/logs/` 구조 mirror.
- 테스트: `backend/internal/api/handlers/integration_test.go` 의 `setupTestServer` 패턴 확장.

**Non-goals (이번 v1 범위 밖):**
- 분산 트레이싱(OpenTelemetry 수신), waterfall 타임라인, 서비스 의존성 그래프.
- 집계 지표(p50/p95/에러율 대시보드) — 현재는 raw request 뷰어만. 차후 단계에서 집계 추가.
- 인메모리 버퍼/비동기 플러시. v1은 동기 insert. **v2 트리거**: ingest 핸들러 p95 > 200ms, 또는 DB write 대기 관측, 또는 서비스당 > 200 req/s 도달 시 착수.

---

## Design Decisions (합의됨)

| 항목 | 값 |
|------|-----|
| 캡처 모드 | `disabled` / `errors_only` / `sampled` / `all` — 서비스별 설정, 기본 `sampled` |
| 기본 샘플링률 | 10% (성공), 에러(status≥500 OR `error` 필드 존재)는 항상 100% |
| 본문 크기 캡 | 8 KiB (요청/응답 각각), 초과 시 `…[truncated, N bytes]` 접미 |
| 헤더 마스킹 기본값 | `authorization, cookie, set-cookie, x-api-key, proxy-authorization` |
| 본문 필드 마스킹 기본값 | `password, token, secret, access_token, refresh_token, apiKey, api_key` — JSON body만, case-insensitive |
| 보존 기간 | 14일 (`retention.api_requests_days` 설정) |
| 상관관계 헤더 | `X-Request-ID` (없으면 서버에서 ULID 생성) |
| 배치 상한 | 단일 요청당 entries ≤ **50** (로그보다 낮게 — 개별 payload가 큼) |
| Body 상한 | HTTP 요청 바디 총합 ≤ **1 MiB** (라우트 레벨 Fiber `BodyLimit`) |
| Rate limit | **전용 리미터** `ApiRequestIngestRateLimiter` — 로그 ingest와 독립 카운터 |

---

## Data Model

### Table: `api_requests` (신규)
```sql
CREATE TABLE api_requests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id     TEXT    NOT NULL,
    request_id     TEXT    NOT NULL,               -- X-Request-ID or server-generated
    method         TEXT    NOT NULL,               -- GET, POST, ...
    path           TEXT    NOT NULL,               -- raw path with actual params
    path_template  TEXT    NOT NULL,               -- /users/:id (normalized)
    status_code    INTEGER NOT NULL,
    duration_ms    INTEGER NOT NULL,
    client_ip      TEXT,
    req_headers    TEXT,                            -- JSON object (masked)
    req_body       TEXT,                            -- truncated to cap (masked)
    req_body_size  INTEGER NOT NULL DEFAULT 0,     -- original size before truncation
    res_headers    TEXT,                            -- JSON object (masked)
    res_body       TEXT,
    res_body_size  INTEGER NOT NULL DEFAULT 0,
    error          TEXT,                            -- optional error message from SDK
    is_error       INTEGER NOT NULL DEFAULT 0,     -- derived: status>=500 || error != ''
    created_at     DATETIME NOT NULL,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);
CREATE INDEX idx_api_requests_service_time   ON api_requests(service_id, created_at DESC);
CREATE INDEX idx_api_requests_service_status ON api_requests(service_id, status_code);
CREATE INDEX idx_api_requests_service_error  ON api_requests(service_id, is_error, created_at DESC);
CREATE INDEX idx_api_requests_request_id     ON api_requests(request_id);
```

### Columns on `services` (신규, nullable — 기본값은 핸들러에서 적용)
```sql
ALTER TABLE services ADD COLUMN api_capture_mode         TEXT;    -- 'disabled'|'errors_only'|'sampled'|'all'
ALTER TABLE services ADD COLUMN api_sample_rate          INTEGER; -- 0..100
ALTER TABLE services ADD COLUMN api_body_max_bytes       INTEGER; -- bytes
ALTER TABLE services ADD COLUMN api_masked_headers       TEXT;    -- comma-separated, case-insensitive
ALTER TABLE services ADD COLUMN api_masked_body_fields   TEXT;    -- comma-separated
```

---

## Phase 1 — Backend: Data Layer

### Task 1.1: Migration `migrateV19` for `api_requests` + service columns

**Files:**
- Modify: `backend/internal/database/migrations.go` — add `migrateV19()` after last existing migrate function
- Modify: `backend/internal/database/sqlite.go` — register v19 in the migration loop (찾기: `migrateV18`)

**Step 1:** Write failing integration test to confirm table exists after boot.
- Create: `backend/internal/database/migrations_api_requests_test.go`
- Test: `TestMigrateV19_CreatesApiRequestsTable` — open `:memory:` DB, query `SELECT name FROM sqlite_master WHERE type='table' AND name='api_requests'`, expect 1 row.

**Step 2:** Run `go test ./internal/database/ -run TestMigrateV19 -v` — expect FAIL ("no such table").

**Step 3:** Implement `migrateV19` — CREATE TABLE + 4 indexes + 5 ALTER TABLE on services (paste from Data Model above; wrap in `db.Transaction`).

**Step 4:** Run test — expect PASS.

**Step 5:** Commit `feat(db): add api_requests table and per-service capture config (migrateV19)`.

---

### Task 1.2: Model — `models/api_request.go`

**Files:**
- Create: `backend/internal/models/api_request.go`
- Test: `backend/internal/models/api_request_test.go`

**Definitions:**
```go
type ApiCaptureMode string
const (
    CaptureModeDisabled   ApiCaptureMode = "disabled"
    CaptureModeErrorsOnly ApiCaptureMode = "errors_only"
    CaptureModeSampled    ApiCaptureMode = "sampled"
    CaptureModeAll        ApiCaptureMode = "all"
)

type ApiRequest struct {
    ID            int64           `json:"id"`
    ServiceID     string          `json:"serviceId"`
    RequestID     string          `json:"requestId"`
    Method        string          `json:"method"`
    Path          string          `json:"path"`
    PathTemplate  string          `json:"pathTemplate"`
    StatusCode    int             `json:"statusCode"`
    DurationMs    int             `json:"durationMs"`
    ClientIP      string          `json:"clientIp,omitempty"`
    ReqHeaders    json.RawMessage `json:"reqHeaders,omitempty"`
    ReqBody       string          `json:"reqBody,omitempty"`
    ReqBodySize   int             `json:"reqBodySize"`
    ResHeaders    json.RawMessage `json:"resHeaders,omitempty"`
    ResBody       string          `json:"resBody,omitempty"`
    ResBodySize   int             `json:"resBodySize"`
    Error         string          `json:"error,omitempty"`
    IsError       bool            `json:"isError"`
    CreatedAt     time.Time       `json:"createdAt"`
}

type ApiRequestIngestEntry struct {
    RequestID   string                 `json:"requestId,omitempty"`
    Method      string                 `json:"method"`
    Path        string                 `json:"path"`
    StatusCode  int                    `json:"statusCode"`
    DurationMs  int                    `json:"durationMs"`
    Timestamp   *time.Time             `json:"timestamp,omitempty"`
    ClientIP    string                 `json:"clientIp,omitempty"`
    ReqHeaders  map[string]string      `json:"reqHeaders,omitempty"`
    ReqBody     string                 `json:"reqBody,omitempty"`
    ResHeaders  map[string]string      `json:"resHeaders,omitempty"`
    ResBody     string                 `json:"resBody,omitempty"`
    Error       string                 `json:"error,omitempty"`
}

type ApiRequestIngestRequest struct {
    // single
    ApiRequestIngestEntry
    // batch
    Requests []ApiRequestIngestEntry `json:"requests,omitempty"`
}

type ApiCaptureConfig struct {
    Mode             ApiCaptureMode `json:"mode"`
    SampleRate       int            `json:"sampleRate"`
    BodyMaxBytes     int            `json:"bodyMaxBytes"`
    MaskedHeaders    []string       `json:"maskedHeaders"`
    MaskedBodyFields []string       `json:"maskedBodyFields"`
}

// Defaults returned when service columns are NULL
func DefaultApiCaptureConfig() ApiCaptureConfig { /* see Design Decisions */ }

type ApiRequestFilter struct {
    ServiceID   string
    MinStatus   int      // e.g. 500 for errors only
    MaxStatus   int
    Methods     []string
    PathPrefix  string
    Search      string   // searches path + req_body + res_body
    ErrorsOnly  bool
    From, To    time.Time
    Limit       int
    Offset      int
}
```

**Step 1:** Write unit tests:
- `TestDefaultApiCaptureConfig` — verify Mode=sampled, SampleRate=10, BodyMaxBytes=8192, masked lists match spec.
- `TestApiRequestJSONRoundTrip` — marshal/unmarshal preserves fields.

**Step 2:** Run `go test ./internal/models/ -run ApiRequest -v` — FAIL.

**Step 3:** Implement.

**Step 4:** Run — PASS.

**Step 5:** Commit `feat(models): add ApiRequest, ApiCaptureConfig, ingest DTOs`.

---

### Task 1.3: Repository — `repository_api_request.go`

**Files:**
- Create: `backend/internal/database/repository_api_request.go`
- Modify: `backend/internal/database/repository_service.go` — add `GetApiCaptureConfig(serviceID string) (*ApiCaptureConfig, error)` + `UpdateApiCaptureConfig(serviceID string, cfg *ApiCaptureConfig) error`
- Test: `backend/internal/database/repository_api_request_test.go`

**Methods:**
```go
type ApiRequestRepository struct{}
func NewApiRequestRepository() *ApiRequestRepository

func (r *ApiRequestRepository) Create(req *models.ApiRequest) error
func (r *ApiRequestRepository) CreateBatch(reqs []models.ApiRequest) (int, error)
func (r *ApiRequestRepository) GetByID(id int64) (*models.ApiRequest, error)
func (r *ApiRequestRepository) List(f *models.ApiRequestFilter) ([]models.ApiRequest, int, error) // items, total
func (r *ApiRequestRepository) DeleteOlderThan(cutoff time.Time) (int64, error) // retention
```

**SQLite 주의사항** (MEMORY.md 참고):
- `List` 쿼리에서 rows iterate 루프 내부에 중첩 쿼리를 쓰지 말 것. 필터 LIKE/IN은 단일 SELECT 로 작성.
- Count 쿼리는 별도 단일 SELECT COUNT(*).
- `CreateBatch` 는 단일 트랜잭션 (`db.Transaction(func(tx *sql.Tx) error { … })`).

**Step 1–5 (TDD cycle per method, commit after each method group):**
- 1.3a: Create+GetByID — test `TestApiRequestRepo_CreateAndGet`.
- 1.3b: List with filters (status, errors_only, time range, pagination) — `TestApiRequestRepo_ListFilters`.
- 1.3c: DeleteOlderThan — `TestApiRequestRepo_DeleteOlderThan`.
- 1.3d: GetApiCaptureConfig — returns defaults when columns NULL; user values when set. `TestServiceRepo_ApiCaptureConfig_DefaultsAndUpdate`.

Commit after each sub-task: `feat(db): api_requests repository — <what>`.

---

## Phase 2 — Backend: Ingest + Sampling + Masking

### Task 2.1: Path normalizer utility

**Files:**
- Create: `backend/internal/api/handlers/path_normalizer.go`
- Test: `backend/internal/api/handlers/path_normalizer_test.go`

**Function:** `NormalizePath(raw string) string`
- `/users/123` → `/users/:id`
- `/orgs/a8f3c…` (UUID or ≥16-char hex/base62) → `/orgs/:id`
- Query string은 유지하지 않음 (`?` 이후 제거)
- 이미 `:name` 형태면 그대로.

**Cases to test:**
| Input | Expected |
|-------|----------|
| `/users/42` | `/users/:id` |
| `/users/42/posts/7` | `/users/:id/posts/:id` |
| `/health` | `/health` |
| `/api/v1/users?x=1` | `/api/v1/users` |
| `/files/550e8400-e29b-41d4-a716-446655440000` | `/files/:id` |
| `/files/abc` | `/files/abc` (short alphanumeric = keep) |

Step 1→5 TDD. Commit `feat(ingest): path normalizer`.

---

### Task 2.2: Mask utility

**Files:**
- Create: `backend/internal/api/handlers/mask.go`
- Test: `backend/internal/api/handlers/mask_test.go`

**Functions:**
```go
func MaskHeaders(h map[string]string, masked []string) map[string]string
// case-insensitive match; value replaced with "***"

func MaskJSONBody(body string, fields []string) string
// tries to parse as JSON object; recursively replaces values at matching keys (case-insensitive).
// if parse fails → return body unchanged.

func TruncateBody(body string, maxBytes int) (truncated string, originalSize int)
// if len(body) > maxBytes → return body[:maxBytes] + fmt.Sprintf("…[truncated, %d bytes]", len(body))
```

**Cases:**
- Header `Authorization: Bearer xyz` → `***` (case-insensitive header name).
- Body `{"user":"bob","password":"s3cret","nested":{"token":"t"}}` + fields `[password,token]` → both replaced with `"***"`, `user` untouched.
- Non-JSON body → unchanged.
- Truncate: 10 KB body with cap 4 KB → first 4 KB + suffix; originalSize = 10240.

Step 1→5 TDD. Commit `feat(ingest): header/body masking + truncation utils`.

---

### Task 2.3: Sampling decision

**Files:**
- Create: `backend/internal/api/handlers/capture_decision.go`
- Test: `backend/internal/api/handlers/capture_decision_test.go`

**Function:**
```go
// shouldCapture returns true if the entry must be stored based on the capture config.
// Uses crypto/rand-based sampling (not math/rand) for determinism within tests via injected RNG.
func shouldCapture(cfg *models.ApiCaptureConfig, statusCode int, errorStr string, rng func() float64) bool
```

**Logic:**
- `disabled` → false
- entry is error (status≥500 or errorStr != "") → true
- `errors_only` (non-error) → false
- `all` → true
- `sampled` → `rng() < float64(SampleRate)/100.0`

**Tests:** table-driven — each mode × (error / non-error) × sample rate 0/50/100, using deterministic rng.

TDD cycle. Commit `feat(ingest): sampling decision logic`.

---

### Task 2.4: Ingest handler `POST /api/v1/ingest/requests`

**Files:**
- Create: `backend/internal/api/handlers/api_request_ingest.go`
- Create: `backend/internal/api/middleware/api_request_rate_limiter.go` — `ApiRequestIngestRateLimiter()` (per-service key, 기존 `IngestRateLimiter` 구조 복사 후 독립 상태 저장소 사용).
- Modify: `backend/internal/api/routes.go` — 새 라우트를 **별도 그룹**으로 등록: `ApiKeyAuth` + `ApiRequestIngestRateLimiter` + `BodyLimit(1 MiB)`. 기존 `/ingest/logs` 그룹과 분리.
- Modify: `backend/internal/api/handlers/errors.go` — add `ErrCodeApiRequestIngest = "API_REQUEST_INGEST_ERROR"` if needed.
- Test: add `TestApiRequestIngest_*` to `backend/internal/api/handlers/integration_test.go`.

**Rationale (버스트 방어):** 로그와 요청은 payload 크기 특성이 달라(로그 ≤50 KB, 요청 ≤1 MiB) 같은 리미터/그룹을 공유하면 한 쪽 트래픽이 다른 쪽을 기아 상태로 만듦. 인메모리 버퍼는 YAGNI로 v1에서 제외 — 위 **Non-goals** 의 v2 트리거 도달 시 도입.

**Flow (per entry):**
1. Validate: method non-empty (≤10 chars), path non-empty (≤2 KB), statusCode in [100,599], durationMs ≥0.
2. Normalize path → `pathTemplate`.
3. Load `ApiCaptureConfig` from service (cache in request-local var).
4. `isError = statusCode >= 500 || entry.Error != ""`
5. `shouldCapture(cfg, ...)` — if false, increment `filtered` counter and continue.
6. Mask headers with `cfg.MaskedHeaders`.
7. Mask req/res JSON bodies with `cfg.MaskedBodyFields`.
8. Truncate req/res bodies with `cfg.BodyMaxBytes`; record original sizes.
9. Ensure `RequestID` — if empty, generate ULID (use `github.com/oklog/ulid/v2` — add to go.mod).
10. Build `models.ApiRequest` → `repo.Create(...)` (or `CreateBatch` for ≥2 entries).

**Response:** same shape as log ingest (single vs batch), includes `filtered` counter.

**Integration tests (add to `integration_test.go`):**
- `TestApiRequestIngest_WithApiKey` — mode=all, POST single request, GET list returns 1.
- `TestApiRequestIngest_ModeDisabled` — mode=disabled → 201 with `filtered:1`, DB empty.
- `TestApiRequestIngest_ModeErrorsOnly` — 2 entries (200, 500); only 500 stored.
- `TestApiRequestIngest_ModeSampled` — mode=sampled with SampleRate=0, non-error entry → filtered; error entry → stored.
- `TestApiRequestIngest_MasksAndTruncates` — POST with `Authorization: Bearer x` + body `{"password":"p"}` + 20 KB res body; verify DB row has `***` for auth header, `***` for password, res_body truncated, res_body_size=20480.
- `TestApiRequestIngest_BatchLimit` — 51 entries → 400 VALIDATION_ERROR.
- `TestApiRequestIngest_BodyLimit` — 2 MiB payload → 413 Payload Too Large (Fiber BodyLimit 기본 동작).
- `TestApiRequestIngest_InvalidApiKey` — 401.
- `TestApiRequestIngest_RateLimiterIsolated` — 로그 ingest 리미터를 전부 소진한 상태에서 request ingest 는 200 통과 (상태 저장소 분리 검증).

TDD: write tests first, run (FAIL), implement handler until all pass. Commit per test group (3 commits: happy+config, masking+truncate, errors).

---

### Task 2.5: Capture config endpoints

**Files:**
- Create: `backend/internal/api/handlers/api_capture_config.go`
- Modify: `backend/internal/api/routes.go` — add under protected group.
- Test: `integration_test.go` — `TestApiCaptureConfig_GetAndUpdate`.

**Endpoints:**
- `GET /api/v1/services/:id/api-capture-config` → `ApiCaptureConfig` (defaults applied if NULL).
- `PUT /api/v1/services/:id/api-capture-config` → validates input, persists.

**Validation:**
- Mode ∈ {disabled, errors_only, sampled, all}
- SampleRate ∈ [0,100]
- BodyMaxBytes ∈ [0, 65536]
- Each masked list item ≤64 chars; overall count ≤32.

Return `400 VALIDATION_ERROR` with existing error pattern on invalid input.

TDD. Commit `feat(api): per-service capture config endpoints`.

---

### Task 2.6: Retention worker

**Files:**
- Modify: `backend/internal/aggregator/stats_worker.go` (or create if doesn't exist) — add `cleanupApiRequests(cutoff)` called once per hour.
- Modify: `backend/internal/config/config.go` — add `Retention.ApiRequestsDays` default 14.
- Test: `backend/internal/aggregator/stats_worker_test.go` — insert rows with past `created_at`, run cleanup, assert count.

TDD. Commit `feat(retention): api_requests 14-day cleanup worker`.

---

## Phase 3 — Frontend: Types + API Client

### Task 3.1: TypeScript types + API methods

**Files:**
- Modify: `frontend/src/services/api.ts`

**Add types (mirror backend JSON):**
```ts
export type ApiCaptureMode = 'disabled' | 'errors_only' | 'sampled' | 'all';

export interface ApiRequest {
  id: number;
  serviceId: string;
  requestId: string;
  method: string;
  path: string;
  pathTemplate: string;
  statusCode: number;
  durationMs: number;
  clientIp?: string;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
  reqBodySize: number;
  resHeaders?: Record<string, string>;
  resBody?: string;
  resBodySize: number;
  error?: string;
  isError: boolean;
  createdAt: string;
}

export interface ApiCaptureConfig {
  mode: ApiCaptureMode;
  sampleRate: number;
  bodyMaxBytes: number;
  maskedHeaders: string[];
  maskedBodyFields: string[];
}

export interface ApiRequestListParams {
  limit?: number;
  offset?: number;
  errorsOnly?: boolean;
  method?: string;
  minStatus?: number;
  maxStatus?: number;
  pathPrefix?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface ApiRequestListResponse {
  items: ApiRequest[];
  total: number;
}
```

**Add methods to `ApiService`:**
- `getServiceApiRequests(serviceId, params): Promise<ApiRequestListResponse>`
- `getApiRequestById(id): Promise<ApiRequest>`
- `getApiCaptureConfig(serviceId): Promise<ApiCaptureConfig>`
- `updateApiCaptureConfig(serviceId, cfg): Promise<ApiCaptureConfig>`

**No dedicated unit test** (thin wrapper). Verify via TS compile + Phase 5 UI.

Commit `feat(api): ApiRequest + capture config types/methods`.

---

## Phase 4 — Frontend: Requests Tab UI

### Task 4.1: Folder scaffold

**Files:**
- Create dir: `frontend/src/features/api-requests/`
- Create: `frontend/src/features/api-requests/index.ts`
- Create: `frontend/src/features/api-requests/hooks/useApiRequests.ts` — wraps `api.getServiceApiRequests` (uses existing `useDataFetch` pattern; no mock — returns empty initially).

Commit `feat(api-requests): folder scaffold + useApiRequests hook`.

---

### Task 4.2: `RequestsTable` component

**Files:**
- Create: `frontend/src/features/api-requests/components/RequestsTable.tsx`

**Columns (desktop):** Time · Method (badge) · Path (template + raw tooltip) · Status (colored badge) · Duration (ms) · RequestID (mono, short).

**Props:**
```ts
interface Props {
  items: ApiRequest[];
  loading: boolean;
  onSelect: (req: ApiRequest) => void;
}
```

**Styling:** follow CLAUDE.md standard card + `<StatusBadge>` helper pattern.
- 2xx = emerald, 3xx = sky, 4xx = amber, 5xx = red, else slate.
- Method colors: GET=sky, POST=emerald, PUT/PATCH=amber, DELETE=red.

Commit `feat(api-requests): RequestsTable component`.

---

### Task 4.3: `RequestFilters` bar

**Files:**
- Create: `frontend/src/features/api-requests/components/RequestFilters.tsx`

**Controls:**
- Search input (path + body).
- Method multi-select chip row.
- Status quick filters: All / 2xx / 4xx / 5xx (radio).
- "Errors only" toggle.
- Time range selector (1h / 6h / 24h / 7d / custom).

Parent component keeps filter state; this is pure presentational.

Commit `feat(api-requests): filter bar`.

---

### Task 4.4: `RequestDetailDrawer`

**Files:**
- Create: `frontend/src/features/api-requests/components/RequestDetailDrawer.tsx`

**Layout:** right-side drawer (reuse `SidePanelContext` pattern).

**Sections:**
1. Header: method badge + path + status + duration + timestamp + request_id (copy button).
2. Tabs: `Request` | `Response` | `Raw JSON`
3. Each has sub-sections: Headers (key-value list; masked values highlighted), Body (pretty-print JSON when parseable; else plain text; show "Truncated from X bytes" banner when `bodyN < bodySize`).

**Copy buttons:** path, request_id, headers (as JSON), body (raw).

Commit `feat(api-requests): request detail drawer`.

---

### Task 4.5: `RequestsTab` page glue

**Files:**
- Create: `frontend/src/features/api-requests/components/RequestsTab.tsx`
- Modify: `frontend/src/features/logs/components/LogDetailView.tsx` — add "Requests" tab between Logs and Integration (4 tabs total).
- Modify: `frontend/src/pages/LogDetailPage.tsx` — extend `TabKey` union to include `'requests'`; URL param handling.

`RequestsTab`:
- Filter state (managed here).
- Fetches via `useApiRequests(serviceId, filters)` with debounced search.
- Pagination: "Load more" button (append), page size 50.
- Row click → open `RequestDetailDrawer` via `useSidePanel().openPanel`.
- Empty state per CLAUDE.md `EmptyState` pattern with action "Configure capture" → jump to Settings tab.

Commit `feat(logs): add Requests tab to service detail page`.

---

### Task 4.6: Capture config UI in Settings tab

**Files:**
- Create: `frontend/src/features/api-requests/components/ApiCaptureSettings.tsx`
- Modify: `frontend/src/features/logs/components/LogServiceSettings.tsx` — embed `<ApiCaptureSettings serviceId={service.id} />` as a new section.

**Form:**
- Mode: segmented control (4 options with descriptions).
- Sample rate: slider 0–100, disabled unless Mode=sampled.
- Body max bytes: number input (step 1024, range 0–65536), show as KiB.
- Masked headers: tag input (add/remove chips), shows defaults as ghost chips.
- Masked body fields: tag input.
- "Save" button → `api.updateApiCaptureConfig(...)`, toast on success/error via `getErrorMessage`.

Commit `feat(logs): API capture config section in settings`.

---

### Task 4.7: i18n keys

**Files:**
- Modify: `frontend/src/locales/ko/logs.json`
- Modify: `frontend/src/locales/en/logs.json`
- Modify: `frontend/src/locales/{ko,en}/errors.json` — add `API_REQUEST_INGEST_ERROR` if introduced in Phase 2.

**Add namespace `apiRequests.*`:** tabs.title, filters.*, detail.*, settings.*, modes.disabled/errors_only/sampled/all + descriptions.

Commit `chore(i18n): api-requests namespace`.

---

## Phase 5 — Integration Snippet + Documentation

### Task 5.1: Ingest snippet in IntegrationPanel

**Files:**
- Modify: existing integration panel under `features/logs/components/` (probably referenced from `LogDetailView`; grep `IntegrationPanel`).

**Add a new snippet category "API Request Capture"** showing:
- Curl example hitting `POST /api/v1/ingest/requests` with API key.
- Minimal Express middleware example (JS) that wraps req/res and posts to MT.
- Minimal Go middleware example.

Commit `feat(logs): API request ingest snippets in integration panel`.

---

### Task 5.2: Docs

**Files:**
- Create: `doc/API_REQUEST_MONITORING_SPEC.md`

**Contents:** data model, endpoints, config semantics, masking rules, retention, curl examples. Keep ≤ 250 lines.

Commit `docs: API request monitoring spec`.

---

## Phase 6 — Verification

### Task 6.1: Full test sweep

```bash
cd backend && go test ./... -count=1
cd ../frontend && pnpm typecheck && pnpm lint
```

Expect: all tests pass. Pre-existing TS errors in `LogsPage.tsx` and `settings.schema.ts` are known (see CLAUDE.md build notes).

---

### Task 6.2: Manual E2E (UI)

```bash
# Terminal A
cd backend && go run ./cmd/api
# Terminal B
cd frontend && pnpm dev
```

Scripted flow:
1. Create a log service → copy API key.
2. `curl -X POST http://localhost:8080/api/v1/ingest/requests -H "X-API-Key: $KEY" -H "Content-Type: application/json" -d '{"method":"GET","path":"/users/42","statusCode":200,"durationMs":12,"reqHeaders":{"Authorization":"Bearer xyz"}}'`
3. Open `/logs/<id>` → Requests tab → verify row appears, drawer shows `***` for Authorization.
4. Change capture mode to `errors_only` → send 2 more (200, 500) → verify only 500 persisted.
5. Send body >8 KB → verify "Truncated from N bytes" banner.

---

## Execution Order & Commit Cadence

- Each task ends with a commit. Expect ~18–22 commits for this plan.
- Do NOT batch phases into single commit. If a task's test fails and the fix spans commits, push as separate `fix:` commits — never `--amend` into prior TDD commit.
- After Phase 1 complete, optionally push to branch for early CI signal.

## Risk Register

| Risk | Mitigation |
|------|-----------|
| SQLite single-connection deadlock on nested queries | Follow CLAUDE.md: load rows fully, close iterator, then do follow-up queries |
| Body masking JSON parse cost on hot path | Only mask JSON bodies if Content-Type (from `ReqHeaders`) indicates JSON; skip otherwise |
| Storage explosion with mode=all on high-volume service | Enforce retention worker; surface row count in Settings tab; default remains `sampled@10%` |
| 동기 insert가 트래픽 버스트에 취약 | v1은 전용 rate limiter + body limit + 낮은 batch 상한으로 1차 방어. v2 트리거(p95>200ms, DB 대기, >200 rps/service) 도달 시 비동기 버퍼 도입 |
| PII leakage if user misconfigures masking | Defaults cover common cases (auth, cookies, password, token); doc calls out that app-specific fields need adding |
| Frontend tab URL state backward compat | New tab value `'requests'` added at end of union; old `?tab=logs|integration|settings` URLs untouched |

---

**Plan complete.**
