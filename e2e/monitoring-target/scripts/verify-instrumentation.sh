#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
fixture_dir=$(dirname "$script_dir")
compose_file=$fixture_dir/compose.yaml

fail() { echo "FAIL: $*" >&2; exit 1; }

inspect_service() {
  service=$1
  baseline=$2
  injection=$3
  id=$(docker compose -f "$compose_file" -f "$fixture_dir/docker-compose.everyup.yml" ps -q "$service")
  [ -n "$id" ] || fail "$service is not running with the EveryUp override"
  [ "$(docker inspect -f '{{.State.Running}}' "$id")" = true ] || fail "$service is stopped"

  env=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$id")
  printf '%s' "$env" | grep -Fq -- "$baseline" || fail "$service lost its existing runtime option"
  printf '%s' "$env" | grep -Fq -- "$injection" || fail "$service is missing the EveryUp runtime injection"
  docker inspect -f '{{range .Mounts}}{{println .Destination}}{{end}}' "$id" | grep -Fxq '/everyup' || fail "$service is missing /everyup"
  docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$id" | grep -Fxq 'everyup-monitoring' || fail "$service is not attached to everyup-monitoring"
}

[ -f "$fixture_dir/docker-compose.everyup.yml" ] || fail "docker-compose.everyup.yml does not exist"
inspect_service node-api '--trace-warnings' '/everyup/node/register.js'
inspect_service java-api '-Dfixture.baseline=true' '/everyup/java/opentelemetry-javaagent.jar'

curl -fsS "${NODE_URL:-http://127.0.0.1:18080}/health" >/dev/null
curl -fsS "${JAVA_URL:-http://127.0.0.1:18081}/health" >/dev/null
echo "Instrumentation verification passed."
