#!/bin/bash
set -e

echo "=== Fixing .env encryption key ==="
cd /opt/claw-backend
ENCKEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sed -i "s|TOKEN_ENCRYPTION_KEY=.*|TOKEN_ENCRYPTION_KEY=$ENCKEY|" .env
echo "Encryption key set: ${ENCKEY:0:8}..."

echo ""
echo "=== Verifying .env ==="
cat .env

echo ""
echo "=== Starting backend with PM2 ==="
cd /opt/claw-backend
pm2 delete claw-backend 2>/dev/null || true
pm2 start src/server.js --name claw-backend --env production
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "=== Backend Status ==="
pm2 status
sleep 3
pm2 logs claw-backend --lines 15 --nostream

echo ""
echo "=== Testing backend API ==="
curl -s http://localhost:3000/health 2>/dev/null || curl -s http://localhost:3000/ 2>/dev/null || echo "Backend may need a health endpoint"

echo ""
echo "=== Backend deployment done! ==="
