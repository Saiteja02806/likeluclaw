#!/bin/bash
set -e

USER_DIR="/opt/claw-platform/users/8b0688f6-a49a11e0"
CONTAINER="claw-8b0688f6-a49a11e0"
EMPLOYEE_ID="a49a11e0-cba1-463f-bbf0-87efb7f398a8"

echo "========================================="
echo "STEP 2: Refresh token and write to container"
echo "========================================="

# Get fresh token using refresh_token from the existing credentials file
REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$USER_DIR/config/gmail-credentials.json'))['refresh_token'])")
CLIENT_ID=$(python3 -c "import json; print(json.load(open('$USER_DIR/config/gmail-credentials.json'))['client_id'])")
CLIENT_SECRET=$(python3 -c "import json; print(json.load(open('$USER_DIR/config/gmail-credentials.json'))['client_secret'])")

echo "Refreshing token with Google..."
RESPONSE=$(curl -s -X POST \
  -d "client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&refresh_token=$REFRESH_TOKEN&grant_type=refresh_token" \
  "https://oauth2.googleapis.com/token")

NEW_ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$NEW_ACCESS_TOKEN" ]; then
  echo "ERROR: Failed to refresh token!"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "Got fresh access token: ${NEW_ACCESS_TOKEN:0:20}..."

