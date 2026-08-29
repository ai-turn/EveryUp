# Demo mock scenarios

Use the **데모 상태** selector in the Live Demo banner (mobile/tablet) or
sidebar (desktop) while `VITE_USE_MOCK=true`. The selected state persists for
the current browser session as you navigate.

| Scenario | URL | Purpose |
|---|---|---|
| `attention` (default) | 확인 필요 | Healthy and unhealthy services together, so the operator's next action is visible. |
| `normal` | 정상 운영 | Fresh collection and healthy service data; verifies the calm, no-action-needed state. |
| `empty` | 첫 시작 | A first-run workspace with no monitoring targets. |
| `partial-failure` | 부분 수집 실패 | Services and direct telemetry fail independently while the other overview regions remain visible and retryable. |

Scenarios return copied read data where they need a variation. The base fixtures remain mutable for normal demo create, update, and delete flows. Legacy `mockScenario` URL links still work, but the selector is the intended UX.
