const WS = require('/app/node_modules/ws');
const token = process.env.OPENCLAW_GATEWAY_TOKEN;
console.log('Token:', token ? token.slice(0,8) + '...' : 'MISSING');

const ws = new WS('ws://127.0.0.1:18789?token=' + token, {
  headers: { 'Authorization': 'Bearer ' + token }
});

ws.on('open', function() {
  console.log('OPEN');
  ws.send(JSON.stringify({ type: 'auth', token: token }));
});

ws.on('message', function(data) {
  console.log('MSG:', data.toString().slice(0, 500));
});

ws.on('error', function(e) {
  console.log('ERR:', e.message);
});

ws.on('close', function(code, reason) {
  console.log('CLOSE:', code, reason ? reason.toString() : '');
});

setTimeout(function() { process.exit(0); }, 10000);
