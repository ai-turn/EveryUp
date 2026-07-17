'use strict';

const http = require('node:http');
const { URL } = require('node:url');

const port = Number(process.env.PORT || 8080);
const fixtureName = process.env.FIXTURE_NAME || 'node-api';
const nodeOptions = process.env.NODE_OPTIONS || '';

if (process.env.FAIL_WHEN_INSTRUMENTED === 'true' && nodeOptions.includes('/everyup/node/register.js')) {
  console.error(JSON.stringify({ event: 'intentional_startup_failure', fixture: fixtureName }));
  process.exit(42);
}

function send(response, status, payload, contentType = 'application/json; charset=utf-8') {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
    'x-fixture-runtime': 'node',
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (request, response) => {
  const startedAt = process.hrtime.bigint();
  let status = 500;
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    switch (url.pathname) {
      case '/health':
        status = 200;
        send(response, status, { status: 'ok', fixture: fixtureName });
        break;
      case '/ok':
        status = 200;
        send(response, status, { ok: true, runtime: 'node', fixture: fixtureName });
        break;
      case '/slow': {
        const requested = Number(url.searchParams.get('ms') || 500);
        const delayMs = Math.min(Math.max(Number.isFinite(requested) ? requested : 500, 0), 5000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        status = 200;
        send(response, status, { ok: true, delayed_ms: delayMs });
        break;
      }
      case '/error':
        status = 503;
        send(response, status, { ok: false, error: 'intentional fixture failure' });
        break;
      case '/echo': {
        const rawBody = await readBody(request);
        status = 200;
        let body;
        try {
          body = JSON.parse(rawBody || '{}');
        } catch {
          body = { raw: rawBody };
        }
        send(response, status, { echo: body });
        break;
      }
      case '/large':
        status = 200;
        send(response, status, { payload: 'x'.repeat(10000) });
        break;
      case '/env':
        status = 200;
        send(response, status, {
          fixture: fixtureName,
          node_options: nodeOptions,
          baseline_preserved: nodeOptions.includes('--trace-warnings'),
        });
        break;
      default:
        status = 404;
        send(response, status, { ok: false, error: 'not found' });
    }
  } catch (error) {
    status = 500;
    if (!response.headersSent) send(response, status, { ok: false, error: 'internal fixture error' });
    else response.destroy();
    console.error(JSON.stringify({ event: 'handler_error', fixture: fixtureName, message: error.message }));
  } finally {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(JSON.stringify({
      event: 'http_request', fixture: fixtureName, method: request.method,
      path: url.pathname, status, duration_ms: Number(durationMs.toFixed(2)),
    }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'listening', fixture: fixtureName, port, node_options: nodeOptions }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ event: 'shutdown', fixture: fixtureName, signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
