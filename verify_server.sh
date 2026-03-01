#!/bin/bash
echo "=== HEALTH CHECK ==="
curl -s http://localhost:3000/api/health | python3 -m json.tool

echo ""
echo "=== PM2 STATUS ==="
pm2 jlist 2>/dev/null | python3 -c '
import sys,json
d=json.load(sys.stdin)
for p in d:
    e = p["pm2_env"]
    print(f"  {p[\"name\"]}: status={e[\"status\"]}, restarts={e[\"restart_time\"]}, mem={p[\"monit\"][\"memory\"]//1024//1024}MB")
'

echo ""
echo "=== BACKEND ERROR LOG (last 5) ==="
tail -5 /root/.pm2/logs/claw-backend-error.log 2>/dev/null || echo "  (empty)"

echo ""
echo "=== RECENT API CALLS ==="
tail -10 /root/.pm2/logs/claw-backend-out.log 2>/dev/null | grep -E "GET|POST|PUT|DELETE" | tail -5

echo ""
echo "=== DOCKER ==="
docker ps --format "  {{.Names}}: {{.Status}}"

echo ""
echo "=== DISK ==="
df -h / | tail -1

echo ""
echo "=== MEMORY ==="
free -h | grep Mem

echo ""
echo "=== SSL ==="
certbot certificates 2>/dev/null | grep "Expiry" || echo "  certbot not found"

echo ""
echo "=== NGINX CONFIG TEST ==="
nginx -t 2>&1
