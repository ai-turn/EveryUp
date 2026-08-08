# Capability-specific Agents before direct OTLP ingestion

EveryUp exposes per-capability setup by creating an Agent with a constrained profile from that capability menu. Direct OTLP Logs or Metrics ingestion is deferred until it has a separate credential and target-identity model, so the existing Agent API key is neither reused as a global ingest credential nor presented as an Agent-free path.
