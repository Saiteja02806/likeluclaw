var WebSocket = require('ws');
var crypto = require('crypto');
var TOKEN = 'd878c9b4fbc4b1859c9c505b5b1f283a91d042c60d85b8a2ae2a8aa6ff487b8d';
var ws = new WebSocket('ws://localhost:19006');

ws.on('open', function() {
  console.log('CONNECTED');
});

ws.on('message', function(data) {
  var msg = JSON.parse(data.toString());
  console.log('MSG:', JSON.stringify(msg).slice(0, 300));

  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    var nonce = msg.payload.nonce;
    console.log('Got challenge nonce:', nonce);

    // Try approach 1: send auth with token directly
    console.log('Sending auth with token...');
    ws.send(JSON.stringify({ type: 'auth', token: TOKEN }));

    // If that doesn't work, try approach 2: HMAC response
    // var hmac = crypto.createHmac('sha256', TOKEN).update(nonce).digest('hex');
    // ws.send(JSON.stringify({ type: 'auth.response', nonce: nonce, signature: hmac }));
  }

  if (msg.type === 'auth-ok' || msg.type === 'authenticated' || msg.type === 'event' && msg.event === 'auth.success') {
    console.log('AUTH SUCCESS!');
    // Send a test chat message
    ws.send(JSON.stringify({ type: 'chat', content: 'Hello, are you there?', channel: 'web' }));
  }
});

ws.on('error', function(e) {
  console.log('ERR:', e.message);
});

ws.on('close', function(code, reason) {
  console.log('CLOSE:', code, reason ? reason.toString() : '');
});

setTimeout(function() {
  console.log('Timeout - closing');
  ws.close();
  process.exit(0);
}, 15000);
