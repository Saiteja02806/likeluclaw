#!/bin/bash
set -e

USERDIR="/opt/claw-platform/users/8b0688f6-154eb606"
CONTAINER="claw-8b0688f6-154eb606"

echo "=== STEP 1: Decrypt API key using backend context ==="
cd /opt/claw-backend
node -e '
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { decrypt } = require("./src/lib/encryption");
const fs = require("fs");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("profiles")
    .select("api_key_encrypted, api_key_provider")
    .eq("id", "8b0688f6-7d6d-4bd6-bf53-e76ea74bb77c")
    .single();

  if (error || !data) {
    console.error("Failed to fetch profile:", error);
    process.exit(1);
  }

  let apiKey = "";
  let provider = data.api_key_provider || "openai";
  if (data.api_key_encrypted) {
    try {
      apiKey = decrypt(data.api_key_encrypted);
      console.log("API key decrypted OK, length:", apiKey.length, "starts:", apiKey.substring(0, 7));
    } catch (e) {
      console.error("Decrypt failed:", e.message);
      console.log("Will proceed without API key - user must re-save in Settings");
    }
  }

  const configPath = "/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json";
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.llm.apiKey = apiKey;
  config.llm.provider = provider;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("Config updated - provider:", provider, "apiKey set:", apiKey.length > 0);
}

main().catch(e => { console.error(e); process.exit(1); });
'

echo "=== STEP 2: Verify config ==="
node -e '
const fs = require("fs");
const c = JSON.parse(fs.readFileSync("/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json", "utf8"));
console.log("provider:", c.llm.provider);
console.log("model:", c.llm.model);
console.log("apiKey length:", c.llm.apiKey.length);
console.log("telegram.enabled:", c.channels.telegram.enabled);
console.log("telegram.botToken set:", c.channels.telegram.botToken ? "yes" : "no");
'

echo "=== STEP 3: Stop old container ==="
docker rm -f $CONTAINER 2>/dev/null || true

echo "=== STEP 4: Write docker-compose with CORRECT volume mount ==="
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
echo "Compose written: volume -> /home/node/.openclaw (FIXED)"

echo "=== STEP 5: Start container ==="
cd $USERDIR
docker compose up -d 2>&1

echo "=== STEP 6: Wait for startup (75s for OpenClaw) ==="
sleep 75

echo "=== STEP 7: Container status ==="
docker ps --filter name=$CONTAINER --format '{{.Names}} {{.Status}}'
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}}' $CONTAINER 2>/dev/null

echo "=== STEP 8: Container logs (look for Telegram) ==="
docker logs $CONTAINER --tail 40 2>&1

echo "=== STEP 9: New container ID ==="
docker inspect --format='{{.Id}}' $CONTAINER

echo "=== ALL DONE ==="
