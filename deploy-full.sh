#!/bin/bash
set -e

echo "============================================"
echo "  LikelyClaw Full Deployment to likelyclaw.com"
echo "============================================"
echo ""

# ── Step 1: Update Frontend ──
echo "[1/5] Deploying frontend..."
cd /var/www/frontend
rm -rf *
tar xf /root/frontend-dist.tar --strip-components=1
echo "Frontend files:"
ls -la /var/www/frontend/
echo "✅ Frontend deployed"

# ── Step 2: Update Backend Source ──
echo ""
echo "[2/5] Deploying backend..."
cd /opt/claw-backend
rm -rf src .env.example
tar xf /root/backend-deploy.tar
npm install --production 2>&1 | tail -3
echo "✅ Backend source updated"

# ── Step 3: Update Backend .env ──
echo ""
echo "[3/5] Updating backend .env..."
# Update DOMAIN
sed -i 's|DOMAIN=.*|DOMAIN=likelyclaw.com|' /opt/claw-backend/.env
# Update FROM_EMAIL
sed -i 's|FROM_EMAIL=.*|FROM_EMAIL=hello@likelyclaw.com|' /opt/claw-backend/.env
# Update GOOGLE_REDIRECT_URI
sed -i 's|GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=https://pbrfftorddhbsujcuclk.supabase.co/auth/v1/callback|' /opt/claw-backend/.env
echo "Updated .env:"
grep -E "^(DOMAIN|FROM_EMAIL|GOOGLE_REDIRECT_URI|NODE_ENV)" /opt/claw-backend/.env
echo "✅ .env updated"

# ── Step 4: Restart Backend ──
echo ""
echo "[4/5] Restarting backend..."
pm2 restart claw-backend
sleep 3
pm2 logs claw-backend --lines 5 --nostream
echo "✅ Backend restarted"

# ── Step 5: Update Nginx for likelyclaw.com ──
echo ""
echo "[5/5] Updating Nginx config..."

cat > /etc/nginx/sites-available/likelyclaw << 'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name likelyclaw.com www.likelyclaw.com;

    # Frontend static files
    root /var/www/frontend;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/likelyclaw /etc/nginx/sites-enabled/likelyclaw
nginx -t
systemctl reload nginx
echo "✅ Nginx updated for likelyclaw.com"

# ── Verification ──
echo ""
echo "============================================"
echo "  VERIFICATION"
echo "============================================"
echo ""
echo "--- PM2 Status ---"
pm2 status
echo ""
echo "--- Health Check ---"
sleep 2
curl -s http://localhost/api/health
echo ""
echo ""
echo "--- Frontend Check ---"
curl -s http://localhost/ | head -3
echo ""
echo ""
echo "============================================"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "  Your site: http://likelyclaw.com"
echo "  API:       http://likelyclaw.com/api/health"
echo ""
echo "  NEXT: Run SSL certificate:"
echo "  certbot --nginx -d likelyclaw.com -d www.likelyclaw.com"
echo ""
