#!/bin/bash
set -e

USERDIR="/opt/claw-platform/users/8b0688f6-154eb606"
CONTAINER="claw-8b0688f6-154eb606"

echo "=== STEP 1: Decrypt API key and update config ==="
cd /opt/claw-backend
node -e '
require("dotenv").config();
const { decrypt } = require("./src/lib/encryption");
const fs = require("fs");

const encryptedKey = "5186cd9e6c783e34464c545eb436a3ea:48803eacd36aaeb83dfd51e9ece56d22d60cd7f491efcb3b0ec499ff54be411b315903cffa69c75787269a6446d97e2393a14df6919b5305e0f4c4e7a2f7c53e9425487f7da802bb1af633174b3c6b7f9204588d057dc1549b1071e54dea283075de57b89b646e81183032dd2df3a91a54a275164063f61f7942ee6d3a91be7eb9ea84eb6a30a8efb91564397efb563ef6f9e2bf577297d4f830a33aa41b7130b4e5f3d21d0d8c9a9eafda6a1651821e";
const apiKey = decrypt(encryptedKey);
console.log("API key decrypted OK, length:", apiKey.length);

const configPath = "/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.llm.apiKey = apiKey;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Config updated with API key");
'

echo "=== STEP 2: Verify config ==="
node -e '
const fs = require("fs");
const c = JSON.parse(fs.readFileSync("/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json", "utf8"));
console.log("provider:", c.llm.provider);
console.log("model:", c.llm.model);
console.log("apiKey length:", c.llm.apiKey.length);
console.log("apiKey starts with:", c.llm.apiKey.substring(0, 7));
console.log("telegram.enabled:", c.channels.telegram.enabled);
console.log("telegram.botToken starts with:", c.channels.telegram.botToken.substring(0, 10));
'

echo "=== STEP 3: Stop old container ==="
docker rm -f $CONTAINER 2>/dev/null || true

echo "=== STEP 4: Fix docker-compose (volume mount /home/node/.openclaw) ==="
cat > $USERDIR/docker-compose.yml << 'YAMLEOF'
services:
  openclaw:
    image: openclaw:local
    container_name: claw-8b0688f6-154eb606
    restart: always
    ports:
      - '19001:18789'
    volumes:
      - ./config:/home/node/.openclaw
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
      start_period: 90s
YAMLEOF
echo "Compose written with correct volume mount"

echo "=== STEP 5: Start container ==="
cd $USERDIR
docker compose up -d 2>&1

echo "=== STEP 6: Wait for startup (60s) ==="
sleep 60

echo "=== STEP 7: Check container ==="
docker ps --filter name=$CONTAINER --format '{{.Names}} {{.Status}}'
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}}' $CONTAINER 2>/dev/null

echo "=== STEP 8: Check logs for Telegram ==="
docker logs $CONTAINER --tail 30 2>&1

echo "=== STEP 9: Get new container ID ==="
docker inspect --format='{{.Id}}' $CONTAINER

echo "=== ALL DONE ==="
