#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
fixture_dir=$(dirname "$script_dir")
compose_file=$fixture_dir/compose.yaml

fail() { echo "FAIL: $*" >&2; exit 1; }

for service in node-api java-api; do
  id=$(docker compose -f "$compose_file" ps -q "$service")
  [ -n "$id" ] || fail "$service is not running"
  [ "$(docker inspect -f '{{.State.Running}}' "$id")" = true ] || fail "$service is stopped"
  health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")
  [ "$health" = healthy ] || fail "$service health is $health"
done

node_env=$(curl -fsS "${NODE_URL:-http://127.0.0.1:18080}/env")
java_env=$(curl -fsS "${JAVA_URL:-http://127.0.0.1:18081}/env")
printf '%s' "$node_env" | grep -q '"baseline_preserved":true' || fail "Node baseline NODE_OPTIONS was not preserved"
printf '%s' "$java_env" | grep -q '"baseline_preserved":true' || fail "Java baseline JAVA_TOOL_OPTIONS was not preserved"

echo "Baseline verification passed."
