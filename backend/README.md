# EveryUp API

Go (Fiber) + SQLite + WebSocket 기반 모니터링 백엔드 서버

## 특징

- **경량화**: CGO 없는 순수 Go SQLite 드라이버, 메모리 ~50MB
- **제로 설정**: `go run ./cmd/server` 한 번으로 즉시 실행
- **실시간**: WebSocket을 통한 시스템 메트릭 스트리밍
- **SSH 원격 수집**: 원격 서버의 `/proc` 파싱으로 메트릭 수집

## 빠른 시작

### 로컬 개발

```bash
# 의존성 설치
go mod download

# 실행 (기본 포트 3001)
go run ./cmd/server

# Air로 핫 리로드
air
```

### Docker

기본 이미지에는 바로 실행 가능한 기본 `config.json`이 포함되어 있으므로, 처음에는 추가 마운트 없이 시작할 수 있습니다.

**Linux / macOS**
```bash
docker run -d -p 3001:3001 \
  -v mt-data:/app/data \
  aiturn/everyup:latest
```

**Windows (PowerShell)**
```powershell
docker run -d -p 3001:3001 `
  -v mt-data:/app/data `
  aiturn/everyup:latest
```

커스텀 설정이 필요할 때만 `config.json`을 `/app/config.json`으로 마운트하세요.

## 설정

`config.json` 또는 `EVERYUP_` 접두사 환경 변수로 설정합니다.

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3001,
    "mode": "production"
  },
  "database": {
    "path": "./data/monitoring.db"
  },
  "security": {
    "encryptionKey": "your-32-byte-key-here"
  },
  "system": {
    "collectInterval": 5,
    "ssh": {
      "connectionTimeout": 10,
      "commandTimeout": 5,
      "maxReconnectAttempts": 10,
      "keepAliveInterval": 30
    }
  }
}
```

### 주요 환경 변수

| 변수 | 설명 |
|------|------|
| `EVERYUP_SERVER_PORT` | 서버 포트 (기본: 3001) |
| `EVERYUP_DATABASE_PATH` | SQLite DB 경로 |

## API 엔드포인트

기본 prefix: `/api/v1`

### 서비스

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/services` | 서비스 목록 |
| GET | `/services/:id` | 서비스 상세 |
| POST | `/services` | 서비스 추가 |
| PUT | `/services/:id` | 서비스 수정 |
| DELETE | `/services/:id` | 서비스 삭제 |
| POST | `/services/:id/pause` | 모니터링 일시정지 |
| POST | `/services/:id/resume` | 모니터링 재개 |
| POST | `/services/:id/regenerate-key` | API 키 재발급 |
| GET | `/services/:id/metrics` | 서비스 메트릭 |
| GET | `/services/:id/uptime` | 업타임 데이터 |

### 인프라 (Hosts)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/hosts` | 호스트 목록 |
| GET | `/hosts/:id` | 호스트 상세 |
| POST | `/hosts` | 호스트 추가 |
| PUT | `/hosts/:id` | 호스트 수정 |
| DELETE | `/hosts/:id` | 호스트 삭제 |
| POST | `/hosts/:id/pause` | 수집 일시정지 |
| POST | `/hosts/:id/resume` | 수집 재개 |
| POST | `/hosts/test-connection` | SSH 연결 테스트 |
| GET | `/system/info/:hostId` | 시스템 정보 |
| GET | `/system/metrics/history/:hostId` | 메트릭 히스토리 |
| GET | `/system/processes/:hostId` | 프로세스 목록 |

### 알림

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/notifications/channels` | 채널 목록 |
| POST | `/notifications/channels` | 채널 추가 |
| PUT | `/notifications/channels/:id` | 채널 수정 |
| DELETE | `/notifications/channels/:id` | 채널 삭제 |
| POST | `/notifications/channels/:id/test` | 테스트 전송 |
| POST | `/notifications/channels/:id/toggle` | 채널 활성화/비활성화 |
| GET | `/notifications/history` | 알림 이력 |

### 알림 규칙

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/alert-rules` | 규칙 목록 |
| POST | `/alert-rules` | 규칙 추가 |
| PUT | `/alert-rules/:id` | 규칙 수정 |
| DELETE | `/alert-rules/:id` | 규칙 삭제 |
| POST | `/alert-rules/:id/toggle` | 규칙 활성화/비활성화 |

### 로그

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/logs` | 로그 목록 (페이지네이션) |
| POST | `/logs/ingest` | 로그 수집 (API Key 인증) |

### 대시보드

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/dashboard/summary` | KPI 요약 |
| GET | `/dashboard/timeline` | 이벤트 타임라인 |

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: "metrics" | "status"
  // data.hostId: string
  console.log(data);
};
```

## 빌드

**Linux / macOS**
```bash
CGO_ENABLED=0 go build -o server ./cmd/server
```

**Windows (PowerShell)**
```powershell
$env:CGO_ENABLED="0"; go build -o server.exe ./cmd/server
```

**Docker 이미지 빌드**
```bash
docker build -t everyup .
```

## 아키텍처

```
cmd/server/          — 진입점
internal/
├── collector/       — MetricCollector 인터페이스 (로컬/SSH)
├── database/        — SQLite 레포지토리 (도메인별 분리)
├── api/             — 라우트, 미들웨어, HTTP 핸들러
├── models/          — 도메인 모델
└── crypto/          — AES-256-GCM 암호화 (SSH 자격증명)
```

## 라이선스

MIT
