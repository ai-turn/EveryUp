# API 요청 모니터링 — request_id 로깅 가이드

## 개요

EveryUp의 API 요청 탭은 **메타데이터만 수집**합니다.

| 수집 항목 | 미수집 항목 |
|-----------|-------------|
| method, path, status_code | request body |
| duration_ms, client_ip | response body |
| request_id, error message | headers |

요청/응답 본문이 필요하면 서비스 자체 로그에 `request_id`를 남겨두세요.  
EveryUp 에러로그탭에서 해당 `request_id`로 검색하면 연결됩니다.

---

## 연결 흐름

```
API 요청 탭                       에러로그탭
─────────────────────────────    ──────────────────────────────────
POST /api/v2/orders  500  ──┐    level=error  request_id=01HV...
  request_id: 01HV...        │    message="Cannot read properties..."
  [로그에서 보기] ────────────┘    body={"userId":"cust_8X2",...}
```

---

## 인제스트 스키마

```http
POST /api/v1/ingest/requests
X-Api-Key: <service-api-key>
Content-Type: application/json

{
  "requests": [
    {
      "requestId": "01HV8QZXKAB1",   // 선택: 없으면 서버에서 ULID 생성
      "method":    "POST",
      "path":      "/api/v2/orders",
      "statusCode": 500,
      "durationMs": 1284,
      "timestamp":  "2026-05-07T12:00:00Z",  // 선택
      "clientIp":   "10.0.0.5",              // 선택
      "error":      "Cannot read properties of undefined" // 선택
    }
  ]
}
```

> 이전 버전의 `reqBody`, `resBody`, `reqHeaders`, `resHeaders`, `bodyMaxBytes`,  
> `maskedHeaders`, `maskedBodyFields` 필드는 **제거**되었습니다.

---

## 서비스별 로깅 예제

서비스가 다음과 같이 로그에 `request_id`를 포함하면 에러로그탭에서 검색됩니다.

### Node.js (Express)

```js
// 미들웨어에서 request_id를 요청에 붙임
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || ulid();
  res.setHeader('x-request-id', req.requestId);
  next();
});

// 에러 핸들러에서 request_id 포함 로깅
app.use((err, req, res, next) => {
  logger.error({
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    status: 500,
    error: err.message,
    body: req.body,        // body는 서비스 로그에만 남김
    stack: err.stack,
  });

  // EveryUp에는 메타데이터만 전송
  everyup.ingest({
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: 500,
    durationMs: Date.now() - req.startTime,
    error: err.message,
  });

  res.status(500).json({ error: 'internal_error' });
});
```

### Python (FastAPI)

```python
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

# 에러 로깅 시
import logging
logger = logging.getLogger(__name__)

def log_error(request: Request, exc: Exception):
    logger.error(
        "request failed",
        extra={
            "request_id": request.state.request_id,
            "method": request.method,
            "path": request.url.path,
            "error": str(exc),
            # body는 서비스 로그에만 남김 — EveryUp으로 전송하지 않음
        }
    )
```

### Go (Fiber / Gin)

```go
// 미들웨어
func RequestIDMiddleware() fiber.Handler {
    return func(c *fiber.Ctx) error {
        requestID := c.Get("X-Request-ID")
        if requestID == "" {
            requestID = ulid.Make().String()
        }
        c.Set("X-Request-ID", requestID)
        c.Locals("requestId", requestID)
        return c.Next()
    }
}

// 에러 로깅
func logError(c *fiber.Ctx, err error) {
    requestID := c.Locals("requestId").(string)
    log.Printf(`{"level":"error","request_id":"%s","path":"%s","error":"%s"}`,
        requestID, c.Path(), err.Error())

    // EveryUp 인제스트 — 메타데이터만
    everyup.Ingest(everyup.Entry{
        RequestID:  requestID,
        Method:     c.Method(),
        Path:       c.Path(),
        StatusCode: 500,
        DurationMs: int(time.Since(start).Milliseconds()),
        Error:      err.Error(),
    })
}
```

---

## 에러로그탭에서 연결 검색

API 요청 탭에서 에러 행의 **[로그에서 보기]** 버튼을 클릭하면  
에러로그탭의 검색창에 해당 `request_id`가 자동으로 입력됩니다.

서비스가 로그에 `request_id`를 남겨두었다면 즉시 매칭됩니다.

---

## 캡처 모드 설명

| 모드 | 동작 |
|------|------|
| `disabled` | 수집 안함 |
| `errors_only` | 5xx 응답만 수집 |
| `sampled` | 5xx는 항상 + 나머지는 설정 비율만 (기본 10%) |
| `all` | 모든 요청 수집 |

> **참고:** 5xx는 모드/샘플 비율에 관계없이 **항상 캡처**됩니다.
