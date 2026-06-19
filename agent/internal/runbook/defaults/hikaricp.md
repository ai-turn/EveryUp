---
name: HikariCP Connection Pool Exhaustion
description: Database connection pool saturation or timeout symptoms.
severity: high
service_types: java,spring,hikari,database
patterns: HikariPool,connection is not available,SQLTransientConnectionException,connection timeout
auto_execute: false
---

## Steps

- Check database reachability and active connection count.
- Inspect recent application logs for slow queries or leaked transactions.
- Compare pool size, request concurrency, and database max connection limits.
- Restart only after confirming this is not an active database outage.
