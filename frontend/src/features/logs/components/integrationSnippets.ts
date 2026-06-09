/**
 * OpenTelemetry snippet builders used by IntegrationPanel.
 */

export function buildOTelSnippets(otlpBase: string, displayKey: string): Record<string, string> {
  return {
    springboot: `# Spring Boot - OpenTelemetry Java Agent (auto-instrumentation)

# 1. Download the agent (one-time)
curl -L -o opentelemetry-javaagent.jar \\
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# 2. Configure environment
export OTEL_SERVICE_NAME="my-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="${otlpBase}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${displayKey}"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="none"

# 3. Run your app with the agent attached
java -javaagent:./opentelemetry-javaagent.jar -jar your-app.jar

# The agent auto-instruments Servlet, JDBC, JDK HttpClient, and SLF4J.
# Existing logback/log4j logs flow into OTLP without product-specific code.`,

    python: `# Python (FastAPI / Django) - opentelemetry-instrument
# pip install opentelemetry-distro opentelemetry-exporter-otlp
# opentelemetry-bootstrap -a install

# 1. Configure environment
export OTEL_SERVICE_NAME="my-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="${otlpBase}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${displayKey}"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="none"
export OTEL_PYTHON_LOG_CORRELATION="true"
export OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED="true"
export OTEL_PYTHON_LOG_LEVEL="info"

# Endpoint note:
# Set OTEL_EXPORTER_OTLP_ENDPOINT to the OTLP base URL only.
# Do not add /v1/logs or /v1/traces; the Python SDK appends those paths.
# If FastAPI runs in Docker, localhost points to that container. Use
# host.docker.internal or the EveryUp backend service name instead.

# 2. Run your app via opentelemetry-instrument
# FastAPI:
opentelemetry-instrument uvicorn main:app --host 0.0.0.0 --port 8000
# Django:
opentelemetry-instrument python manage.py runserver

# API Requests in EveryUp are projected from HTTP SERVER spans.
# Logs in EveryUp come from Python logging records such as logger.info(...)
# or logger.error(...). Plain FastAPI access traffic can appear as API requests
# even when your application code does not emit many log records.
#
# Quick log test:
#   import logging
#   logger = logging.getLogger("my-service")
#   logger.setLevel(logging.INFO)
#   logger.info("hello otel log")
# Standard logging records are forwarded to OTLP with trace context attached.`,

    nodejs: `// Node.js (Express) - auto-instrumentations-node
// npm install --save \\
//   @opentelemetry/api \\
//   @opentelemetry/auto-instrumentations-node \\
//   @opentelemetry/exporter-trace-otlp-proto \\
//   @opentelemetry/exporter-logs-otlp-proto

// 1. Configure environment (e.g. .env or shell)
// OTEL_SERVICE_NAME=my-service
// OTEL_EXPORTER_OTLP_ENDPOINT=${otlpBase}
// OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ${displayKey}
// OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
// OTEL_LOGS_EXPORTER=otlp
// OTEL_TRACES_EXPORTER=otlp
// OTEL_METRICS_EXPORTER=none
// OTEL_NODE_RESOURCE_DETECTORS=env,host,os

// 2. Start your app with auto-instrumentation registered
// package.json:
//   "scripts": {
//     "start": "node --require @opentelemetry/auto-instrumentations-node/register server.js"
//   }

// Express, http, pg, mysql, redis, etc. are instrumented automatically.
// Console logs and pino/winston records are forwarded with trace correlation.`,
  };
}
