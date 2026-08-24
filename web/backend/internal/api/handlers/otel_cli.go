package handlers

import "github.com/gofiber/fiber/v2"

// OTelScript serves the secret-free application instrumentation helper. It is
// installed by the Agent bootstrapper, but can also be downloaded again from
// the Web UI when upgrading an older installation.
func (h *AgentHandler) OTelScript(c *fiber.Ctx) error {
	c.Set(fiber.HeaderContentType, "text/x-shellscript; charset=utf-8")
	c.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return c.SendString(agentOTelCLIScript)
}

const agentOTelCLIScript = `#!/bin/sh
set -eu

program=everyup-otel
instrumentation_volume=everyup-instrumentation
monitoring_network=everyup-monitoring
agent_container=everyup-agent
agent_image=${EVERYUP_AGENT_IMAGE:-aiturn/everyup-agent:latest}
compose_path=
compose_dir=
override_path=
state_dir=
targets_tmp=
runtimes_tmp=
override_tmp=
active_mode=base

say() {
  printf '%s\n' "$*"
}

warn() {
  printf '%s\n' "$*" >&2
}

die() {
  warn "Error: $*"
  exit 1
}

usage() {
  cat <<'USAGE'
EveryUp application instrumentation helper

Usage:
  everyup-otel apply <compose-file> [--capture-bodies] <service=java|node>...
  everyup-otel verify <compose-file>
  everyup-otel status <compose-file>
  everyup-otel rollback <compose-file>

The helper creates docker-compose.everyup.yml next to your application Compose
file, recreates only the selected services, verifies the result, and restores
the previous state automatically if verification fails.
USAGE
}

cleanup() {
  if [ -n "${targets_tmp:-}" ] && [ -f "$targets_tmp" ]; then
    rm -f "$targets_tmp"
  fi
  if [ -n "${runtimes_tmp:-}" ] && [ -f "$runtimes_tmp" ]; then
    rm -f "$runtimes_tmp"
  fi
  if [ -n "${override_tmp:-}" ] && [ -f "$override_tmp" ]; then
    rm -f "$override_tmp"
  fi
}
trap cleanup EXIT INT TERM

require_host() {
  [ "$(uname -s)" = "Linux" ] || die "Linux is required."
  [ "$(id -u)" -eq 0 ] || die "Run this command with sudo."
  command -v docker >/dev/null 2>&1 || die "Docker is required."
  docker info >/dev/null 2>&1 || die "Docker Engine is not reachable."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
}

resolve_compose() {
  input=$1
  [ -f "$input" ] || die "Compose file not found: $input"
  input_dir=$(dirname "$input")
  input_name=$(basename "$input")
  compose_dir=$(CDPATH= cd "$input_dir" && pwd -P) || die "Cannot resolve Compose directory."
  compose_path=$compose_dir/$input_name
  override_path=$compose_dir/docker-compose.everyup.yml
  state_dir=$compose_dir/.everyup
  cd "$compose_dir"
  docker compose -f "$compose_path" config --quiet || die "The application Compose file is invalid."
}

valid_service_name() {
  case "$1" in
    ''|*[!A-Za-z0-9_.-]*) return 1 ;;
    *) return 0 ;;
  esac
}

service_exists() {
  docker compose -f "$compose_path" config --services | grep -F -x "$1" >/dev/null 2>&1
}

base_container_ids() {
  docker compose -f "$compose_path" ps -q "$1"
}

managed_container_ids() {
  docker compose -f "$compose_path" -f "$override_path" ps -q "$1"
}

container_ids() {
  if [ "$active_mode" = managed ]; then
    managed_container_ids "$1"
  else
    base_container_ids "$1"
  fi
}

assert_running_baseline() {
  service=$1
  ids=$(base_container_ids "$service")
  [ -n "$ids" ] || die "Service '$service' is not running. Start it before applying instrumentation."
  for container_id in $ids; do
    running=$(docker inspect --format '{{.State.Running}}' "$container_id")
    [ "$running" = true ] || die "Service '$service' is not running."
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")
    [ "$health" != unhealthy ] || die "Service '$service' is already unhealthy; instrumentation was not applied."
  done
}

yaml_quote() {
  escaped=$(printf '%s' "$1" | sed "s/'/''/g")
  printf "'%s'" "$escaped"
}

current_env_value() {
  container_id=$1
  env_name=$2
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" |
    sed -n "s/^${env_name}=//p" | sed -n '1p'
}

append_option() {
  current=$1
  required=$2
  marker=$3
  case "$current" in
    *"$marker"*) printf '%s' "$current" ;;
    '') printf '%s' "$required" ;;
    *) printf '%s %s' "$current" "$required" ;;
  esac
}

write_override_header() {
  cat > "$override_tmp" <<'YAML'
volumes:
  everyup-instrumentation:
    external: true
    name: everyup-instrumentation

networks:
  everyup-monitoring:
    external: true
    name: everyup-monitoring

services:
YAML
}

write_service_override() {
  service=$1
  runtime=$2
  capture_bodies=$3
  container_id=$(base_container_ids "$service" | sed -n '1p')

  {
    printf '  '
    yaml_quote "$service"
    printf ':\n'
    printf '    volumes:\n'
    printf '      - everyup-instrumentation:/everyup:ro\n'
    printf '    networks:\n'
    printf '      everyup-monitoring: {}\n'
    printf '    environment:\n'
    printf '      OTEL_SERVICE_NAME: '
    yaml_quote "$service"
    printf '\n'
    printf "      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://everyup-agent:4318'\n"
    printf "      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf'\n"

    if [ "$runtime" = java ]; then
      current=$(current_env_value "$container_id" JAVA_TOOL_OPTIONS)
      combined=$(append_option "$current" '-javaagent:/everyup/java/opentelemetry-javaagent.jar' '/everyup/java/opentelemetry-javaagent.jar')
      printf '      JAVA_TOOL_OPTIONS: '
      yaml_quote "$combined"
      printf '\n'
      printf "      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS: 'content-type,user-agent,accept'\n"
      printf "      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS: 'content-type'\n"
    else
      current=$(current_env_value "$container_id" NODE_OPTIONS)
      combined=$(append_option "$current" '--require /everyup/node/register.js' '/everyup/node/register.js')
      printf '      NODE_OPTIONS: '
      yaml_quote "$combined"
      printf '\n'
      printf "      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST: 'content-type,user-agent,accept'\n"
      printf "      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_RESPONSE: 'content-type'\n"
      if [ "$capture_bodies" = true ]; then
        printf "      EVERYUP_CAPTURE_BODIES: 'true'\n"
      fi
    fi
  } >> "$override_tmp"
}

ensure_agent_resources() {
  docker inspect "$agent_container" >/dev/null 2>&1 || {
    warn "EveryUp Docker collector container '$agent_container' was not found."
    return 1
  }
  [ "$(docker inspect --format '{{.State.Running}}' "$agent_container")" = true ] || {
    warn "The EveryUp Docker collector is not running."
    return 1
  }

  if ! docker network inspect "$monitoring_network" >/dev/null 2>&1; then
    docker network create "$monitoring_network" >/dev/null || return 1
  fi
  if ! docker inspect --format '{{range $name, $network := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$agent_container" |
    grep -F -x "$monitoring_network" >/dev/null 2>&1; then
    docker network connect --alias "$agent_container" "$monitoring_network" "$agent_container" || return 1
  fi

  say "Checking Docker collector DNS on the shared monitoring network..."
  docker run --rm --network "$monitoring_network" --entrypoint /bin/sh "$agent_image" \
    -c 'nslookup everyup-agent >/dev/null 2>&1' || return 1

  if ! docker volume inspect "$instrumentation_volume" >/dev/null 2>&1; then
    docker volume create "$instrumentation_volume" >/dev/null || return 1
  fi
  say "Preparing the EveryUp Java and Node instrumentation bundle..."
  docker run --rm --user 0:0 --entrypoint /bin/sh \
    -v "$instrumentation_volume:/bundle" \
    "$agent_image" \
    -c 'test -d /opt/everyup/instrumentation && cp -a /opt/everyup/instrumentation/. /bundle/' || return 1
}

up_targets() {
  target_args=$(tr '\n' ' ' < "$state_dir/targets")
  [ -n "$target_args" ] || return 1
  if [ "$active_mode" = managed ]; then
    docker compose -f "$compose_path" -f "$override_path" up -d --no-deps --force-recreate $target_args
  else
    docker compose -f "$compose_path" up -d --no-deps --force-recreate $target_args
  fi
}

wait_for_targets() {
  elapsed=0
  while [ "$elapsed" -lt 60 ]; do
    all_ready=true
    while IFS= read -r service; do
      [ -n "$service" ] || continue
      ids=$(container_ids "$service")
      if [ -z "$ids" ]; then
        all_ready=false
        continue
      fi
      for container_id in $ids; do
        running=$(docker inspect --format '{{.State.Running}}' "$container_id" 2>/dev/null || printf false)
        health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || printf missing)
        if [ "$running" != true ] || { [ "$health" != healthy ] && [ "$health" != none ]; }; then
          all_ready=false
        fi
      done
    done < "$state_dir/targets"
    if [ "$all_ready" = true ]; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  warn "Selected services did not become ready within 60 seconds."
  return 1
}

runtime_for_service() {
  service=$1
  awk -F= -v target="$service" '$1 == target { print $2; exit }' "$state_dir/runtimes"
}

verify_instrumentation() {
  active_mode=managed
  [ -f "$override_path" ] || {
    warn "Managed override not found: $override_path"
    return 1
  }
  [ -f "$state_dir/targets" ] && [ -f "$state_dir/runtimes" ] || {
    warn "EveryUp state is missing. Run apply again."
    return 1
  }

  wait_for_targets || return 1
  while IFS= read -r service; do
    [ -n "$service" ] || continue
    runtime=$(runtime_for_service "$service")
    ids=$(managed_container_ids "$service")
    for container_id in $ids; do
      env_dump=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id")
      if [ "$runtime" = java ]; then
        printf '%s\n' "$env_dump" | grep -F 'JAVA_TOOL_OPTIONS=' | grep -F '/everyup/java/opentelemetry-javaagent.jar' >/dev/null 2>&1 || {
          warn "Java agent option is missing from '$service'."
          return 1
        }
      else
        printf '%s\n' "$env_dump" | grep -F 'NODE_OPTIONS=' | grep -F '/everyup/node/register.js' >/dev/null 2>&1 || {
          warn "Node preload option is missing from '$service'."
          return 1
        }
      fi
      docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' "$container_id" |
        grep -F -x /everyup >/dev/null 2>&1 || {
          warn "Instrumentation volume is missing from '$service'."
          return 1
        }
      docker inspect --format '{{range $name, $network := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$container_id" |
        grep -F -x "$monitoring_network" >/dev/null 2>&1 || {
          warn "Monitoring network is missing from '$service'."
          return 1
        }
    done
  done < "$state_dir/targets"
  return 0
}

rollback_internal() {
  reason=$1
  [ -f "$state_dir/targets" ] || {
    warn "Rollback state was not found."
    return 1
  }

  timestamp=$(date +%Y%m%d%H%M%S)
  if [ -f "$override_path" ]; then
    cp -p "$override_path" "$state_dir/failed.$timestamp.yml" || return 1
  fi

  if [ "$(cat "$state_dir/had_previous" 2>/dev/null || printf no)" = yes ]; then
    [ -f "$state_dir/previous.override.yml" ] || {
      warn "Previous override backup is missing."
      return 1
    }
    cp -p "$state_dir/previous.override.yml" "$override_path" || return 1
    active_mode=managed
  else
    rm -f "$override_path"
    active_mode=base
  fi

  say "Restoring the previous application configuration..."
  up_targets || return 1
  wait_for_targets || return 1
  printf 'no\n' > "$state_dir/rollback_available"
  printf 'rolled back: %s\n' "$reason" > "$state_dir/status"
  return 0
}

apply_command() {
  [ "$#" -ge 2 ] || {
    usage >&2
    exit 2
  }
  resolve_compose "$1"
  shift
  capture_bodies=false
  targets_tmp=$(mktemp "${TMPDIR:-/tmp}/everyup-targets.XXXXXX")
  runtimes_tmp=$targets_tmp.runtimes
  : > "$targets_tmp"
  : > "$runtimes_tmp"

  for spec in "$@"; do
    if [ "$spec" = --capture-bodies ]; then
      capture_bodies=true
      continue
    fi
    case "$spec" in
      *=*) service=${spec%%=*}; runtime=${spec#*=} ;;
      *) die "Invalid target '$spec'. Use service=java or service=node." ;;
    esac
    valid_service_name "$service" || die "Invalid Compose service name: $service"
    [ "$runtime" = java ] || [ "$runtime" = node ] || die "Unsupported runtime for '$service': $runtime"
    service_exists "$service" || die "Compose service not found: $service"
    if grep -F -x "$service" "$targets_tmp" >/dev/null 2>&1; then
      die "Duplicate target: $service"
    fi
    assert_running_baseline "$service"
    printf '%s\n' "$service" >> "$targets_tmp"
    printf '%s=%s\n' "$service" "$runtime" >> "$runtimes_tmp"
  done
  [ -s "$targets_tmp" ] || die "At least one service target is required."

  ensure_agent_resources || die "Could not prepare the Docker collector network and instrumentation bundle. No application service was changed."

  override_tmp=$(mktemp "${TMPDIR:-/tmp}/everyup-override.XXXXXX")
  write_override_header
  while IFS='=' read -r service runtime; do
    write_service_override "$service" "$runtime" "$capture_bodies"
  done < "$runtimes_tmp"
  docker compose -f "$compose_path" -f "$override_tmp" config --quiet || die "Generated override validation failed. No application service was changed."

  mkdir -p "$state_dir"
  chmod 700 "$state_dir"
  if [ -f "$override_path" ]; then
    cp -p "$override_path" "$state_dir/previous.override.yml"
    printf 'yes\n' > "$state_dir/had_previous"
  else
    rm -f "$state_dir/previous.override.yml"
    printf 'no\n' > "$state_dir/had_previous"
  fi
  cp "$targets_tmp" "$state_dir/targets"
  cp "$runtimes_tmp" "$state_dir/runtimes"
  printf '%s\n' "$compose_path" > "$state_dir/compose_path"
  printf 'yes\n' > "$state_dir/rollback_available"
  cp "$override_tmp" "$override_path"
  chmod 600 "$override_path" "$state_dir/targets" "$state_dir/runtimes" "$state_dir/compose_path" "$state_dir/had_previous" "$state_dir/rollback_available"

  active_mode=managed
  say "Applying instrumentation to selected services only..."
  if ! up_targets; then
    warn "Application restart failed. Starting automatic rollback."
    rollback_internal "restart failed" || die "Automatic rollback also failed. Inspect $state_dir and Docker logs."
    die "Instrumentation was not applied; the previous configuration was restored."
  fi
  if ! verify_instrumentation; then
    warn "Post-apply verification failed. Starting automatic rollback."
    rollback_internal "verification failed" || die "Automatic rollback also failed. Inspect $state_dir and Docker logs."
    die "Instrumentation was not applied; the previous configuration was restored."
  fi

  printf 'active\n' > "$state_dir/status"
  say "EveryUp instrumentation is active and verified."
  say "Override: $override_path"
  say "Verify again: sudo everyup-otel verify $compose_path"
  say "Rollback: sudo everyup-otel rollback $compose_path"

  rm -f "$runtimes_tmp"
}

load_managed_state() {
  resolve_compose "$1"
  [ -d "$state_dir" ] || die "No EveryUp instrumentation state was found next to this Compose file."
  [ -f "$state_dir/targets" ] || die "EveryUp target state is missing. Run apply again."
}

verify_command() {
  [ "$#" -eq 1 ] || {
    usage >&2
    exit 2
  }
  load_managed_state "$1"
  if verify_instrumentation; then
    say "EveryUp instrumentation is active and verified."
  else
    die "Instrumentation verification failed. Run status or rollback after checking Docker logs."
  fi
}

status_command() {
  [ "$#" -eq 1 ] || {
    usage >&2
    exit 2
  }
  load_managed_state "$1"
  status=$(cat "$state_dir/status" 2>/dev/null || printf unknown)
  say "EveryUp status: $status"
  say "Managed override: $override_path"
  say "Selected services:"
  sed 's/^/  - /' "$state_dir/runtimes"
  if [ -f "$override_path" ] && verify_instrumentation; then
    say "Verification: passed"
  else
    warn "Verification: failed or inactive"
    return 1
  fi
}

rollback_command() {
  [ "$#" -eq 1 ] || {
    usage >&2
    exit 2
  }
  load_managed_state "$1"
  [ "$(cat "$state_dir/rollback_available" 2>/dev/null || printf no)" = yes ] || die "There is no pending EveryUp change to roll back."
  rollback_internal "manual rollback" || die "Rollback failed. Inspect $state_dir and Docker logs."
  say "The previous application configuration was restored and verified."
}

command=${1:-}
case "$command" in
  apply) require_host; shift; apply_command "$@" ;;
  verify) require_host; shift; verify_command "$@" ;;
  status) require_host; shift; status_command "$@" ;;
  rollback) require_host; shift; rollback_command "$@" ;;
  help|-h|--help|'') usage ;;
  *) usage >&2; die "Unknown command: $command" ;;
esac
`
