const WS = require('/app/node_modules/ws');
const crypto = require('crypto');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;

const ws = new WS('ws://127.0.0.1:18789');

ws.on('open', function() {
  console.log('OPEN');
});

ws.on('message', function(data) {
  const msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).slice(0, 600));

  if (msg.event === 'connect.challenge') {
    // Send connect frame with client info and auth
    const nonce = msg.payload.nonce;
    const signature = crypto.createHmac('sha256', token).update(nonce).digest('hex');
    const connectFrame = {
      method: 'connect',
      id: crypto.randomUUID(),
      params: {
        client: {
          id: 'likelyclaw-web-chat',
          displayName: 'LikelyClaw Web Chat'
        },
        auth: {
          token: token,
          signature: signature
        }
      }
    };
    console.log('SEND connect:', JSON.stringify(connectFrame).slice(0, 400));
    ws.send(JSON.stringify(connectFrame));
  }

  // Handle success response
  if (msg.type === 'res' && msg.ok) {
    console.log('CONNECT SUCCESS! Payload:', JSON.stringify(msg.payload).slice(0, 300));
    // Send a chat message
    setTimeout(function() {
      const chatFrame = {
        method: 'chat.send',
        id: crypto.randomUUID(),
        params: { text: 'Hello, just say hi back.' }
      };
      console.log('SEND chat:', JSON.stringify(chatFrame));
      ws.send(JSON.stringify(chatFrame));
    }, 500);
  }

  if (msg.type === 'res' && !msg.ok) {
    console.log('ERROR:', JSON.stringify(msg.error));
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { process.exit(0); }, 30000);
