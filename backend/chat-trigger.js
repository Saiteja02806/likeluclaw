/**
 * chat-trigger.js — Runs INSIDE the OpenClaw container via `docker exec`.
 *
 * Connects to the local gateway WebSocket (127.0.0.1:18789),
 * sends a chat message, waits for the agent's full response,
 * and prints it as JSON to stdout.
 *
 * Usage: node chat-trigger.js <message_file_path>
 *   - Reads message text from the file at <message_file_path>
 *   - Reads gateway token from OPENCLAW_GATEWAY_TOKEN env var
 *
 * Output (stdout): JSON { ok: true, response: "agent reply" }
 */

const fs = require('fs');
const WS = require('/app/node_modules/ws');

const GATEWAY_PORT = 18789;
const TIMEOUT_MS = 120000; // 2 min — agent may run tools (email, docs, etc.)

const msgFilePath = process.argv[2];
const token = process.env.OPENCLAW_GATEWAY_TOKEN;

if (!msgFilePath) {
  console.log(JSON.stringify({ ok: false, error: 'Usage: node chat-trigger.js <message_file_path>' }));
  process.exit(1);
}

let message;
try {
  message = fs.readFileSync(msgFilePath, 'utf8').trim();
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: 'Cannot read message file: ' + e.message }));
  process.exit(1);
}

if (!message) {
  console.log(JSON.stringify({ ok: false, error: 'Empty message' }));
  process.exit(1);
}

let responded = false;
const responses = [];
let lastActivity = Date.now();

const wsUrl = token
  ? 'ws://127.0.0.1:' + GATEWAY_PORT + '?token=' + token
  : 'ws://127.0.0.1:' + GATEWAY_PORT;

const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
const ws = new WS(wsUrl, { headers: headers });

const timeout = setTimeout(function() {
  finish('Agent still processing after ' + (TIMEOUT_MS / 1000) + 's');
}, TIMEOUT_MS);

// Idle timeout — if no new data for 30s after getting some response, finish
const idleCheck = setInterval(function() {
  if (responses.length > 0 && (Date.now() - lastActivity) > 30000) {
    finish();
  }
}, 5000);

function finish(note) {
  if (responded) return;
  responded = true;
  clearTimeout(timeout);
  clearInterval(idleCheck);
  const combined = responses.join('\n').trim();
  console.log(JSON.stringify({
    ok: combined.length > 0,
    response: combined || (note || 'No response from agent')
  }));
  try { ws.close(); } catch(e) {}
  setTimeout(function() { process.exit(0); }, 300);
}

let authenticated = false;
let messageSent = false;

function trySendMessage() {
  if (messageSent) return;
  messageSent = true;
  ws.send(JSON.stringify({ type: 'chat', content: message, channel: 'web' }));
}

ws.on('open', function() {
  // Send auth message
  if (token) {
    ws.send(JSON.stringify({ type: 'auth', token: token }));
  }
  // Some gateway versions auto-auth for local connections
  // Try sending message after a short delay as fallback
  setTimeout(function() {
    if (!authenticated && !messageSent) {
      authenticated = true;
      trySendMessage();
    }
  }, 2000);
});

ws.on('message', function(data) {
  lastActivity = Date.now();
  try {
    const msg = JSON.parse(data.toString());

    // Auth acknowledgment
    if (msg.type === 'auth-ok' || msg.type === 'authenticated' || msg.type === 'connected') {
      if (!authenticated) {
        authenticated = true;
        trySendMessage();
      }
      return;
    }

    // Session/ready signal
    if (!authenticated && (msg.type === 'session' || msg.type === 'ready' || msg.sessionId)) {
      authenticated = true;
      trySendMessage();
      return;
    }

    // Collect agent responses
    const text = msg.text || msg.content || msg.message || '';
    if (text && msg.type !== 'error') {
      responses.push(text);
    }

    // Error from gateway
    if (msg.type === 'error') {
      finish(msg.message || msg.error || 'Gateway error');
      return;
    }

    // Complete/done signals
    if (msg.type === 'response' || msg.type === 'message' || msg.type === 'chat' ||
        msg.type === 'agent-message' || msg.type === 'assistant' ||
        msg.done === true || msg.finished === true) {
      if (responses.length > 0) {
        // Wait a bit for any trailing messages
        setTimeout(function() { finish(); }, 1500);
      }
    }
  } catch(e) {
    // Non-JSON — store raw
    const raw = data.toString().trim();
    if (raw) responses.push(raw);
  }
});

ws.on('error', function(err) {
  finish('WebSocket error: ' + err.message);
});

ws.on('close', function() {
  setTimeout(function() { finish('Connection closed'); }, 500);
});
