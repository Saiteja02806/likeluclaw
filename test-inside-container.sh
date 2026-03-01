#!/bin/bash
echo "=== J. TEST TOKEN FROM INSIDE CONTAINER ==="
TOKEN=$(cat /home/node/.openclaw/gmail-credentials.json | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
echo "Token prefix: ${TOKEN:0:30}..."
HTTP_CODE=$(curl -s -o /tmp/gmail-test.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=2")
echo "HTTP Status: $HTTP_CODE"
cat /tmp/gmail-test.json | head -20
echo ""

echo "=== K. TEST READ TOOL (simulating agent) ==="
cat /home/node/.openclaw/gmail-credentials.json | head -3
echo "..."

echo "=== L. GMAIL-CREDENTIALS PATH CHECK ==="
ls -la /home/node/.openclaw/gmail-credentials.json
ls -la /home/node/.openclaw/workspace/gmail-credentials.json 2>/dev/null || echo "No workspace copy"

echo "=== M. WHICH PATH DOES IDENTITY.MD REFERENCE? ==="
grep "gmail-credentials" /home/node/.openclaw/workspace/IDENTITY.md

echo "=== N. SESSIONS FILE SIZE ==="
ls -la /home/node/.openclaw/agents/a49a11e0-cba1-463f-bbf0-87efb7f398a8/sessions/

echo "=== O. CAN CURL RUN? ==="
which curl
curl --version | head -1
