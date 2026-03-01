const WS = require('/app/node_modules/ws');
const crypto = require('crypto');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;

const ws = new WS('ws://127.0.0.1:18789');
let authenticated = false;

ws.on('open', function() { console.log('OPEN'); });

ws.on('message', function(data) {
  const msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).slice(0, 600));

  // On challenge, send connect with type:"req"
  if (msg.event === 'connect.challenge') {
    const frame = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'connect',
      params: {
        client: {
          id: 'likelyclaw-web-chat',
          displayName: 'LikelyClaw Web Chat'
        },
        auth: {
          token: token
        }
      }
    };
    console.log('SEND:', JSON.stringify(frame).slice(0, 400));
    ws.send(JSON.stringify(frame));
  }

  // Success response
  if (msg.type === 'res' && msg.ok === true) {
    console.log('CONNECTED SUCCESSFULLY!');
    authenticated = true;
    // Send a chat message to the agent
    setTimeout(function() {
      const chatFrame = {
        type: 'req',
        id: crypto.randomUUID(),
        method: 'agent.chat',
        params: { text: 'Hello! Just say hi back briefly.' }
      };
      console.log('SEND chat:', JSON.stringify(chatFrame).slice(0, 300));
      ws.send(JSON.stringify(chatFrame));
    }, 500);
  }

  // Error
  if (msg.type === 'res' && msg.ok === false) {
    console.log('ERROR:', JSON.stringify(msg.error));
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { console.log('TIMEOUT'); process.exit(0); }, 60000);
