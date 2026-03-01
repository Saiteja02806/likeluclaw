const WS = require('/app/node_modules/ws');
const crypto = require('crypto');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;

const ws = new WS('ws://127.0.0.1:18789');

ws.on('open', function() { console.log('OPEN'); });

ws.on('message', function(data) {
  const msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).slice(0, 800));

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
        auth: {
          token: token
        }
      }
    };
    console.log('SEND:', JSON.stringify(frame).slice(0, 500));
    ws.send(JSON.stringify(frame));
  }

  if (msg.type === 'res' && msg.ok === true) {
    console.log('*** CONNECTED! ***');
    setTimeout(function() {
      const chatFrame = {
        type: 'req',
        id: crypto.randomUUID(),
        method: 'chat.send',
        params: { text: 'Hello! Just say hi back briefly.' }
      };
      console.log('SEND chat:', JSON.stringify(chatFrame));
      ws.send(JSON.stringify(chatFrame));
    }, 500);
  }

  if (msg.type === 'res' && msg.ok === false) {
    console.log('ERROR:', JSON.stringify(msg.error));
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { console.log('TIMEOUT'); process.exit(0); }, 60000);
