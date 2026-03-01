#!/bin/bash
# Fix approvals.exec.enabled: true → false (true = require approval, false = auto-approve)
CONFIG="/opt/claw-platform/users/8b0688f6-a49a11e0/config/openclaw.json"

# Use python3 to update the JSON properly
python3 -c "
import json
with open('$CONFIG') as f:
    config = json.load(f)
config['approvals'] = {'exec': {'enabled': False}}
with open('$CONFIG', 'w') as f:
    json.dump(config, f, indent=2)
print('Config updated: approvals.exec.enabled = false')
"

# Verify
echo "=== VERIFY ==="
python3 -c "import json; c=json.load(open('$CONFIG')); print('approvals:', c.get('approvals'))"

# Fix ownership
chown 1000:1000 "$CONFIG"

# Restart container
echo "=== RESTARTING CONTAINER ==="
cd /opt/claw-platform/users/8b0688f6-a49a11e0
docker compose restart
sleep 15

echo "=== STATUS ==="
docker ps --format '{{.Names}} {{.Status}}' | grep claw

echo "=== LOGS ==="
docker logs claw-8b0688f6-a49a11e0 --tail 20 2>&1
