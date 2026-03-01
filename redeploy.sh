#!/bin/bash
set -e

echo "=== Redeploying Frontend ==="
cd /var/www/frontend
rm -rf *
tar xf /root/frontend-dist.tar --strip-components=1
echo "Frontend updated: $(ls -la /var/www/frontend/assets/)"

echo ""
echo "=== Redeploying Backend ==="
cd /opt/claw-backend
# Keep .env and node_modules, update source code only
rm -rf src package.json package-lock.json .env.example .gitignore
tar xf /root/backend-deploy.tar --strip-components=1
npm install --production > /tmp/npm-install.log 2>&1
echo "Backend source updated"

echo ""
echo "=== Restarting Backend ==="
pm2 restart claw-backend
sleep 3
pm2 logs claw-backend --lines 5 --nostream

echo ""
echo "=== Testing ==="
echo "Frontend:"
curl -s http://localhost/ | head -3
echo ""
echo "API Health:"
curl -s http://localhost/api/health
echo ""
echo "=== Redeploy DONE ==="
