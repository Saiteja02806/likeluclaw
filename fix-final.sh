#!/bin/bash
set -e

CONTAINER="claw-8b0688f6-154eb606"
CONFIGDIR="/opt/claw-platform/users/8b0688f6-154eb606/config"

echo "=== 1. Check current config ==="
cat $CONFIGDIR/openclaw.json

echo ""
echo "=== 2. Find OpenClaw binary ==="
BINARY=$(docker exec $CONTAINER cat /proc/1/cmdline 2>/dev/null | tr '\0' ' ')
echo "PID 1 command: $BINARY"
docker exec $CONTAINER ls -la /app/dist/cli/ 2>/dev/null | head -5 || echo "no cli dir"
docker exec $CONTAINER find / -maxdepth 3 -name 'openclaw*' -type f 2>/dev/null | head -10 || echo "no openclaw binary found"

echo ""
echo "=== 3. Try running doctor --fix via node ==="
docker exec $CONTAINER node -e '
const { execSync } = require("child_process");
try {
  const result = execSync("/proc/1/exe doctor --fix", { timeout: 10000 }).toString();
  console.log("Doctor output:", result);
} catch (e) {
  console.log("Doctor via /proc/1/exe failed:", e.message.substring(0, 200));
}
' 2>&1 || echo "node exec failed"

echo ""
echo "=== 4. Check if OpenClaw auto-modified the config ==="
cat $CONFIGDIR/openclaw.json

echo ""
echo "=== 5. Grep for telegram in all logs ==="
docker logs $CONTAINER 2>&1 | grep -i "telegram" | tail -15

echo ""
echo "=== 6. Check entrypoint ==="
docker exec $CONTAINER cat /app/package.json 2>/dev/null | grep -A 3 '"bin"' || echo "no bin in package.json"
docker exec $CONTAINER cat /app/package.json 2>/dev/null | grep -A 3 '"main"' || echo "no main"
docker exec $CONTAINER cat /app/package.json 2>/dev/null | grep -A 3 '"start"' || echo "no start"

echo ""
echo "=== 7. Check if there is a doctor CLI entry ==="
docker exec $CONTAINER ls /app/dist/cli/ 2>/dev/null | head -20 || echo "no dist/cli"
docker exec $CONTAINER ls /app/src/cli/ 2>/dev/null | head -20 || echo "no src/cli"

echo ""
echo "=== DONE ==="
