var fs = require('fs');
var configPath = '/home/node/.openclaw/openclaw.json';
var c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
delete c.gateway.host;
fs.writeFileSync(configPath, JSON.stringify(c, null, 2));
console.log('Reverted gateway config:', JSON.stringify(c.gateway));
