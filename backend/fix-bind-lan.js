var fs = require('fs');
var p = '/opt/claw-platform/users/8b0688f6-06e1b416/config/openclaw.json';
var c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.gateway.bind = 'lan';
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('gateway.bind set to lan');
console.log('gateway config:', JSON.stringify(c.gateway));
