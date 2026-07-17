#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
fixture_dir=$(dirname "$script_dir")
compose_file=$fixture_dir/compose.yaml
auto_rollback=false

if [ "${1:-}" = "--with-auto-rollback" ]; then
  auto_rollback=true
elif [ "$#" -gt 0 ]; then
  echo "Usage: sh scripts/run-e2e.sh [--with-auto-rollback]" >&2
  exit 2
fi

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
command -v everyup-otel >/dev/null 2>&1 || { echo "everyup-otel is not installed; install the EveryUp Agent first" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker Engine is not available" >&2; exit 1; }

run_otel() {
  if [ "$(id -u)" -eq 0 ]; then
    everyup-otel "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo everyup-otel "$@"
  else
    echo "everyup-otel needs root privileges and sudo is unavailable" >&2
    return 1
  fi
}

echo "[1/5] Building and starting the baseline fixture"
docker compose -f "$compose_file" up -d --build --wait node-api java-api
sh "$script_dir/verify-baseline.sh"

echo "[2/5] Applying Node and Java instrumentation"
run_otel apply "$compose_file" --capture-bodies node-api=node java-api=java
run_otel verify "$compose_file"
sh "$script_dir/verify-instrumentation.sh"

echo "[3/5] Generating observable traffic"
sh "$script_dir/generate-traffic.sh" "${TRAFFIC_ITERATIONS:-3}"

echo "[4/5] Rolling back and checking the original runtime options"
run_otel rollback "$compose_file"
sh "$script_dir/verify-baseline.sh"

if [ "$auto_rollback" = true ]; then
  echo "[5/5] Exercising failed-start automatic rollback"
  docker compose -f "$compose_file" up -d --build --wait rollback-probe
  if run_otel apply "$compose_file" rollback-probe=node; then
    echo "FAIL: the rollback probe unexpectedly accepted instrumentation" >&2
    exit 1
  fi
  probe_id=$(docker compose -f "$compose_file" ps -q rollback-probe)
  [ -n "$probe_id" ] || { echo "FAIL: rollback-probe was not restored" >&2; exit 1; }
  probe_env=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$probe_id")
  printf '%s' "$probe_env" | grep -Fq -- '--trace-warnings' || { echo "FAIL: rollback lost NODE_OPTIONS" >&2; exit 1; }
  if printf '%s' "$probe_env" | grep -Fq '/everyup/node/register.js'; then
    echo "FAIL: failed instrumentation was not rolled back" >&2
    exit 1
  fi
  echo "Automatic rollback verification passed."
else
  echo "[5/5] Automatic rollback probe skipped (pass --with-auto-rollback to run it)"
fi

echo "E2E checks passed. Open EveryUp and confirm node-api/java-api traces, 503s, latency, and masked Node bodies."