# Write to both credential file locations
CRED_JSON=$(python3 -c "
import json
cred = {
    'type': 'authorized_user',
    'client_id': '$CLIENT_ID',
    'client_secret': '$CLIENT_SECRET',
    'access_token': '$NEW_ACCESS_TOKEN',
    'refresh_token': '$REFRESH_TOKEN'
}
print(json.dumps(cred, indent=2))
")

echo "$CRED_JSON" > "$USER_DIR/config/gmail-credentials.json"
echo "$CRED_JSON" > "$USER_DIR/config/workspace/gmail-credentials.json"
chown -R 1000:1000 "$USER_DIR/config/"
echo "Token written to both credential files"

# Verify token works
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $NEW_ACCESS_TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/profile")
echo "Token verification: HTTP $HTTP_CODE"

echo ""
echo "========================================="
echo "STEP 3: Clear poisoned session history"
echo "========================================="

SESSIONS_DIR="$USER_DIR/config/agents/$EMPLOYEE_ID/sessions"
echo "Removing session files from: $SESSIONS_DIR"
rm -f "$SESSIONS_DIR"/*.jsonl
rm -f "$SESSIONS_DIR"/sessions.json
echo "Session history cleared"

echo ""
echo "========================================="
echo "STEP 4: Ensure workspace/memory/ exists"
echo "========================================="

mkdir -p "$USER_DIR/config/workspace/memory"
chown -R 1000:1000 "$USER_DIR/config/workspace/memory"
echo "workspace/memory/ directory ensured"

echo ""
echo "========================================="
echo "STEP 5: Update IDENTITY.md with better instructions"  
echo "========================================="

cat > /tmp/identity-update.py << 'PYEOF'
import sys

identity_path = sys.argv[1]
with open(identity_path, 'r') as f:
    content = f.read()

# Find the Gmail skill section and replace it with improved instructions
import re
old_section = re.search(r'<!-- skill:gmail -->[\s\S]*?<!-- /skill:gmail -->', content)
if old_section:
    # Remove old section, we'll add improved one
    content = content[:old_section.start()] + content[old_section.end():]

# Also remove any non-marked Gmail section
gmail_header = "## Gmail Skill"
if gmail_header in content:
    idx = content.index(gmail_header)
    content = content[:idx].rstrip()

# Add improved Gmail instructions
improved_gmail = """

<!-- skill:gmail -->
## Gmail Skill — Email Access

You have access to the user's Gmail account via OAuth. Credentials are stored in a JSON file.

### CRITICAL: How to Access Gmail

**STEP 1 — ALWAYS read the credentials file first:**
```bash
cat ~/.openclaw/gmail-credentials.json
```

**STEP 2 — Extract the access_token value from the JSON output.**

**STEP 3 — Use that EXACT token in your curl commands.** NEVER use placeholder text like "ACCESS_TOKEN". Always use the real token you just read.

### Example: List recent emails
```bash
# First read the token
TOKEN=$(cat ~/.openclaw/gmail-credentials.json | grep access_token | cut -d'"' -f4)
# Then use it
curl -s -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5"
```

### Example: Get a specific email by ID
```bash
TOKEN=$(cat ~/.openclaw/gmail-credentials.json | grep access_token | cut -d'"' -f4)
curl -s -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/messages/MESSAGE_ID?format=full"
```

### Example: Search emails
```bash
TOKEN=$(cat ~/.openclaw/gmail-credentials.json | grep access_token | cut -d'"' -f4)
curl -s -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=SEARCH_QUERY&maxResults=10"
```

### Example: List unread emails
```bash
TOKEN=$(cat ~/.openclaw/gmail-credentials.json | grep access_token | cut -d'"' -f4)
curl -s -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=10"
```

### Decode base64url email body
```bash
echo "BASE64_DATA" | tr '_-' '/+' | base64 -d
```

### Send an Email (ALWAYS ask user to confirm before sending)
```bash
TOKEN=$(cat ~/.openclaw/gmail-credentials.json | grep access_token | cut -d'"' -f4)
RAW=$(echo -e "From: me\\nTo: recipient@example.com\\nSubject: Test\\n\\nHello!" | base64 -w 0 | tr '/+' '_-' | tr -d '=')
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\\"raw\\": \\"$RAW\\"}" "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
```

### If you get a 401 error, refresh the token:
```bash
CLIENT_ID=$(cat ~/.openclaw/gmail-credentials.json | grep client_id | cut -d'"' -f4)
CLIENT_SECRET=$(cat ~/.openclaw/gmail-credentials.json | grep client_secret | cut -d'"' -f4)
REFRESH_TOKEN=$(cat ~/.openclaw/gmail-credentials.json | grep refresh_token | cut -d'"' -f4)
curl -s -X POST -d "client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&refresh_token=$REFRESH_TOKEN&grant_type=refresh_token" "https://oauth2.googleapis.com/token"
```
Use the new access_token from the response.

### Important Rules
- ALWAYS read ~/.openclaw/gmail-credentials.json FIRST to get the real token
- NEVER use placeholder text like "ACCESS_TOKEN" — always use the actual token value
- NEVER auto-send emails without explicit user confirmation
- When summarizing: include sender, subject, date, and key points
- Parse payload.headers for From, Subject, Date fields
- Body is in payload.body.data or payload.parts[].body.data (base64url encoded)
<!-- /skill:gmail -->
"""

content = content.rstrip() + improved_gmail

with open(identity_path, 'w') as f:
    f.write(content)

print("IDENTITY.md updated with improved Gmail instructions")
PYEOF

python3 /tmp/identity-update.py "$USER_DIR/config/workspace/IDENTITY.md"
chown 1000:1000 "$USER_DIR/config/workspace/IDENTITY.md"

echo ""
echo "========================================="
echo "STEP 6: Restart backend and container"
echo "========================================="

# Restart PM2 backend (picks up new token-refresh.js)
pm2 restart claw-backend
sleep 3
echo "Backend restarted"

# Restart container (picks up fresh creds, clear sessions, new IDENTITY.md)
cd "$USER_DIR"
docker compose restart
sleep 15

echo ""
echo "========================================="
echo "VERIFICATION"
echo "========================================="

echo "Container status:"
docker ps --format '{{.Names}} {{.Status}}' | grep claw

echo ""
echo "Token verification from inside container:"
docker exec $CONTAINER sh -c 'TOKEN=$(cat /home/node/.openclaw/gmail-credentials.json | grep access_token | cut -d"\"" -f4) && curl -s -o /dev/null -w "HTTP %{http_code}" -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/profile"'

echo ""
echo "Session files (should be empty/new):"
docker exec $CONTAINER ls -la /home/node/.openclaw/agents/$EMPLOYEE_ID/sessions/ 2>/dev/null || echo "No sessions dir yet (clean)"

echo ""
echo "Container logs:"
docker logs $CONTAINER --tail 15 2>&1

echo ""
echo "Backend token-refresh verification:"
grep -c 'updateContainerCredentials' /opt/claw-backend/src/jobs/token-refresh.js
echo "occurrences of updateContainerCredentials in deployed code"

echo ""
echo "========================================="
echo "ALL FIXES APPLIED"
echo "========================================="
