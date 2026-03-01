#!/bin/bash
set -e

CONFIGDIR="/opt/claw-platform/users/8b0688f6-154eb606/config"
CONTAINER="claw-8b0688f6-154eb606"

echo "=== Enable Telegram plugin ==="
cd /opt/claw-backend
node -e '
const fs = require("fs");
const configPath = "/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
// Enable the Telegram plugin
config.plugins = config.plugins || {};
config.plugins.entries = config.plugins.entries || {};
config.plugins.entries.telegram = { enabled: true };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Telegram plugin enabled");
console.log("plugins.entries.telegram:", JSON.stringify(config.plugins.entries.telegram));
console.log("channels.telegram.enabled:", config.channels.telegram.enabled);
'

echo "=== Fix permissions ==="
chown -R 1000:1000 $CONFIGDIR/

echo "=== Restart container ==="
docker restart $CONTAINER 2>&1

echo "=== Wait 75s ==="
sleep 75

echo "=== Status ==="
docker ps --filter name=$CONTAINER --format '{{.Names}} {{.Status}}'
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' $CONTAINER 2>/dev/null

echo "=== Logs (look for Telegram started) ==="
docker logs $CONTAINER --tail 40 2>&1

echo "=== Updated config ==="
cat $CONFIGDIR/openclaw.json

echo "=== Container ID ==="
docker inspect --format='{{.Id}}' $CONTAINER

echo "=== DONE ==="
