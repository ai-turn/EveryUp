# EveryUp 작업 이력

> 주요 기능 추가 / 리팩토링 / 버그 픽스 이력. 커밋 단위가 아닌 작업 단위로 기록.

---

## [2026-04-17~18] API 요청 모니터링

로그 서비스 상세 페이지에 **"Requests" 탭** 추가. 개별 API 요청/응답을 수집·조회하는 인스펙터.

### 주요 변경
- `POST /api/v1/ingest/requests` — 전용 rate limiter + 1 MiB body limit (로그 ingest와 독립)
- `api_requests` 테이블 신설 (migrateV20): method, path, headers, body, status, duration, request_id 저장
- 서비스별 캡처 설정: mode(disabled/errors_only/sampled/all), 샘플링률, 본문 크기 캡, 마스킹 리스트
- 기본값: sampled@10%, 에러(5xx) 항상 캡처, 본문 8KiB 캡, 14일 보존
- 서버사이드 마스킹: `authorization`, `cookie` 등 헤더 + `password`, `token` 등 바디 필드
- 경로 정규화: `/users/42` → `/users/:id` (UUID, 숫자, 16자 이상 hex 자동 치환)

### 새 파일
**Backend:** `models/api_request.go`, `database/repository_api_request.go`, `handlers/api_request_ingest.go`, `handlers/api_capture_config.go`, `handlers/path_normalizer.go`, `handlers/mask.go`, `handlers/capture_decision.go`, `middleware/api_request_rate_limiter.go`

**Frontend:** `features/api-requests/` (RequestsTable, RequestFilters, RequestDetailDrawer, RequestsTab, ApiCaptureSettings, useApiRequests hook)

### 설계 결정
- 로그 ingest(`/ingest/logs`)와 요청 ingest(`/ingest/requests`)를 별도 그룹으로 분리 — payload 크기 특성 차이(버스트 방어)
- 비동기 버퍼는 v2로 유보: p95 > 200ms 또는 서비스당 > 200 rps 도달 시 도입

---

## [2026-03-16] 백엔드 통합 테스트 추가

`backend/internal/api/handlers/integration_test.go` 신설.

- In-memory SQLite + 실제 Fiber 라우트/미들웨어 — 모킹 없는 end-to-end 테스트
- `setupTestServer(t)` 헬퍼: DB → Crypto/JWT → Fiber + Hub + Scheduler + CollectorManager + AlertManager → SetupRoutes → t.Cleanup 자동 정리
- **커버리지 (18개 → 이후 30개로 확장):** Auth(8), Service CRUD+검증(4), Host 예약ID(1), Health(1), Notification CRUD(2), Log Ingest API key(3), Alert Rule CRUD(1)

---

## [2026-03-01] 인증 시스템 리팩토링

GitHub OAuth 제거 → **로컬 계정 기반 인증**으로 전환.

- `GET /auth/setup/status` → 최초 실행 여부 확인 (public)
- `POST /auth/setup` → 최초 관리자 계정 생성 (이후 403 차단)
- `POST /auth/login` → bcrypt 검증 + JWT httpOnly 쿠키
- JWT secret / AES-256-GCM 암호화 키 → `app_settings` 테이블에 자동 생성·저장 (migrateV16)
- `users` 테이블 추가 (migrateV18): `id, username, password_hash, role, created_at`
- 보안 헤더 추가, 에러 메시지 sanitization

---

## [2026-02-18] 알림 시스템 동시성 버그 수정

`alerter/` 패키지 race condition 및 구조 개선.

- `SaveState()` race fix: mutex 하에서 스냅샷 후 DB I/O
- `evaluateRule()`: `defer` 대신 명시적 `Unlock` (goroutine 분기 전)
- 재시도 sleep → `select { case <-time.After: case <-ctx.Done(): }` (context-aware)
- `Manager.Shutdown()`: ctx/cancel 필드 추가 → 앱 종료 시 in-flight 재시도 취소
- `Notification.RuleID` 추가 → `notification_history` 테이블에 rule_id 저장
- Frontend: NotificationHistoryTab 필터에 "endpoint" 타입 추가

---

## [2026-02-14] Repository 모노리스 분리

`repository.go` (1,386줄 단일 파일) → **도메인별 파일 12개**로 분리.

```
database/
├── sqlite.go                      # DB 연결, 마이그레이션, Transaction()
├── repository_service.go
├── repository_metric.go
├── repository_log.go
├── repository_incident.go
├── repository_notification.go
├── repository_host.go
├── repository_system_metric.go
├── repository_alert_rule.go
└── repository_api_request.go      # 2026-04-17 추가
```

SQLite 단일 커넥션 데드락 버그도 함께 수정: `rows.Next()` 루프 내부 중첩 쿼리 → rows 닫은 후 별도 루프로 변경.

---

## [2026-02-10] SSH 원격 호스트 모니터링

로컬 호스트 외에 SSH로 연결된 원격 서버 리소스 수집.

- `SSHCollector`: `/proc` 파싱 (stat, meminfo, diskstats, net/dev) + 커넥션 풀링(keep-alive)
- `Host` 모델: SSHUser, SSHPort, SSHAuthType(password/key/key_file), SSHKey, SSHPassword, LastError 필드 추가 (migrateV4)
- `MaskSecrets()`: API 응답에서 SSH 비밀번호/키 자동 마스킹
- `POST /hosts/test-connection`: SSH 연결 사전 테스트
- config: `system.ssh.*` (connectionTimeout, commandTimeout, maxReconnectAttempts, keepAliveInterval)

---

## [2026-02-08~09] 리소스 모니터링 (로컬)

서버 CPU·메모리·디스크·네트워크 실시간 수집 및 시각화.

- `LocalCollector`: gopsutil 기반 수집
- `CollectorManager`: 수집 스케줄링, 버퍼링, WebSocket 브로드캐스트
- Frontend: ResourceGauges (RadialGauge), ResourceTrends (SparklineChart), ProcessTable
- `MonitoringPage`: resourceId URL 파라미터 → useHost(hostId) 훅

---

## [초기] 프로젝트 기반 구축

- **백엔드**: Go (Fiber v2) + SQLite (modernc.org, CGO-free) + WebSocket Hub + Viper 설정
- **프론트엔드**: React 19 + Vite + TypeScript + Tailwind v4, Pretendard Variable 폰트 자체 호스팅
- **인증**: JWT HMAC-SHA256 (7일) + httpOnly 쿠키
- **알림**: Webhook / Slack / 이메일 채널, 규칙 기반 평가
- **로그**: log-agent (Fluent Bit 기반) → `/ingest/logs` API key 수집
- **헬스체크**: HTTP / TCP / ICMP 서비스 모니터링
- **데모 모드**: GitHub Pages 배포용 mock 라우터, VITE_USE_MOCK=true
- **Docker**: 멀티아치(amd64/arm64) 이미지, GitHub Actions CI/CD
