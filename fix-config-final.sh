#!/bin/bash
set -e

echo "=== Fix config ==="
cd /opt/claw-backend
node -e '
const fs = require("fs");
const configPath = "/opt/claw-platform/users/8b0688f6-154eb606/config/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.agents = { list: [{ id: "154eb606-35cb-4ed7-b567-f0bf708a0de0", name: "Sai" }] };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Config fixed");
const wsDir = "/opt/claw-platform/users/8b0688f6-154eb606/config/workspace";
fs.mkdirSync(wsDir, { recursive: true });
fs.writeFileSync(wsDir + "/IDENTITY.md", "You are a helpful AI assistant named Sai.");
console.log("IDENTITY.md written");
const verify = JSON.parse(fs.readFileSync(configPath, "utf8"));
console.log(JSON.stringify(verify, null, 2));
'

echo "=== Restart container ==="
docker restart claw-8b0688f6-154eb606 2>&1

echo "=== Wait 75s ==="
sleep 75

echo "=== Status ==="
docker ps --filter name=claw-8b0688f6 --format '{{.Names}} {{.Status}}'

echo "=== Logs ==="
docker logs claw-8b0688f6-154eb606 --tail 40 2>&1

echo "=== Done ==="
