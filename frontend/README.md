# EveryUp Frontend

React + Vite + TypeScript + Tailwind CSS 기반 모니터링 대시보드입니다.

## 빠른 시작

**사전 준비:** [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/installation)

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행 (실제 API 연결)
pnpm dev
```

백엔드 없이 UI만 확인하려면 Mock 데이터를 활성화하세요.

**Linux / macOS**
```bash
VITE_USE_MOCK=true pnpm dev
```

**Windows (PowerShell)**
```powershell
$env:VITE_USE_MOCK="true"; pnpm dev
```

**Windows (CMD)**
```cmd
set VITE_USE_MOCK=true && pnpm dev
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VITE_API_BASE_URL` | `http://localhost:3001/api/v1` | 백엔드 API 기본 경로. 로컬 개발에서는 `.env.example`처럼 `/api/v1`로 두고 Vite 프록시를 사용하는 것을 권장 |
| `VITE_API_TARGET` | `http://localhost:3001` | Vite 개발 서버가 프록시할 실제 백엔드 주소 |
| `VITE_USE_MOCK` | `false` | Mock 데이터 사용 여부 |

## 주요 페이지

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 (KPI, 서비스 현황, 인시던트) |
| `/healthcheck` | 서비스 목록 및 헬스체크 관리 |
| `/healthcheck/:serviceId` | 서비스 상세 (메트릭, 로그, 통합 설정) |
| `/infra` | 인프라 리스트 (서버/DB/컨테이너) |
| `/infra/:resourceId` | 인프라 상세 (CPU/메모리/디스크/프로세스) |
| `/logs` | 통합 로그 뷰어 |
| `/alerts` | 알림 채널 및 규칙 관리 |
| `/settings` | 시스템 설정 |

## 기술 스택

- **React 19** + **Vite**
- **TypeScript**
- **Tailwind CSS v4**
- **react-i18next** — 한국어/영어 다국어 지원
- **react-hook-form** + **Zod** — 폼 유효성 검사
- **react-hot-toast** — 토스트 알림

## 빌드

```bash
pnpm build
# 정적 파일이 dist/ 폴더에 생성됩니다.
```
