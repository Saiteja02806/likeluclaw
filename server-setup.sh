#!/bin/bash
# ═══════════════════════════════════════════════════════
# LikelyClaw Server Setup Script
# Run this on your DigitalOcean Droplet (Ubuntu 24.04)
# via the DigitalOcean Console (browser terminal)
# ═══════════════════════════════════════════════════════

set -e

echo "============================================"
echo "  LikelyClaw Server Setup — Starting..."
echo "============================================"

# ── Step 1: Update system ──
echo ""
echo "[1/10] Updating system packages..."
apt update && apt upgrade -y

# ── Step 2: Install Docker ──
echo ""
echo "[2/10] Installing Docker..."
if command -v docker &> /dev/null; then
    echo "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed: $(docker --version)"
fi

# ── Step 3: Install Docker Compose (comes with Docker now) ──
echo ""
echo "[3/10] Verifying Docker Compose..."
docker compose version

# ── Step 4: Install Node.js 22 ──
echo ""
echo "[4/10] Installing Node.js 22..."
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
    echo "Node.js installed: $(node --version)"
fi

# ── Step 5: Install Nginx + Certbot + Git ──
echo ""
echo "[5/10] Installing Nginx, Certbot, Git..."
apt install -y nginx certbot python3-certbot-nginx git

# ── Step 6: Install PM2 ──
echo ""
echo "[6/10] Installing PM2..."
npm install -g pm2

# ── Step 7: Setup swap (prevents OOM crashes on 2GB RAM) ──
echo ""
echo "[7/10] Setting up swap space..."
if [ -f /swapfile ]; then
    echo "Swap already exists"
else
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "2GB swap created"
fi

# ── Step 8: Setup firewall ──
echo ""
echo "[8/10] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 3000
ufw --force enable
echo "Firewall configured"

# ── Step 9: Create project directories ──
echo ""
echo "[9/10] Creating project directories..."
mkdir -p /opt/claw-platform/users
mkdir -p /opt/claw-backend
mkdir -p /var/www/frontend

# ── Step 10: Clone OpenClaw + Build Docker Image ──
echo ""
echo "[10/10] Cloning OpenClaw and building Docker image..."
cd /opt/claw-platform

if [ -d "openclaw" ]; then
    echo "OpenClaw repo already exists, pulling latest..."
    cd openclaw && git pull && cd ..
else
    git clone https://github.com/openclaw/openclaw.git
fi

cd openclaw
echo "Building OpenClaw Docker image (this takes 5-10 minutes)..."
docker build -t openclaw:local -f Dockerfile .
echo "OpenClaw Docker image built successfully!"

# ── Step 11: Test OpenClaw Container ──
echo ""
echo "[BONUS] Testing OpenClaw container..."

# Create test user directory
mkdir -p /opt/claw-platform/users/test-user/emp1/.openclaw
mkdir -p /opt/claw-platform/users/test-user/emp1/workspace

# Generate a test gateway token
TEST_TOKEN=$(openssl rand -hex 16)

# Start a test OpenClaw container
docker run -d \
  --name claw-test-employee \
  -e HOME=/home/node \
  -e OPENCLAW_GATEWAY_TOKEN=$TEST_TOKEN \
  -v /opt/claw-platform/users/test-user/emp1/.openclaw:/home/node/.openclaw \
  -v /opt/claw-platform/users/test-user/emp1/workspace:/home/node/.openclaw/workspace \
  -p 19001:18789 \
  -p 19002:18790 \
  --restart unless-stopped \
  openclaw:local \
  node dist/index.js gateway --bind lan --port 18789 --allow-unconfigured

echo ""
echo "Test container started! Waiting 10 seconds for it to initialize..."
sleep 10

# Check if container is running
if docker ps | grep -q claw-test-employee; then
    echo "✅ OpenClaw test container is RUNNING!"
    echo "   Container: claw-test-employee"
    echo "   Gateway port: 19001"
    echo "   Bridge port: 19002"
    echo "   Token: $TEST_TOKEN"
    echo ""
    echo "   Dashboard URL: http://$(hostname -I | awk '{print $1}'):19001/?token=$TEST_TOKEN"
else
    echo "⚠️  Container may have failed. Checking logs..."
    docker logs claw-test-employee --tail 20
fi

# ── Final Verification ──
echo ""
echo "============================================"
echo "  VERIFICATION — All Components"
echo "============================================"
echo ""
echo "=== Docker ==="
docker --version
echo ""
echo "=== Docker Compose ==="
docker compose version
echo ""
echo "=== Node.js ==="
node --version
echo ""
echo "=== NPM ==="
npm --version
echo ""
echo "=== Nginx ==="
nginx -v
echo ""
echo "=== PM2 ==="
pm2 --version
echo ""
echo "=== Swap ==="
free -h | head -3
echo ""
echo "=== Firewall ==="
ufw status
echo ""
echo "=== Disk ==="
df -h /
echo ""
echo "=== Docker Containers ==="
docker ps
echo ""
echo "=== Docker Images ==="
docker images
echo ""
echo "============================================"
echo "  ✅ LikelyClaw Server Setup COMPLETE!"
echo "============================================"
echo ""
echo "  Next steps:"
echo "  1. Deploy the backend to /opt/claw-backend"
echo "  2. Deploy the frontend to /var/www/frontend"
echo "  3. Configure Nginx reverse proxy"
echo ""
