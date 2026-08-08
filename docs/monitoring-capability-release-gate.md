# Monitoring capability release gate

Run this gate before releasing capability navigation, Agent profiles, independent uptime, or Project grouping changes.

1. `cd web/backend && go test ./... && go vet ./...`
2. `pnpm --dir web/frontend install --frozen-lockfile && pnpm --dir web/frontend lint && pnpm --dir web/frontend build`
3. With Docker Engine running, execute the profile compose checks in `web/backend/internal/api/handlers`; they validate all-in-one, Basic, and reduced custom bundles.
4. With an installed `everyup-otel` helper and Docker Engine, run `e2e/monitoring-target/scripts/run-e2e.sh --with-auto-rollback`.
5. In a browser, check the all-in-one Agent installer, a reduced capability installer, agentless HTTP/TCP monitor creation, capability deep links, `/projects`, and legacy `/projects/:agentId` redirects.

The `Verify` workflow enforces the backend, frontend, and generated compose portions on every main-branch push and pull request. The full runtime e2e command remains a release-environment gate because it needs Docker plus the installed helper.
