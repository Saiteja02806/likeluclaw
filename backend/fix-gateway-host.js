var fs = require('fs');
var configPath = '/home/node/.openclaw/openclaw.json';
var c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
c.gateway.host = '0.0.0.0';
fs.writeFileSync(configPath, JSON.stringify(c, null, 2));
console.log('Gateway host set to 0.0.0.0');
console.log('New gateway config:', JSON.stringify(c.gateway));
