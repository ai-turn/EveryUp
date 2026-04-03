// ── State ──────────────────────────────────────────────────
const counts = { total: 0, info: 0, warn: 0, error: 0 };
let sending = false;
let lastLevel = 'info';

// ── Elements ───────────────────────────────────────────────
const statusPill  = document.getElementById('status-pill');
const statusText  = document.getElementById('status-text');
const liveDot     = document.getElementById('live-dot');
const termBody    = document.getElementById('terminal-body');
const termEmpty   = document.getElementById('terminal-empty');
const resultBox   = document.getElementById('send-result');
const resultText  = document.getElementById('result-text');
const msgInput    = document.getElementById('msg');

// ── Init ───────────────────────────────────────────────────
document.getElementById('footer-host').textContent = location.host || 'localhost:8080';

// Load config from server and populate config bar
fetch('/config')
  .then(r => r.json())
  .then(cfg => {
    document.getElementById('cfg-endpoint').textContent = cfg.endpoint || '(not set)';
    document.getElementById('cfg-apikey').textContent   = cfg.apiKey  || '(not set)';
  })
  .catch(() => {
    document.getElementById('cfg-endpoint').textContent = '(unavailable)';
    document.getElementById('cfg-apikey').textContent   = '(unavailable)';
  });

// ── Send ───────────────────────────────────────────────────
async function sendLog(level) {
  if (sending) return;
  lastLevel = level;

  const msg = msgInput.value.trim() || 'Test log message';
  const ts  = new Date().toISOString();
  const payload = JSON.stringify({ level, message: msg, timestamp: ts, source: 'test-console' }) + '\n';

  setSending(true);
  setStatus('sending', 'Sending…');

  try {
    const res = await fetch('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
    });

    if (res.ok) {
      appendLog(level, msg, ts);
      counts.total++;
      counts[level]++;
      updateStats();
      setResult('ok', `Sent · ${level.toUpperCase()} · "${truncate(msg, 55)}"`);
      setStatus('ready', 'Ready');
    } else {
      setResult('fail', `HTTP ${res.status} — check container logs`);
      setStatus('error', 'Error');
      setTimeout(() => setStatus('ready', 'Ready'), 3000);
    }
  } catch (e) {
    setResult('fail', `Connection failed: ${e.message}`);
    setStatus('error', 'Error');
    setTimeout(() => setStatus('ready', 'Ready'), 3000);
  } finally {
    setSending(false);
  }
}

// ── Terminal ───────────────────────────────────────────────
function appendLog(level, msg, ts) {
  if (termEmpty.parentNode === termBody) termBody.removeChild(termEmpty);

  const time = new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const row = document.createElement('div');
  row.className = 'log-row';
  row.innerHTML =
    `<span class="log-ts">${time}</span>` +
    `<span class="log-sep">│</span>` +
    `<span class="log-lvl ${level}">${level.toUpperCase()}</span>` +
    `<span class="log-msg">${esc(msg)}</span>`;

  termBody.appendChild(row);
  termBody.scrollTop = termBody.scrollHeight;
}

function clearLogs() {
  termBody.innerHTML = '';
  termBody.appendChild(termEmpty);
  counts.total = 0; counts.info = 0; counts.warn = 0; counts.error = 0;
  updateStats();
  setResult('idle', 'Click a level button to send a test log');
}

// ── UI helpers ─────────────────────────────────────────────
function setSending(v) {
  sending = v;
  ['info', 'warn', 'error'].forEach(l => {
    document.getElementById('btn-' + l).disabled = v;
  });
}

function setStatus(state, label) {
  statusPill.className = 'status-pill ' + state;
  statusText.textContent = label;
  liveDot.className = 'live-dot' + (state === 'ready' ? ' pulse' : '');
}

function setResult(state, msg) {
  resultBox.className = 'send-result' + (state === 'ok' ? ' ok' : state === 'fail' ? ' fail' : '');
  resultText.className = 'result-text' + (state === 'ok' ? ' ok' : state === 'fail' ? ' fail' : '');
  resultText.textContent = msg;
  // icon
  const icon = resultBox.querySelector('.result-icon');
  icon.className = 'result-icon ' + (state === 'ok' ? 'ok' : state === 'fail' ? 'fail' : 'idle');
  if (state === 'ok') {
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (state === 'fail') {
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }
}

function updateStats() {
  document.getElementById('cnt-total').textContent = counts.total;
  document.getElementById('cnt-info').textContent  = counts.info;
  document.getElementById('cnt-warn').textContent  = counts.warn;
  document.getElementById('cnt-error').textContent = counts.error;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT') {
    if (e.key === 'Enter') { sendLog(lastLevel); }
    return;
  }
  if (e.key === 'i' || e.key === 'I') sendLog('info');
  if (e.key === 'w' || e.key === 'W') sendLog('warn');
  if (e.key === 'e' || e.key === 'E') sendLog('error');
  if (e.key === 'Escape') clearLogs();
});
