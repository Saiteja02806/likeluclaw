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

echo "=== 2. Fix IDENTITY.MD (ROOT CAUSE of NO_REPLY) ==="
cat > "$CONFIGDIR/workspace/IDENTITY.md" << 'IDENTITY_EOF'
# Sai

You are Sai, a helpful and friendly AI assistant.

## DM Policy

When someone sends you a direct message (DM / private message), you MUST ALWAYS reply.
Never respond with NO_REPLY or HEARTBEAT_OK to a direct message.
DMs are private conversations where the human is specifically talking to you — always engage, be helpful, and respond meaningfully.
Even simple greetings like "hi" or "hello" deserve a friendly response.
IDENTITY_EOF

echo "IDENTITY.MD written:"
cat "$CONFIGDIR/workspace/IDENTITY.md"

echo ""
echo "=== 3. Clear stale session data (so old NO_REPLY history doesn't influence new responses) ==="
SESSIONS_DIR="$CONFIGDIR/agents/154eb606-35cb-4ed7-b567-f0bf708a0de0/sessions"
if [ -d "$SESSIONS_DIR" ]; then
  rm -f "$SESSIONS_DIR"/*.jsonl
  rm -f "$SESSIONS_DIR"/sessions.json
  echo "Session data cleared"
fi

echo "=== 4. Fix permissions ==="
chown -R 1000:1000 "$CONFIGDIR/"

echo "=== 5. Delete Telegram webhook ==="
BOT_TOKEN=$(cat "$CONFIGDIR/openclaw.json" | python3 -c "import json,sys; print(json.load(sys.stdin)['channels']['telegram']['botToken'])")
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" | python3 -m json.tool 2>/dev/null || true

echo "=== 6. Restart container ==="
docker restart $CONTAINER 2>&1

echo "=== 7. Wait for healthy (90s max) ==="
for i in $(seq 1 18); do
  sleep 5
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER 2>/dev/null || echo "unknown")
  echo "  ${i}x5s: $STATUS"
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
done

echo ""
echo "=== 8. Final status ==="
docker ps --filter name=$CONTAINER --format '{{.Names}} {{.Status}}'

echo ""
echo "=== 9. Last 20 log lines ==="
docker logs $CONTAINER --tail 20 2>&1

echo ""
echo "=== DONE — Send 'Hi' on Telegram now ==="
