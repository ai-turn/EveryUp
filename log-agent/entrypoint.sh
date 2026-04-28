#!/bin/sh
# Parse LOG_AGENT_ENDPOINT URL into host/port/tls components for Fluent Bit.
# Uses only POSIX shell built-ins for maximum portability.
#
# Supported URL formats:
#   http://host:port
#   https://host:port
#   https://host
#   http://host:port/path
#
# Known limitations:
#   - IPv6 addresses (e.g. [::1]:3001) are not supported
#   - URL credentials (user:pass@host) are not supported
#   - Use LOG_AGENT_HOST / LOG_AGENT_PORT / LOG_AGENT_TLS directly for unsupported formats

if [ -n "$LOG_AGENT_ENDPOINT" ]; then
  case "$LOG_AGENT_ENDPOINT" in
    https://*) LOG_AGENT_TLS="on";  _stripped="${LOG_AGENT_ENDPOINT#https://}" ;;
    http://*)  LOG_AGENT_TLS="off"; _stripped="${LOG_AGENT_ENDPOINT#http://}" ;;
    *)         LOG_AGENT_TLS="off"; _stripped="$LOG_AGENT_ENDPOINT" ;;
  esac

  _hostport="${_stripped%%/*}"

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

: "${LOG_AGENT_LEVEL:=info}"
: "${LOG_AGENT_FILE:=/var/log/app/*.log}"
: "${LOG_AGENT_TLS:=off}"
: "${LOG_AGENT_TLS_VERIFY:=on}"
: "${LOG_AGENT_HOST:=localhost}"
: "${LOG_AGENT_PORT:=3001}"
: "${LOG_AGENT_RETRY_LIMIT:=3}"
export LOG_AGENT_LEVEL LOG_AGENT_FILE LOG_AGENT_TLS LOG_AGENT_TLS_VERIFY LOG_AGENT_HOST LOG_AGENT_PORT LOG_AGENT_RETRY_LIMIT

exec /fluent-bit/bin/fluent-bit -c "${LOG_AGENT_CONFIG:-/fluent-bit/etc/fluent-bit.conf}"
