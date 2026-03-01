const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws/chat/06e1b416-29e8-46cd-bb75-15e944a13241?token=test');

ws.on('message', function(d) {
  console.log('MSG:', d.toString());
});

ws.on('error', function(e) {
  console.log('ERR:', e.message);
});

ws.on('close', function(code) {
  console.log('CLOSE:', code);
});

setTimeout(function() { process.exit(0); }, 4000);
