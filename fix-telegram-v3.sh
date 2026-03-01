#!/bin/bash
set -e

USERDIR="/opt/claw-platform/users/8b0688f6-154eb606"
CONTAINER="claw-8b0688f6-154eb606"

echo "=== STEP 1: Deploy backend ==="
cd /opt/claw-backend
rm -rf src .env.example
tar xf /root/backend-deploy.tar
npm install --production 2>&1 | tail -2
pm2 restart claw-backend
sleep 3
curl -sk https://localhost/api/health && echo ""
echo "Backend deployed"

echo "=== STEP 2: Write correct openclaw.json config ==="
cd /opt/claw-backend
node -e '
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { decrypt } = require("./src/lib/encryption");
const fs = require("fs");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data } = await supabase
    .from("profiles")
    .select("api_key_encrypted, api_key_provider")
    .eq("id", "8b0688f6-7d6d-4bd6-bf53-e76ea74bb77c")
    .single();

  let apiKey = "";
  let provider = (data && data.api_key_provider) || "openai";
  if (data && data.api_key_encrypted) {
    try {
      apiKey = decrypt(data.api_key_encrypted);
      console.log("API key decrypted, length:", apiKey.length);
    } catch (e) {
      console.log("Decrypt failed:", e.message);
      console.log("API key will be empty - user must re-save in Settings");
    }
  }

  const config = {
    gateway: {
      port: 18789,
      auth: { token: "55fd05e702d921c8d1bd553c4cd984d7d887cffc28cbf6a1c13e11fe6f3bd146" }
    },
    models: {
      providers: {}
    },
    channels: {
      telegram: {
        enabled: true,
        botToken: "8002979852:AAFgQn8I8Xy3oP5nz5pjZ0d5xVX0ZH2jJlY",
        dmPolicy: "open",
        allowFrom: ["*"]
      }
    },
    agents: {
      list: [
        {
          id: "154eb606-35cb-4ed7-b567-f0bf708a0de0",
          name: "Sai",
          systemPrompt: "You are a helpful AI assistant."
        }
      ]
    }
  };

  if (apiKey) {
    const baseUrl = provider === "anthropic"
      ? "https://api.anthropic.com/v1"
      : "https://api.openai.com/v1";
    const modelId = provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o-mini";
    const modelName = provider === "anthropic" ? "Claude Sonnet" : "GPT-4o Mini";
    config.models.providers[provider] = {
      baseUrl: baseUrl,
      apiKey: apiKey,
      models: [{ id: modelId, name: modelName }]
    };
    console.log("Model provider set:", provider, "model:", modelId);
  } else {
    console.log("WARNING: No API key - bot will receive messages but cannot generate AI responses");
  }

  const configPath = "/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json";
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("Config written OK");

  // Verify
  const verify = JSON.parse(fs.readFileSync(configPath, "utf8"));
  console.log("Verify - telegram.enabled:", verify.channels.telegram.enabled);
  console.log("Verify - telegram.dmPolicy:", verify.channels.telegram.dmPolicy);
  console.log("Verify - agents.list[0].name:", verify.agents.list[0].name);
  console.log("Verify - models.providers keys:", Object.keys(verify.models.providers));
}

main().catch(e => { console.error(e); process.exit(1); });
'

echo "=== STEP 3: Stop old container ==="
docker rm -f $CONTAINER 2>/dev/null || true

echo "=== STEP 4: Write docker-compose ==="
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

echo "=== STEP 5: Start container ==="
cd $USERDIR
docker compose up -d 2>&1

echo "=== STEP 6: Wait 75s ==="
sleep 75

echo "=== STEP 7: Status ==="
docker ps --filter name=$CONTAINER --format '{{.Names}} {{.Status}}'
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' $CONTAINER 2>/dev/null

echo "=== STEP 8: Logs ==="
docker logs $CONTAINER --tail 40 2>&1

echo "=== STEP 9: Container ID ==="
docker inspect --format='{{.Id}}' $CONTAINER

echo "=== DONE ==="
