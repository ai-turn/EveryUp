# OTel Collector Sidecar

EveryUp Agent can generate a default OpenTelemetry Collector config for an
`otel/opentelemetry-collector-contrib` sidecar.

## Files and mounts

| Path | Writer | Reader | Purpose |
|---|---|---|---|
| `/etc/everyup/generated/otel-config.yaml` | Agent | Collector | Generated base config |
| `/etc/everyup/conf.d` | User | Agent/Collector | Reserved override directory |
| `/hostfs` | Host bind mount | Collector | Host metrics root |
| `/var/run/docker.sock` | Docker | Agent/Collector | Discovery and docker stats |

The generated config includes:

- OTLP gRPC receiver on `0.0.0.0:4317`
- OTLP HTTP receiver on `0.0.0.0:4318`
- `hostmetrics` receiver with `/hostfs`
- `docker_stats` receiver
- `filelog` receiver for Docker JSON logs
- `debug` exporter
- optional `otlphttp/everyup_web` exporter

## Optional EveryUp Web forward

Set these variables when the sidecar should forward logs/traces/metrics to an
EveryUp Web deployment.

```bash
EVERYUP_WEB_OTLP_ENDPOINT=https://everyup.example.com/api/v1/otlp
EVERYUP_AGENT_API_KEY=evup_svc_...   # same project key, also used for connected-mode sync
```

The agent writes an `Authorization: Bearer <EVERYUP_AGENT_API_KEY>` header into the
generated collector config. Keep the generated config volume private.

## Compose

Start from the standard [docker-compose.yml](../docker-compose.yml), add
`EVERYUP_OTEL_CONFIG_ENABLED=true` to the agent environment, and add the
collector service alongside it:

```yaml
services:
  # ... everyup-agent as in docker-compose.yml, plus:
  #   EVERYUP_OTEL_CONFIG_ENABLED: "true"
  # and the shared volume:
  #   - everyup-generated-config:/etc/everyup/generated

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.110.0
    restart: unless-stopped
    command: ["--config=/etc/everyup/generated/otel-config.yaml"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-generated-config:/etc/everyup/generated:ro
      - ./everyup-conf.d:/etc/everyup/conf.d:ro
    ports:
      - "4317:4317"
      - "4318:4318"

volumes:
  everyup-generated-config:
```

## Override directory

`/etc/everyup/conf.d` is reserved for user overrides. The MVP generator does
not merge snippets yet; it keeps the mount stable so future versions can add a
merge/validate step without changing the compose contract.
