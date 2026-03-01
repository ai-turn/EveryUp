# MT Monitoring

> 셀프 호스팅 통합 모니터링 플랫폼 — 서비스 헬스체크, 인프라 리소스, 알림을 하나의 대시보드에서 관리합니다.

![License](https://img.shields.io/badge/license-MIT-blue)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **서비스 모니터링** | HTTP/TCP 헬스체크, 업타임, 레이턴시 추적 |
| **인프라 모니터링** | CPU/메모리/디스크/네트워크 실시간 수집 (로컬 + SSH 원격) |
| **알림** | Telegram / Discord 채널 연동, 임계값 기반 규칙 |
| **로그 관리** | 통합 로그 뷰어, 검색, Fluent Bit 에이전트 수집 |
| **실시간 스트리밍** | WebSocket 기반 메트릭 실시간 업데이트 |

---

## 프로젝트 구조

```
mt-app/
├── frontend/      # React + Vite + TypeScript + Tailwind CSS
├── backend/       # Go (Fiber) + SQLite + WebSocket
└── log-agent/     # Fluent Bit 기반 로그 수집 에이전트
```

---

## 빠른 시작

### Docker로 배포 (권장)

**1. 환경 변수 설정 (선택)**

```bash
cp .env.example .env
# 필요 시 .env 파일에서 타임존 등 선택 옵션 수정
```

| 변수 | 설명 | 필수 |
|------|------|:----:|
| `TZ` | 타임존 (기본: `UTC`) | |
| `MT_SERVER_PORT` | 서버 포트 (기본: `3001`) | |

> **별도 계정 설정이 필요 없습니다.** 처음 실행 후 브라우저에서 관리자 계정을 직접 생성합니다.
> **암호화 키와 JWT 시크릿도 별도 설정 없이** 앱이 최초 실행 시 자동 생성하여 DB에 저장합니다.

**2. 실행**

```bash
docker compose up -d
```

→ http://localhost:3001 접속 후 관리자 계정 생성

**3. 상태 확인**

```bash
docker compose ps
docker compose logs -f
```

---

### Docker Hub에서 직접 실행

```bash
# 이미지 받기
docker pull aiturn/mt-monitoring:latest

# 실행
docker run -d \
  --name mt-monitoring \
  -p 3001:3001 \
  -v mt-data:/app/data \
  -e TZ=Asia/Seoul \
  aiturn/mt-monitoring:latest
```

---

### 로컬 개발

**백엔드**
```bash
cd backend
go run ./cmd/server
# → http://localhost:3001
```

**프론트엔드**
```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:5173
```

---

## 로그 에이전트

외부 서비스의 로그를 수집하려면 해당 서버에 `mt-log-agent`를 배포합니다.

```bash
docker run -d \
  -v /var/log/myapp:/var/log/app:ro \
  -e MT_ENDPOINT=http://your-mt-server:3001 \
  -e MT_API_KEY=mt_your_api_key \
  aiturn/mt-log-agent:latest
```

자세한 내용은 [log-agent/README.md](log-agent/README.md)를 참고하세요.

---

## 문서

| 문서 | 설명 |
|------|------|
| [backend/README.md](backend/README.md) | 백엔드 API 및 설정 문서 |
| [log-agent/README.md](log-agent/README.md) | 로그 에이전트 배포 가이드 |

---

## 라이선스

MIT
