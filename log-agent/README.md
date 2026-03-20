# MT Log Agent

Fluent Bit 기반 로그 수집 에이전트입니다.
모니터링할 서비스가 실행 중인 서버에 함께 배포하여, 로그 파일을 EveryUp 서버로 전송합니다.

```
┌─────────────────────────────────────────────┐
│  모니터링 대상 서버                            │
│                                             │
│  ┌──────────┐    로그 파일    ┌────────────┐ │       ┌──────────────┐
│  │  My App  │ ──────────── > │ Log Agent  │ │ ────> │ EveryUp 서버  │
│  └──────────┘  /var/log/app  └────────────┘ │ HTTP  └──────────────┘
└─────────────────────────────────────────────┘
```

---

## 사전 준비

1. **EveryUp 서버**가 실행 중이어야 합니다
2. **서비스 등록** — EveryUp 대시보드에서 로그를 수집할 서비스를 먼저 등록합니다
3. **API Key 발급** — 서비스 상세 → **Integration** 탭에서 API Key를 복사합니다

---

## 빠른 시작

### 1. 이미지 받기

```bash
docker pull aiturn/everyup-log-agent:latest
```

### 2. Docker Run

호스트 파일시스템의 로그 디렉토리를 마운트해 바로 실행합니다.

```bash
docker run -d \
  --name everyup-log-agent \
  -v /path/to/your/app/logs:/var/log/app:ro \
  -e MT_ENDPOINT=http://your-everyup-server:3001 \
  -e MT_API_KEY=mt_your_api_key_here \
  aiturn/everyup-log-agent:latest
```

### 3. Docker Compose (권장)

모니터링할 서비스와 **같은 `docker-compose.yml`**에 사이드카로 추가하면, named volume으로 로그 파일을 자연스럽게 공유할 수 있습니다.

```yaml
services:
  my-app:
    image: my-app:latest
    volumes:
      - app-logs:/var/log/app    # 앱이 이 경로에 로그 파일을 씁니다

  mt-log-agent:
    image: aiturn/everyup-log-agent:latest
    volumes:
      - app-logs:/var/log/app:ro # 같은 볼륨을 읽기 전용으로 마운트
    environment:
      - MT_ENDPOINT=http://your-everyup-server:3001
      - MT_API_KEY=mt_your_api_key_here
    depends_on:
      - my-app
    restart: unless-stopped

volumes:
  app-logs:
```

```bash
docker compose up -d
```

