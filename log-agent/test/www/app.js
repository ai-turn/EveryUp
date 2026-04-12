const counts = { total: 0, info: 0, warn: 0, error: 0 };
let sending = false;
let lastLevel = "info";

const statusPill = document.getElementById("status-pill");
const statusText = document.getElementById("status-text");
const liveDot = document.getElementById("live-dot");
const termBody = document.getElementById("terminal-body");
const termEmpty = document.getElementById("terminal-empty");
const resultBox = document.getElementById("send-result");
const resultText = document.getElementById("result-text");
const msgInput = document.getElementById("msg");

document.getElementById("footer-host").textContent = location.host || "localhost:8080";

fetch("/config")
  .then((response) => response.json())
  .then((cfg) => {
    document.getElementById("cfg-endpoint").textContent = cfg.endpoint || "(not set)";
    document.getElementById("cfg-apikey").textContent = cfg.apiKey || "(not set)";
  })
  .catch(() => {
    document.getElementById("cfg-endpoint").textContent = "(unavailable)";
    document.getElementById("cfg-apikey").textContent = "(unavailable)";
  });

async function sendLog(level) {
  if (sending) return;

  lastLevel = level;
  ['info', 'warn', 'error'].forEach(l => document.getElementById(`btn-${l}`).classList.remove('active'));
  document.getElementById(`btn-${level}`).classList.add('active');
  const msg = msgInput.value.trim() || "Test log message";
  const ts = new Date().toISOString();
  const payload =
    JSON.stringify({ level, message: msg, timestamp: ts, source: "test-console" }) + "\n";

  setSending(true);
  setStatus("sending", "Writing");
  setResult("idle", "Writing payload to the local queue file...");

  try {
    const res = await fetch("/log", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: payload,
    });

    if (res.ok) {
      appendLog(level, msg, ts);
      counts.total += 1;
      counts[level] += 1;
      updateStats();
      setResult(
        "ok",
        `Wrote ${level.toUpperCase()} to test.log. Upstream delivery still needs separate verification.`
      );
      setStatus("ready", "Idle");
    } else {
      setResult("fail", `Write failed with HTTP ${res.status}. Check the container logs.`);
      setStatus("error", "Error");
      window.setTimeout(() => setStatus("ready", "Idle"), 3000);
    }
  } catch (error) {
    setResult("fail", `Connection failed: ${error.message}`);
    setStatus("error", "Error");
    window.setTimeout(() => setStatus("ready", "Idle"), 3000);
  } finally {
    setSending(false);
  }
}

function appendLog(level, msg, ts) {
  if (termEmpty.parentNode === termBody) {
    termBody.removeChild(termEmpty);
  }

  const time = new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML =
    `<span class="log-ts">${time}</span>` +
    `<span class="log-sep">|</span>` +
    `<span class="log-lvl ${level}">${level.toUpperCase()}</span>` +
    `<span class="log-msg">${esc(msg)}</span>`;

  termBody.appendChild(row);
  termBody.scrollTop = termBody.scrollHeight;
}

function clearLogs() {
  termBody.innerHTML = "";
  termBody.appendChild(termEmpty);
  counts.total = 0;
  counts.info = 0;
  counts.warn = 0;
  counts.error = 0;
  updateStats();
  setResult("idle", "Ready to append a test line into the local queue file.");
  setStatus("ready", "Idle");
}

function setSending(value) {
  sending = value;
  ["info", "warn", "error"].forEach((level) => {
    document.getElementById(`btn-${level}`).disabled = value;
  });
}

function setStatus(state, label) {
  statusPill.className = `status-pill ${state}`;
  statusText.textContent = label;
  liveDot.className = `live-dot${state === "ready" ? " pulse" : ""}`;
}

function setResult(state, message) {
  resultBox.className =
    `send-result${state === "ok" ? " ok" : state === "fail" ? " fail" : ""}`;
  resultText.textContent = message;

  const icon = resultBox.querySelector(".result-icon");
  icon.className = `result-icon ${state === "ok" ? "ok" : state === "fail" ? "fail" : "idle"}`;

  if (state === "ok") {
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (state === "fail") {
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }
}

function updateStats() {
  document.getElementById("cnt-total").textContent = counts.total;
  document.getElementById("cnt-info").textContent = counts.info;
  document.getElementById("cnt-warn").textContent = counts.warn;
  document.getElementById("cnt-error").textContent = counts.error;
}

function esc(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement.tagName;
  if (tag === "INPUT") {
    if (event.key === "Enter") {
      sendLog(lastLevel);
    }
    return;
  }

  if (event.key === "i" || event.key === "I") sendLog("info");
  if (event.key === "w" || event.key === "W") sendLog("warn");
  if (event.key === "e" || event.key === "E") sendLog("error");
  if (event.key === "Escape") clearLogs();
});
