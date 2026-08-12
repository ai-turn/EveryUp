# Direct telemetry targets and scoped credentials

Status: accepted

Date: 2026-08-11

## Context

ADR 0002 deferred direct OTLP Logs and Metrics until EveryUp had a credential
and target-identity model independent of Agent keys. Capability pages currently
start a constrained Agent even when an application can export OTLP directly.
The existing OTLP implementation also carries two identities: legacy
`service_id` and connected-Agent `(agent_id, service_name)`.

## Decision

Direct Logs, Metrics, and API telemetry attach to a first-class Observed
Service. A direct telemetry connection belongs to exactly one Observed Service
and owns a hashed credential with an explicit set of allowed OTLP signals.

At the ingest seam, callers resolve to one principal containing the target
identity and allowed signals. Agent credentials, direct credentials, and legacy
log-service credentials are adapters behind that interface. Direct credentials
use the configured Observed Service as identity; OTLP `service.name` remains
telemetry metadata and cannot create another target.

Directly created Observed Services may belong directly to a Project.
Agent-discovered Observed Services continue to inherit Project membership from
their Agent. This extends ADR 0003 for the new direct target kind without
changing existing Agent inheritance.

Uptime Monitor and Infrastructure Resource remain separate modules. The
existing `services` table is not expanded into a polymorphic monitor or target
table. Infrastructure collection always requires a Collector. Infrastructure
Resources can use either the integrated EveryUp Agent adapter or a standard
OpenTelemetry Collector `host_metrics` adapter with a metrics-only credential.

## Consequences

- Direct setup never reuses or widens an Agent key.
- A credential can be rotated or revoked without changing the Observed Service.
- Logs, Metrics, and Traces authorization is enforced per OTLP route.
- One target can gain additional telemetry capabilities without creating a
  duplicate service.
- Existing Agent and legacy service-key ingestion remain compatible during
  migration.
- Standard Collector credentials project host metrics into the same
  Infrastructure Resource history and alert interfaces as Agent host metrics.
- Read, alert, Project, and retention code must accept the canonical Observed
  Service identity rather than assuming every target has an Agent.
