#!/bin/sh
# Parse LOG_AGENT_ENDPOINT URL into host/port/tls components for Fluent Bit.
# Uses only POSIX shell built-ins (no sed/awk) for maximum portability.
#
# Supported URL formats:
#   http://host:port         → tls=off, host=host, port=port
#   https://host:port        → tls=on,  host=host, port=port
#   https://host             → tls=on,  host=host, port=443
#   http://host:port/path    → path component is stripped (ignored)
#
# Known limitations:
#   - IPv6 addresses (e.g. [::1]:3001) are not supported
#   - URL credentials (user:pass@host) are not supported
#   - Use LOG_AGENT_HOST / LOG_AGENT_PORT / LOG_AGENT_TLS directly for unsupported formats

if [ -n "$LOG_AGENT_ENDPOINT" ]; then
  # Detect TLS from scheme
  case "$LOG_AGENT_ENDPOINT" in
    https://*) LOG_AGENT_TLS="on";  _stripped="${LOG_AGENT_ENDPOINT#https://}" ;;
    http://*)  LOG_AGENT_TLS="off"; _stripped="${LOG_AGENT_ENDPOINT#http://}" ;;
    *)         LOG_AGENT_TLS="off"; _stripped="$LOG_AGENT_ENDPOINT" ;;
  esac

  # Remove path component: "host:port/path" → "host:port"
  _hostport="${_stripped%%/*}"

  # Extract host and port
  case "$_hostport" in
    *:*)
      LOG_AGENT_HOST="${_hostport%%:*}"
      LOG_AGENT_PORT="${_hostport##*:}"
      ;;
    *)
      LOG_AGENT_HOST="$_hostport"
      if [ "$LOG_AGENT_TLS" = "on" ]; then LOG_AGENT_PORT=443; else LOG_AGENT_PORT=80; fi
      ;;
  esac

  export LOG_AGENT_TLS LOG_AGENT_HOST LOG_AGENT_PORT
fi

# Default values (set only if unset)
: "${LOG_AGENT_LEVEL:=info}"
: "${LOG_AGENT_FILE:=/var/log/app/*.log}"
: "${LOG_AGENT_TLS:=off}"
: "${LOG_AGENT_TLS_VERIFY:=off}"
: "${LOG_AGENT_HOST:=localhost}"
: "${LOG_AGENT_PORT:=3001}"
: "${LOG_AGENT_RETRY_LIMIT:=3}"
export LOG_AGENT_LEVEL LOG_AGENT_FILE LOG_AGENT_TLS LOG_AGENT_TLS_VERIFY LOG_AGENT_HOST LOG_AGENT_PORT LOG_AGENT_RETRY_LIMIT

# Start test console web UI when LOG_AGENT_WEB_CONSOLE=true
# WARNING: This starts an unauthenticated HTTP server on LOG_AGENT_WEB_CONSOLE_PORT (default 8080).
# Never set LOG_AGENT_WEB_CONSOLE=true in production environments.
if [ "${LOG_AGENT_WEB_CONSOLE:-false}" = "true" ]; then
  mkdir -p /var/log/app
  /test/server &
fi

exec /fluent-bit/bin/fluent-bit -c "${LOG_AGENT_CONFIG:-/fluent-bit/etc/fluent-bit.conf}"
