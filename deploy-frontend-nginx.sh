#!/bin/bash
set -e

echo "=== Deploying Frontend ==="
mkdir -p /var/www/frontend
cd /var/www/frontend
rm -rf *
tar xf /root/frontend-dist.tar --strip-components=1
chmod -R 755 /var/www/frontend/
echo "Frontend files deployed:"
ls -la /var/www/frontend/

echo ""
echo "=== Configuring Nginx ==="

cat > /etc/nginx/sites-available/likelyclaw << 'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

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

    # SPA fallback — all other routes serve index.html
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

# Remove default nginx site, enable likelyclaw
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/likelyclaw /etc/nginx/sites-enabled/likelyclaw

# Test nginx config
echo ""
echo "=== Testing Nginx Config ==="
nginx -t

# Reload nginx
echo ""
echo "=== Reloading Nginx ==="
systemctl reload nginx

echo ""
echo "=== Verifying ==="
echo "--- Nginx Status ---"
systemctl status nginx --no-pager | head -5

echo ""
echo "--- Testing Frontend (should return HTML) ---"
curl -s http://localhost/ | head -5

echo ""
echo "--- Testing API proxy (should return JSON) ---"
curl -s http://localhost/api/health

echo ""
echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "  Frontend: http://167.71.226.121/"
echo "  API:      http://167.71.226.121/api/health"
echo "  Backend:  PM2 on port 3000"
echo ""
echo "  Open http://167.71.226.121 in your browser!"
echo ""
