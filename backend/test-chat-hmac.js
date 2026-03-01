var WebSocket = require('ws');
var crypto = require('crypto');
var TOKEN = 'd878c9b4fbc4b1859c9c505b5b1f283a91d042c60d85b8a2ae2a8aa6ff487b8d';
var ws = new WebSocket('ws://localhost:19006');

ws.on('open', function() {
  console.log('CONNECTED');
});

var step = 0;

ws.on('message', function(data) {
  var msg = JSON.parse(data.toString());
  console.log('RECV:', JSON.stringify(msg).slice(0, 400));

  if (msg.event === 'connect.challenge') {
    var nonce = msg.payload.nonce;

    // Approach: HMAC-SHA256(token, nonce)
    var signature = crypto.createHmac('sha256', TOKEN).update(nonce).digest('hex');
    var response = { type: 'connect.solve', nonce: nonce, signature: signature };
    console.log('SEND:', JSON.stringify(response));
    ws.send(JSON.stringify(response));
    step = 1;
  }
});

ws.on('error', function(e) { console.log('ERR:', e.message); });
ws.on('close', function(code, reason) { console.log('CLOSE:', code, reason ? reason.toString() : ''); });
setTimeout(function() { ws.close(); process.exit(0); }, 8000);
