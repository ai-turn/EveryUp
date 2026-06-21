# Web → Agent 전환 변경 로드맵

**작성일:** 2026-06-21  
**배경:** 기존 Web이 SSH로 직접 수집하던 인프라/헬스체크/로그를 Agent가 담당하는 구조로 전환.  
**현황:** Agent Phase 0~10 구현 완료. Web 쪽 코드는 아직 기존 SSHCollector 방식 그대로.

---

## Phase 1 — SSH 코드 제거 (Dead Code 정리) ✅ 완료

Agent가 원격 호스트 메트릭을 담당하므로 Web의 SSHCollector 연동은 불필요.  
**테스트 통과만 확인하면 바로 진행 가능.**

### 백엔드

| 파일 | 작업 |
|---|---|
| `web/backend/internal/api/handlers/hosts.go` | Create(L309-312): `collectorMgr.RegisterSSHHost()` 제거 |
| `web/backend/internal/api/handlers/hosts.go` | Delete(L434-437): remote host `Unregister()` 제거 |
| `web/backend/internal/api/handlers/hosts.go` | Pause(L472-475): `Unregister()` 제거 |
| `web/backend/internal/api/handlers/hosts.go` | Resume(L507-514): `RegisterSSHHost()` 재등록 제거 |
| `web/backend/internal/api/handlers/hosts.go` | `HostHandler.collectorMgr` 필드 + 생성자 파라미터 제거 |
| `web/backend/internal/api/handlers/ssh_test_handler.go` | **파일 전체 삭제** |
| `web/backend/internal/api/routes.go` | L100: `NewHostHandler(collectorMgr)` → `NewHostHandler()` |
| `web/backend/internal/api/routes.go` | L111-112: `/hosts/test-connection` 라우트 제거 |
| `web/backend/cmd/server/main.go` | L154: `collectorMgr.RegisterSSHHost(&remoteHosts[i])` 루프 제거 |

### 프론트엔드

| 파일 | 작업 |
|---|---|
| `web/frontend/src/features/infra/components/InfraForm.tsx` | `isTesting`, `testResult`, `testError` state 제거 |
| `web/frontend/src/features/infra/components/InfraForm.tsx` | `handleTestConnection()` 함수 제거 |
| `web/frontend/src/features/infra/components/InfraForm.tsx` | SSH 테스트 버튼 + 결과 표시 UI 블록 제거 |
| `web/frontend/src/services/api/hosts.ts` | `testSSHConnection()` 함수 제거 |
| `web/frontend/src/services/api/hosts.ts` | `SSHTestResult` 타입 제거 |

---

## Phase 2 — 원격 호스트 메트릭 수집 경로 복구 (핵심 갭) ✅ 완료

### 문제

SSHCollector 제거 후 원격 호스트의 CPU/메모리/디스크 시계열 데이터가 `system_metrics` DB에 쌓이지 않음.  
인프라 대시보드 차트가 빈 화면이 됨.

현재 Agent는 `/api/v1/agents/:id/events`로 audit 이벤트만 보내고 메트릭 시계열은 Web DB에 넣는 경로가 없음.

### 해결 방향 (둘 중 선택)

**A안 — OTLP metrics 경로 (표준, 중장기)**
- OTel Collector → `EVERYUP_WEB_OTLP_ENDPOINT` 포워딩
- Web OTLP 수신부에서 hostmetrics → `system_metrics` 테이블 저장 처리 추가
- 장점: 표준 방식, Agent Phase 4(OTel Sidecar)와 자연스럽게 연결
- 단점: Web OTLP 파이프라인에 메트릭 저장 로직 추가 필요, 구현량 많음

**B안 — Agent 메트릭 동기화 API (빠른 방법)**
- Web에 `POST /api/v1/agents/:id/metrics` 엔드포인트 추가
- Agent의 `hostmetrics.Reader` 수집 결과를 30초마다 Web으로 POST
- Web이 `system_metrics` 테이블에 저장 → 기존 인프라 대시보드 차트 그대로 동작
- 장점: 구현 빠름, 기존 UI 변경 없음
- 단점: OTLP 표준이 아닌 별도 API

**권장:** B안으로 먼저 빠르게 복구 → 이후 A안으로 대체

---

## Phase 3 — system.go DB 전용 전환 ✅ 완료

현재 `GetInfo`, `GetMetricsHistory`, `GetProcesses`가 모두 `collectorMgr`에만 의존.  
Phase 2 완료 후 원격 호스트는 DB에서만 읽도록 전환.

| 핸들러 | 현재 | 변경 후 |
|---|---|---|
| `GetInfo` | manager 캐시 → collector 직접 호출 | DB 최신 메트릭 조회 (원격), LocalCollector 유지 (local) |
| `GetMetricsHistory` | `h.manager.GetHistory()` | `getHistoryFromDB()` 활용 (이미 구현됨, 미사용 상태) |
| `GetProcesses` | `manager.GetCollector()` | local만 LocalCollector, 원격은 Agent 데이터 없으면 503 |

> `LocalCollector`(Web 서버 자체 모니터링)는 유지.  
> `main.go`의 LocalCollector 등록과 collectorMgr는 local 전용으로 남김.  
> SSHCollector 관련 코드(`collector/ssh_collector.go`)는 Phase 3 완료 후 삭제 가능.

---

## 정리: 우선순위

| 순서 | 작업 | 난이도 | 의존성 |
|---|---|---|---|
| 1 | Phase 1 — SSH 코드 제거 | 낮음 | 없음 |
| 2 | Phase 2 — 메트릭 갭 복구 (B안) | 중간 | Phase 1 완료 후 |
| 3 | Phase 3 — system.go DB 전환 | 중간 | Phase 2 완료 후 |
| 4 | `collector/ssh_collector.go` 파일 삭제 ✅ | 낮음 | Phase 3 완료 후 |
| 5 | Phase 2 A안 (OTLP metrics) 으로 교체 | 높음 | 선택사항 |
