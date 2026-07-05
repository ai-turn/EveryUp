/**
 * EveryUp Node.js instrumentation bootstrap.
 *
 * Injected without code changes via the generated compose override:
 *   NODE_OPTIONS: "--require /everyup/node/register.js"
 *   OTEL_EXPORTER_OTLP_ENDPOINT: "http://everyup-agent:4318"
 *   OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf"
 *
 * Headers: enabled with the standard OTel env var, e.g.
 *   OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST: "content-type,user-agent"
 * Bodies (opt-in): EVERYUP_CAPTURE_BODIES=true emits the EveryUp span-event
 * contract (`request_body_masked` / `response_body_masked` with a `body`
 * attribute) — masked and truncated HERE, before anything leaves the app.
 */
'use strict';

const BODY_CAPTURE = process.env.EVERYUP_CAPTURE_BODIES === 'true';
const MAX_BODY_BYTES = clampInt(process.env.EVERYUP_BODY_MAX_BYTES, 8192, 256, 65536);
const MASKED_FIELDS = (process.env.EVERYUP_MASKED_BODY_FIELDS ||
  'password,token,secret,access_token,refresh_token,apiKey,api_key')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// The Node http instrumentation has no built-in env support for header
// capture (unlike the Java agent), so we wire these ourselves. Produces the
// standard `http.request.header.<name>` span attributes; sensitive names are
// masked again at ingest regardless.
function headerList(raw) {
  return (raw || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}
const CAPTURE_REQUEST_HEADERS = headerList(process.env.OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST);
const CAPTURE_RESPONSE_HEADERS = headerList(process.env.OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_RESPONSE);

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// Masks configured field names anywhere in a JSON document. Non-JSON bodies
// pass through untouched (size-capped only).
function maskBody(text) {
  try {
    const doc = JSON.parse(text);
    maskInPlace(doc);
    return JSON.stringify(doc);
  } catch {
    return text;
  }
}

function maskInPlace(node) {
  if (Array.isArray(node)) {
    node.forEach(maskInPlace);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (MASKED_FIELDS.includes(key.toLowerCase())) {
      node[key] = '***';
    } else {
      maskInPlace(node[key]);
    }
  }
}

function addBodyEvent(span, eventName, chunks, totalBytes) {
  if (chunks.length === 0) return;
  const raw = Buffer.concat(chunks).toString('utf8');
  span.addEvent(eventName, {
    body: maskBody(raw),
    body_size: totalBytes,
    body_truncated: totalBytes > MAX_BODY_BYTES,
    mask_applied: true,
  });
}

// Mirrors an incoming request's body by wrapping emit('data') — never attaches
// a 'data' listener itself, so the stream only flows when the app consumes it
// (an extra listener would start the flow early and could starve the app).
function captureRequestBody(span, req) {
  const chunks = [];
  let bytes = 0;
  let kept = 0;
  const origEmit = req.emit;
  req.emit = function (event, ...args) {
    if (event === 'data') {
      const chunk = Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(String(args[0]));
      bytes += chunk.length;
      if (kept < MAX_BODY_BYTES) {
        const room = MAX_BODY_BYTES - kept;
        chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
        kept = Math.min(kept + chunk.length, MAX_BODY_BYTES);
      }
    } else if (event === 'end') {
      addBodyEvent(span, 'request_body_masked', chunks, bytes);
    }
    return origEmit.apply(this, [event, ...args]);
  };
}

// Captures the outgoing response body by wrapping write/end — safe, we only
// observe what the app writes.
function captureResponseBody(span, res) {
  const chunks = [];
  let bytes = 0;
  let kept = 0;
  const keep = (data) => {
    if (data === undefined || data === null || typeof data === 'function') return;
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    bytes += chunk.length;
    if (kept < MAX_BODY_BYTES) {
      const room = MAX_BODY_BYTES - kept;
      chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
      kept = Math.min(kept + chunk.length, MAX_BODY_BYTES);
    }
  };
  const origWrite = res.write;
  const origEnd = res.end;
  res.write = function (data, ...rest) {
    keep(data);
    return origWrite.apply(this, [data, ...rest]);
  };
  res.end = function (data, ...rest) {
    keep(data);
    addBodyEvent(span, 'response_body_masked', chunks, bytes);
    return origEnd.apply(this, [data, ...rest]);
  };
}

// Everything below — including the requires — is fenced: instrumentation must
// never take the app down, even if the shared volume is mid-sync or missing
// dependencies.
try {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

  const sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          headersToSpanAttributes: {
            server: {
              requestHeaders: CAPTURE_REQUEST_HEADERS,
              responseHeaders: CAPTURE_RESPONSE_HEADERS,
            },
          },
          requestHook: (span, request) => {
            // Server side only: IncomingMessage has a url; ClientRequest does not.
            if (!BODY_CAPTURE || typeof request.url !== 'string') return;
            try { captureRequestBody(span, request); } catch { /* never break the app */ }
          },
          responseHook: (span, response) => {
            // Server side only: ServerResponse has writeHead.
            if (!BODY_CAPTURE || typeof response.writeHead !== 'function') return;
            try { captureResponseBody(span, response); } catch { /* never break the app */ }
          },
        },
      }),
    ],
  });

  sdk.start();
  process.on('SIGTERM', () => { sdk.shutdown().catch(() => {}); });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[everyup] OTel bootstrap failed (app continues uninstrumented):', err && err.message);
}
