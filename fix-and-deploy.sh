#!/bin/bash
set -e

echo "=== STEP 1: Deploy backend ==="
cd /opt/claw-backend
rm -rf src .env.example
tar xf /root/backend-deploy.tar
npm install --production 2>&1 | tail -2
pm2 restart claw-backend
sleep 3
curl -sk https://localhost/api/health && echo ""
echo "Backend deployed OK"

echo "=== STEP 2: Fix openclaw.json with proper JSON ==="
node -e '
const fs = require("fs");
const config = {
  gateway: { port: 18789, auth: { token: "55fd05e702d921c8d1bd553c4cd984d7d887cffc28cbf6a1c13e11fe6f3bd146" } },
  llm: { provider: "openai", model: "gpt-4o-mini", apiKey: "" },
  channels: { whatsapp: { enabled: true }, telegram: { enabled: false } },
  agents: [{ id: "154eb606-35cb-4ed7-b567-f0bf708a0de0", name: "Sai", role: "General", systemPrompt: "You are a helpful AI assistant.", trigger: null, active: true }]
};
fs.writeFileSync("/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json", JSON.stringify(config, null, 2));
console.log("Config written OK");
'

echo "=== STEP 3: Verify JSON ==="
node -e '
const c = JSON.parse(require("fs").readFileSync("/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json", "utf8"));
console.log("gateway.port:", c.gateway.port);
console.log("agents[0].name:", c.agents[0].name);
console.log("JSON valid: true");
'

echo "=== STEP 4: Stop old container ==="
docker rm -f claw-8b0688f6-154eb606 2>/dev/null || true

echo "=== STEP 5: Write docker-compose with 2GB memory ==="
cat > /opt/claw-platform/users/8b0688f6-154eb606/docker-compose.yml << 'YAMLEOF'
services:
  openclaw:
    image: openclaw:local
    container_name: claw-8b0688f6-154eb606
    restart: always
    ports:
      - '19001:18789'
    volumes:
      - ./config:/root/.openclaw
    environment:
      - OPENCLAW_GATEWAY_TOKEN=55fd05e702d921c8d1bd553c4cd984d7d887cffc28cbf6a1c13e11fe6f3bd146
      - NODE_OPTIONS=--max-old-space-size=1536
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    mem_limit: 2g
    memswap_limit: 3g
    cpus: 0.8
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:18789/health']
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
YAMLEOF
echo "Compose written"

echo "=== STEP 6: Start container ==="
cd /opt/claw-platform/users/8b0688f6-154eb606
docker compose up -d 2>&1

echo "=== STEP 7: Root cause audit ==="
echo "--- Docker socket ---"
ls -la /var/run/docker.sock
echo "--- Docker compose version ---"
docker compose version
echo "--- Disk space ---"
df -h / | tail -1
echo "--- Memory + swap ---"
free -h
echo "--- Platform dir perms ---"
ls -la /opt/claw-platform/users/8b0688f6-154eb606/
echo "--- Config dir perms ---"
ls -la /opt/claw-platform/users/8b0688f6-154eb606/config/
echo "--- Nginx customer_map ---"
cat /etc/nginx/customer_map.conf 2>/dev/null || echo "NO_MAP_FILE (not created yet - OK for now)"
echo "--- Backend env check ---"
grep -c "DOMAIN" /opt/claw-backend/.env && echo "DOMAIN: set" || echo "DOMAIN: MISSING"
grep -c "ENCRYPTION_KEY" /opt/claw-backend/.env && echo "ENCRYPTION_KEY: set" || echo "ENCRYPTION_KEY: MISSING"
grep -c "OPENCLAW" /opt/claw-backend/.env && echo "OPENCLAW vars: set" || echo "OPENCLAW vars: MISSING"

echo "=== STEP 8: Wait for container health ==="
sleep 45
docker ps --filter name=claw-8b0688f6 --format '{{.Names}} {{.Status}}'
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}}' claw-8b0688f6-154eb606 2>/dev/null
docker logs claw-8b0688f6-154eb606 --tail 10 2>&1

echo "=== STEP 9: Get container ID ==="
docker inspect --format='{{.Id}}' claw-8b0688f6-154eb606

echo "=== ALL DONE ==="
