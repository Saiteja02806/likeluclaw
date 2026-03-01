const WS = require('/app/node_modules/ws');
const crypto = require('crypto');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;

const ws = new WS('ws://127.0.0.1:18789');
let sessionKey = null;

ws.on('open', function() { console.log('OPEN'); });

ws.on('message', function(data) {
  const msg = JSON.parse(data.toString());
  const summary = JSON.stringify(msg).slice(0, 800);

  // Skip noisy tick events
  if (msg.event === 'tick' || msg.event === 'health') return;
  console.log('RECV:', summary);

  // Step 1: Handle challenge → connect
  if (msg.event === 'connect.challenge') {
    const frame = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'gateway-client',
          displayName: 'LikelyClaw Backend',
          mode: 'backend',
          version: '1.0.0',
          platform: 'linux'
        },
        auth: { token: token }
      }
    };
    ws.send(JSON.stringify(frame));
    console.log('SENT connect');
  }

  // Step 2: After connect success → list sessions
  if (msg.type === 'res' && msg.ok === true && msg.payload && msg.payload.type === 'hello-ok') {
    console.log('*** CONNECTED! Listing sessions...');
    ws.send(JSON.stringify({
      type: 'req',
      id: crypto.randomUUID(),
      method: 'sessions.list',
      params: {}
    }));
  }

  // Step 3: After sessions list → get sessionKey and send chat
  if (msg.type === 'res' && msg.ok === true && msg.payload && Array.isArray(msg.payload.sessions)) {
    console.log('SESSIONS:', JSON.stringify(msg.payload.sessions.map(function(s) {
      return { key: s.key || s.sessionKey || s.id, label: s.label };
    })));
    // Use first session or default
    if (msg.payload.sessions.length > 0) {
      var s = msg.payload.sessions[0];
      sessionKey = s.key || s.sessionKey || s.id;
    } else {
      sessionKey = 'default';
    }
    console.log('Using sessionKey:', sessionKey);

    // Send chat message
    var chatFrame = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'chat.send',
      params: {
        sessionKey: sessionKey,
        message: 'Hello! Just say hi back in one short sentence.',
        idempotencyKey: crypto.randomUUID()
      }
    };
    console.log('SENDING chat.send...');
    ws.send(JSON.stringify(chatFrame));
  }

  // Chat events (agent responses)
  if (msg.event === 'chat') {
    console.log('CHAT EVENT:', JSON.stringify(msg.payload).slice(0, 500));
  }

  // Chat send response
  if (msg.type === 'res' && msg.ok === true && msg.payload && msg.payload.runId) {
    console.log('CHAT ACCEPTED! runId:', msg.payload.runId);
  }

  // Error
  if (msg.type === 'res' && msg.ok === false) {
    console.log('ERROR:', JSON.stringify(msg.error));
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { console.log('TIMEOUT'); process.exit(0); }, 60000);
