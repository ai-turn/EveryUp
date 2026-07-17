#!/bin/sh
set -eu

iterations=${1:-3}
node_url=${NODE_URL:-http://127.0.0.1:18080}
java_url=${JAVA_URL:-http://127.0.0.1:18081}

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }

exercise() {
  base_url=$1
  runtime=$2
  curl -fsS "$base_url/ok" >/dev/null
  curl -fsS "$base_url/slow?ms=350" >/dev/null
  curl -sS -o /dev/null -w "" "$base_url/error"
  curl -fsS -X POST "$base_url/echo" \
    -H 'content-type: application/json' \
    -H 'authorization: Bearer fixture-secret-token' \
    -H 'cookie: session=fixture-secret-cookie' \
    --data '{"email":"tester@example.com","password":"should-be-masked","token":"should-be-masked","nested":{"apiKey":"should-be-masked"}}' >/dev/null
  curl -fsS "$base_url/large" >/dev/null
  echo "Generated $runtime traffic"
}

case $iterations in
  ''|*[!0-9]*) echo "iterations must be a positive integer" >&2; exit 1 ;;
  0) echo "iterations must be greater than zero" >&2; exit 1 ;;
esac

i=1
while [ "$i" -le "$iterations" ]; do
  exercise "$node_url" node
  exercise "$java_url" java
  i=$((i + 1))
done

echo "Traffic generation complete ($iterations iteration(s) per runtime)."
