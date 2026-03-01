var WebSocket = require('ws');
var ws = new WebSocket('ws://localhost:19006');

ws.on('open', function() {
  console.log('CONNECTED to container gateway on port 19006');
  ws.send(JSON.stringify({ type: 'auth', token: 'd878c9b4fbc4b1859c9c505b5b1f283a91d042c60d85b8a2ae2a8aa6ff487b8d' }));
});

ws.on('message', function(data) {
  console.log('MSG:', data.toString().slice(0, 300));
});

ws.on('error', function(e) {
  console.log('ERR:', e.message);
});

ws.on('close', function(code) {
  console.log('CLOSE:', code);
});

setTimeout(function() {
  console.log('Test complete - closing');
  ws.close();
  process.exit(0);
}, 5000);