---

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MT_ENDPOINT` | EveryUp 서버 URL **(권장)** | — |
| `MT_API_KEY` | 서비스 API Key **(필수)** | `changeme` |
| `MT_FILE` | 수집할 로그 파일 경로 (glob 지원) | `/var/log/app/*.log` |
| `MT_LOG_LEVEL` | Fluent Bit 로그 레벨 (`debug`, `info`, `warn`, `error`) | `info` |
| `MT_TEST` | 테스트 콘솔 UI 활성화 | `false` |
| `MT_TEST_PORT` | 테스트 콘솔 포트 | `8080` |

> **`MT_ENDPOINT` 자동 파싱:**
> - `http://192.168.1.10:3001` → host=192.168.1.10, port=3001, tls=off
> - `https://monitoring.example.com` → host=monitoring.example.com, port=443, tls=on

---

## 테스트 콘솔 UI

`MT_TEST=true`로 실행하면 이미지에 내장된 웹 UI가 활성화됩니다.
버튼 한 번으로 INFO / WARN / ERROR 로그를 전송하고, EveryUp 대시보드에서 수신을 바로 확인할 수 있습니다.

```
┌──────────────────────────────────────────┐
│  LOG AGENT  Test Console                 │
├──────────────────────────────────────────┤
│  Send Test Log                           │
│  ┌────────────────────────────────────┐  │
│  │ Test log from UI                   │  │
│  └────────────────────────────────────┘  │
│  [ ▸ INFO ]  [ ▸ WARN ]  [ ▸ ERROR ]    │
│  ● Sent · INFO · "Test log from UI"      │
├──────────────────────────────────────────┤
│  Sent Logs                          (3)  │
│  INFO  Test log from UI       10:01:23   │
│  WARN  Test log from UI       10:01:20   │
│  ERROR Test log from UI       10:01:18   │
└──────────────────────────────────────────┘
```

전송된 로그는 `/var/log/app/test.log`에 기록되고 Fluent Bit이 EveryUp으로 전달합니다.

### 같은 서버의 별도 Compose에서 테스트하기

EveryUp과 같은 머신에서 log agent를 별도 compose로 띄워 테스트할 수 있습니다.
코드 경로는 실제 원격 서버에서 보내는 것과 동일합니다.

#### 방법 A — host.docker.internal 경유 (간단)

```yaml
# docker-compose.test.yml
services:
  mt-log-agent:
    image: aiturn/everyup-log-agent:latest
    ports:
      - "8080:8080"
    environment:
      - MT_TEST=true
      - MT_ENDPOINT=http://host.docker.internal:3001
      - MT_API_KEY=mt_your_api_key_here
    extra_hosts:
      - "host.docker.internal:host-gateway"  # Linux 필수 / Windows·Mac은 자동
```

```bash
docker compose -f docker-compose.test.yml up
```

`http://localhost:8080` 접속 후 버튼을 클릭하면 EveryUp 대시보드 Logs 탭에 로그가 수신됩니다.

#### 방법 B — 공유 네트워크 경유

**1단계 — EveryUp `docker-compose.yml`에 네트워크 추가:**

```yaml
services:
  everyup:
    # ...기존 설정 유지...
    networks:
      - everyup-net

networks:
  everyup-net:
    name: everyup-net
```

```bash
docker compose up -d
```

**2단계 — log agent `docker-compose.test.yml` 작성:**

```yaml
services:
  mt-log-agent:
    image: aiturn/everyup-log-agent:latest
    ports:
      - "8080:8080"
    environment:
      - MT_TEST=true
      - MT_ENDPOINT=http://everyup:3001   # 서비스 이름으로 직접 접근
      - MT_API_KEY=mt_your_api_key_here
    networks:
      - everyup-net

networks:
  everyup-net:
    external: true
```

```bash
docker compose -f docker-compose.test.yml up
```

---

## 로그 포맷

### JSON (권장)

```json
{"level": "error", "message": "connection failed", "service": "api", "userId": 123}
```

인식하는 필드:
- **message**: `message`, `msg`, `log` 중 하나
- **level**: `level`, `levelname`, `severity` 중 하나
- **나머지 필드**: `metadata`로 자동 수집

레벨 매핑:

| 입력값 | 변환 |
|--------|------|
| `FATAL`, `CRITICAL`, `ERROR`, `ERR` | `error` |
| `WARN`, `WARNING` | `warn` |
| `INFO`, `DEBUG`, `TRACE` | `info` |
| 미지정 또는 기타 | `error` |

### 일반 텍스트

JSON이 아닌 텍스트도 수집됩니다. 전체 라인이 `message`로 들어가고 레벨은 `error`로 설정됩니다.

```
2024-03-18 10:30:00 ERROR Failed to connect to database
```

---

## 트러블슈팅

### 로그가 수집되지 않음

- **볼륨 마운트 확인**
  ```bash
  docker exec everyup-log-agent ls -la /var/log/app/
  ```
  파일이 보이지 않으면 볼륨 설정이 잘못된 것입니다.

- **파일 경로 확인** — 기본값은 `/var/log/app/*.log`입니다. 확장자가 다르면 `MT_FILE`을 맞게 설정하세요.
  ```yaml
  environment:
    - MT_FILE=/var/log/app/*
  ```

- **앱이 파일로 로그를 쓰는지 확인** — 컨테이너는 기본적으로 stdout/stderr로만 출력합니다. 앱의 로깅 설정에서 `/var/log/app/app.log` 파일 출력을 추가해야 합니다.

### EveryUp 서버에 로그가 안 보임

- **Agent 로그 확인**
  ```bash
  docker logs everyup-log-agent
  ```
  `Connection refused`, `401 Unauthorized` 등의 에러를 확인하세요.

- **네트워크 연결 확인**
  ```bash
  docker exec everyup-log-agent wget -qO- http://your-everyup-server:3001/api/v1/health
  ```

- **API Key 확인** — EveryUp 대시보드에서 해당 서비스의 API Key가 맞는지 확인하세요.

- **디버그 로그 활성화**
  ```yaml
  environment:
    - MT_LOG_LEVEL=debug
  ```

---

## 빌드 (개발자용)

```bash
# 로컬 빌드
docker build -t everyup-log-agent .

# Docker Hub 배포 (멀티 플랫폼)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t aiturn/everyup-log-agent:latest \
  --push \
  .
```
