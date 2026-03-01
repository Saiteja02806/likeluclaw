var WebSocket = require('ws');
var crypto = require('crypto');
var TOKEN = 'd878c9b4fbc4b1859c9c505b5b1f283a91d042c60d85b8a2ae2a8aa6ff487b8d';
var ws = new WebSocket('ws://localhost:19006');

ws.on('open', function() {
  console.log('CONNECTED - sending connect frame');
  ws.send(JSON.stringify({
    type: 'connect',
    id: crypto.randomUUID(),
    params: {
      role: 'operator',
      scope: ['operator.read', 'operator.write'],
      device: { id: 'likelyclaw-backend-' + crypto.randomUUID().slice(0,8) },
      auth: { token: TOKEN }
    }
  }));
});

ws.on('message', function(data) {
  var msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).slice(0, 500));

  // Handle challenge
  if (msg.event === 'connect.challenge' || (msg.type === 'event' && msg.event === 'connect.challenge')) {
    var nonce = msg.payload.nonce;
    console.log('Got challenge, solving with HMAC...');
    var signature = crypto.createHmac('sha256', TOKEN).update(nonce).digest('base64url');
    var solve = {
      type: 'connect.solve',
      id: crypto.randomUUID(),
      payload: { nonce: nonce, signature: signature }
    };
    console.log('SEND:', JSON.stringify(solve));
    ws.send(JSON.stringify(solve));
  }

  // Auth success
  if (msg.type === 'hello-ok' || msg.event === 'hello-ok' || msg.type === 'connect.ok') {
    console.log('AUTH SUCCESS!');
    setTimeout(function() {
      console.log('Sending chat message...');
      ws.send(JSON.stringify({
        type: 'node.invoke',
        id: crypto.randomUUID(),
        params: {
          agent: '06e1b416-29e8-46cd-bb75-15e944a13241',
          action: 'send-message',
          payload: { text: 'Hello! Are you there?', channel: 'web' }
        }
      }));
    }, 1000);
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { console.log('Done'); ws.close(); process.exit(0); }, 15000);
