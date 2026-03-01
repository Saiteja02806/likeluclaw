#!/bin/bash
set -e

CONTAINER="claw-8b0688f6-154eb606"
CONFIGDIR="/opt/claw-platform/users/8b0688f6-154eb606/config"

echo "=== 1. Deploy backend ==="
cd /opt/claw-backend
rm -rf src .env.example
tar xf /root/backend-deploy.tar
npm install --production 2>&1 | tail -2
pm2 restart claw-backend
sleep 3
echo "Backend deployed"

echo "=== 2. Fix live openclaw.json: set model primary + providers ==="
node -e '
const fs = require("fs");
const configPath = "/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// The user has OpenAI provider — set models.providers with OpenAI config
config.models = config.models || {};
config.models.providers = config.models.providers || {};
// Note: API key will be set when user re-saves in Settings page
// For now ensure the provider structure exists

// CRITICAL: Set agents.defaults.model.primary to OpenAI model
// This prevents OpenClaw from defaulting to anthropic/claude-opus-4-6
config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.model = { primary: "openai/gpt-4o-mini" };

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

// Verify
const verify = JSON.parse(fs.readFileSync(configPath, "utf8"));
console.log("agents.defaults.model:", JSON.stringify(verify.agents.defaults.model));
console.log("models.providers keys:", Object.keys(verify.models.providers));
console.log("channels.telegram.enabled:", verify.channels?.telegram?.enabled);
console.log("plugins.entries.telegram:", JSON.stringify(verify.plugins?.entries?.telegram));
'

echo "=== 3. Fix permissions ==="
chown -R 1000:1000 $CONFIGDIR/

echo "=== 4. Restart container ==="
docker restart $CONTAINER 2>&1

echo "=== 5. Wait 60s ==="
sleep 60

echo "=== 6. Status ==="
docker ps --filter name=$CONTAINER --format '{{.Names}} {{.Status}}'

echo "=== 7. Logs (last 25) ==="
docker logs $CONTAINER --tail 25 2>&1

echo "=== DONE ==="
