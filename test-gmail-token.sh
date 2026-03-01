#!/bin/bash
ACCESS_TOKEN=$(python3 -c "import json; print(json.load(open('/opt/claw-platform/users/8b0688f6-a49a11e0/config/gmail-credentials.json'))['access_token'])")
echo "Token prefix: ${ACCESS_TOKEN:0:20}..."
HTTP_CODE=$(curl -s -o /tmp/gmail-test.json -w '%{http_code}' -H "Authorization: Bearer $ACCESS_TOKEN" 'https://gmail.googleapis.com/gmail/v1/users/me/profile')
echo "HTTP Status: $HTTP_CODE"
cat /tmp/gmail-test.json
echo ""
echo "=== CONTAINER RESTART ==="
cd /opt/claw-platform/users/8b0688f6-a49a11e0
docker compose down 2>&1
sleep 2
docker compose up -d 2>&1
sleep 5
docker ps --format '{{.Names}} {{.Status}}' | grep claw
echo "=== NEW CONTAINER LOGS ==="
docker logs claw-8b0688f6-a49a11e0 --tail 30 2>&1
