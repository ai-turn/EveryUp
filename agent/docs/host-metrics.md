# Host Metrics

The EveryUp Docker collector can alert on host CPU, memory, and disk thresholds.
This is separate from container state collected through Docker.

## Configuration

```bash
EVERYUP_HOST_METRICS_ENABLED=true
EVERYUP_HOST_METRICS_ROOT=/hostfs
EVERYUP_HOST_DISK_PATH=/hostfs
EVERYUP_HOST_CPU_PERCENT=90
EVERYUP_HOST_MEMORY_PERCENT=90
EVERYUP_HOST_DISK_PERCENT=90
```

| Variable | Default | Description |
|---|---|---|
| `EVERYUP_HOST_METRICS_ENABLED` | `true` | Enables host threshold checks |
| `EVERYUP_HOST_METRICS_ROOT` | `/hostfs` | Host root used to read `/proc/stat` and `/proc/meminfo` |
| `EVERYUP_HOST_DISK_PATH` | `/hostfs` | Path used for disk usage calculation |
| `EVERYUP_HOST_CPU_PERCENT` | empty | CPU threshold; empty disables CPU alerts |
| `EVERYUP_HOST_MEMORY_PERCENT` | empty | Memory threshold; empty disables memory alerts |
| `EVERYUP_HOST_DISK_PERCENT` | empty | Disk threshold; empty disables disk alerts |

## Compose Mount

```yaml
services:
  everyup-agent:
    volumes:
      - /:/hostfs:ro
```

CPU usage is calculated from consecutive `/proc/stat` samples, so the first
check establishes a baseline and later checks can alert. Memory uses
`MemAvailable`, and disk usage uses the configured disk path.

When Web sync is enabled (`EVERYUP_WEB_SYNC_ENABLED=true`), the same host
snapshot is also pushed to EveryUp Web (`POST /agents/{agentId}/metrics`) and
powers the Docker environment's infrastructure view — independent of the threshold alerts
above, which fire only when a threshold is set and exceeded.
