---
name: Nginx 502 Upstream Failure
description: Reverse proxy cannot reach or receive a valid response from upstream.
severity: high
service_types: nginx,proxy,http
patterns: 502,bad gateway,connect() failed,upstream prematurely closed connection,no live upstreams
auto_execute: false
---

## Steps

- Confirm the upstream container is running and listening on the expected port.
- Check Docker labels and network aliases used by the proxy.
- Read upstream application logs before restarting the proxy.
- If only one upstream is down, recover the upstream service first.
