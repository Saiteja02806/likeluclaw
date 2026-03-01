var fs = require('fs');

// Fix openclaw.json - set gateway port to 19006 (the employee's assigned port)
var configPath = '/opt/claw-platform/users/8b0688f6-06e1b416/config/openclaw.json';
var c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
c.gateway.port = 19006;
fs.writeFileSync(configPath, JSON.stringify(c, null, 2));
console.log('openclaw.json gateway port set to 19006');

// Write new docker-compose.yml with network_mode: host
var composePath = '/opt/claw-platform/users/8b0688f6-06e1b416/docker-compose.yml';
var compose = [
  'services:',
  '  openclaw:',
  '    image: openclaw:local',
  '    container_name: claw-8b0688f6-06e1b416',
  '    restart: always',
  '    network_mode: host',
  '    volumes:',
  '      - ./config:/home/node/.openclaw',
  '    environment:',
  '      - OPENCLAW_GATEWAY_TOKEN=d878c9b4fbc4b1859c9c505b5b1f283a91d042c60d85b8a2ae2a8aa6ff487b8d',
  '      - NODE_OPTIONS=--max-old-space-size=1536',
  '    logging:',
  '      driver: json-file',
  '      options:',
  '        max-size: "10m"',
  '        max-file: "3"',
  '    mem_limit: 2g',
  '    memswap_limit: 3g',
  '    cpus: 0.8',
  '    healthcheck:',
  '      test: ["CMD", "curl", "-f", "http://localhost:19006/health"]',
  '      interval: 30s',
  '      timeout: 10s',
  '      retries: 3',
  '      start_period: 40s',
].join('\n');
fs.writeFileSync(composePath, compose);
console.log('docker-compose.yml updated with network_mode: host');
