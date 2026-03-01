#!/bin/bash
set -e

echo "=== Verifying modules ==="
cd /opt/claw-backend
ls node_modules/proper-lockfile/index.js && echo "proper-lockfile found"

echo "=== Testing require ==="
node -e 'require("proper-lockfile"); console.log("proper-lockfile OK")'
node -e 'require("./src/lib/config-lock"); console.log("config-lock OK")'
node -e 'require("./src/lib/container-utils"); console.log("container-utils OK")'

echo "=== Checking PM2 config ==="
pm2 describe claw-backend | grep "exec cwd"

echo "=== Killing and restarting PM2 process ==="
pm2 delete claw-backend 2>/dev/null || true
cd /opt/claw-backend
pm2 start src/server.js --name claw-backend --cwd /opt/claw-backend
sleep 4

echo "=== PM2 status ==="
pm2 list

echo "=== Recent logs ==="
pm2 logs claw-backend --lines 10 --nostream

echo "=== Health check ==="
curl -s http://localhost:3000/api/health | head -1
echo ""
echo "=== DONE ==="
