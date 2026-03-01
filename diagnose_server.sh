#!/bin/bash
echo "=== DISK ==="
df -h /
echo ""
echo "=== MEMORY ==="
free -h
echo ""
echo "=== PM2 RESTARTS ==="
pm2 jlist 2>/dev/null | python3 -c '
import sys,json
d=json.load(sys.stdin)
for p in d:
    print(f"{p[\"name\"]}: restarts={p[\"pm2_env\"][\"restart_time\"]}, status={p[\"pm2_env\"][\"status\"]}")
'
echo ""
echo "=== DOCKER CONTAINERS ==="
docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
echo ""
echo "=== BACKEND ERROR LOG (last 30) ==="
tail -30 /root/.pm2/logs/claw-backend-error.log 2>/dev/null || echo "(empty)"
echo ""
echo "=== BACKEND OUT LOG (last 30) ==="
tail -30 /root/.pm2/logs/claw-backend-out.log 2>/dev/null
echo ""
echo "=== LLM PROXY LOG (last 15) ==="
tail -15 /root/.pm2/logs/llm-proxy-out.log 2>/dev/null
echo ""
echo "=== NGINX ERROR LOG (last 15) ==="
tail -15 /var/log/nginx/error.log 2>/dev/null || echo "(empty)"
echo ""
echo "=== SSL CERT EXPIRY ==="
certbot certificates 2>/dev/null | grep -E "Expiry|Domains" || echo "certbot not found"
echo ""
echo "=== OPEN FILE DESCRIPTORS ==="
cat /proc/sys/fs/file-nr
echo ""
echo "=== DOCKER DISK USAGE ==="
docker system df 2>/dev/null
