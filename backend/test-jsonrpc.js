const WS = require('/app/node_modules/ws');
const crypto = require('crypto');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;
console.log('Token:', token ? token.slice(0,8) + '...' : 'MISSING');

const ws = new WS('ws://127.0.0.1:18789');

ws.on('open', function() {
  console.log('OPEN');
});

ws.on('message', function(data) {
  const msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).slice(0, 600));

  // Handle challenge
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const nonce = msg.payload.nonce;
    const signature = crypto.createHmac('sha256', token).update(nonce).digest('hex');
    const solve = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'connect.solve',
      params: {
        auth: {
          token: token,
          signature: signature
        }
      }
    };
    console.log('SEND solve:', JSON.stringify(solve).slice(0, 300));
    ws.send(JSON.stringify(solve));
  }

  // Handle hello-ok or success
  if (msg.type === 'res' || msg.ok || msg.payload?.type === 'hello-ok') {
    console.log('AUTH SUCCESS!');
    // Try sending a chat message
    const chatMsg = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'chat.send',
      params: {
        text: 'Hello! Just say hi back briefly.',
        channel: 'web'
      }
    };
    console.log('SEND chat:', JSON.stringify(chatMsg).slice(0, 200));
    ws.send(JSON.stringify(chatMsg));
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { console.log('TIMEOUT'); process.exit(0); }, 30000);
