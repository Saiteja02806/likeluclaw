var fs = require('fs');
var configPath = '/opt/claw-platform/users/8b0688f6-06e1b416/config/openclaw.json';
var c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
delete c.gateway.host;
fs.writeFileSync(configPath, JSON.stringify(c, null, 2));
console.log('Fixed. Gateway config:', JSON.stringify(c.gateway));
