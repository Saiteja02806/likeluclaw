var fs = require('fs');
var basePath = '/opt/claw-platform/users/8b0688f6-06e1b416';

// 1. Fix openclaw.json - revert gateway port to 18789
var configPath = basePath + '/config/openclaw.json';
var c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
c.gateway.port = 18789;
fs.writeFileSync(configPath, JSON.stringify(c, null, 2));
console.log('openclaw.json gateway port reverted to 18789');

// 2. Revert docker-compose.yml to bridge networking
var composePath = basePath + '/docker-compose.yml';
var compose = 'services:\n' +
'  openclaw:\n' +
'    image: openclaw:local\n' +
'    container_name: claw-8b0688f6-06e1b416\n' +
'    restart: always\n' +
'    ports:\n' +
'      - "19006:18789"\n' +
'    volumes:\n' +
'      - ./config:/home/node/.openclaw\n' +
'    environment:\n' +
'      - OPENCLAW_GATEWAY_TOKEN=d878c9b4fbc4b1859c9c505b5b1f283a91d042c60d85b8a2ae2a8aa6ff487b8d\n' +
'      - NODE_OPTIONS=--max-old-space-size=1536\n' +
'    logging:\n' +
'      driver: json-file\n' +
'      options:\n' +
'        max-size: "10m"\n' +
'        max-file: "3"\n' +
'    mem_limit: 2g\n' +
'    memswap_limit: 3g\n' +
'    cpus: 0.8\n' +
'    healthcheck:\n' +
'      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]\n' +
'      interval: 30s\n' +
'      timeout: 10s\n' +
'      retries: 3\n' +
'      start_period: 40s\n';
fs.writeFileSync(composePath, compose);
console.log('docker-compose.yml reverted to bridge networking');
