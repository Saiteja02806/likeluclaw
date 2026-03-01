# ClawCloud — Core Concepts Explained Simply

> This file explains **every technology and concept** used in the ClawCloud project.
> Each concept is explained with real-world analogies, examples, and diagrams.
> Read this before touching any code.

---

## Table of Contents

1. [What Problem Are We Solving?](#1-what-problem-are-we-solving)
2. [Docker — The Isolation Engine](#2-docker--the-isolation-engine)
3. [Docker Compose — The Blueprint](#3-docker-compose--the-blueprint)
4. [Nginx — The Traffic Director](#4-nginx--the-traffic-director)
5. [Reverse Proxy — How Nginx Routes Traffic](#5-reverse-proxy--how-nginx-routes-traffic)
6. [DNS — How Domains Work](#6-dns--how-domains-work)
7. [Wildcard SSL — One Certificate, Infinite Subdomains](#7-wildcard-ssl--one-certificate-infinite-subdomains)
8. [WebSockets — Real-Time Communication](#8-websockets--real-time-communication)
9. [REST API — How Frontend Talks to Backend](#9-rest-api--how-frontend-talks-to-backend)
10. [JWT Authentication — Who Are You?](#10-jwt-authentication--who-are-you)
11. [PostgreSQL — The Database](#11-postgresql--the-database)
12. [Supabase — PostgreSQL Made Easy](#12-supabase--postgresql-made-easy)
13. [OpenClaw — The AI Brain Inside Each Container](#13-openclaw--the-ai-brain-inside-each-container)
14. [WhatsApp Integration (Baileys)](#14-whatsapp-integration-baileys--how-qr-pairing-works)
15. [Telegram Integration (grammY)](#15-telegram-integration-grammy--how-bot-tokens-work)
16. [Stripe — Payment Processing](#16-stripe--payment-processing)
17. [Webhooks — Events Calling Your Server](#17-webhooks--events-calling-your-server)
18. [Multi-Tenancy — One Server, Many Customers](#18-multi-tenancy--one-server-many-customers)
19. [Port Mapping — How Containers Get Their Own Address](#19-port-mapping--how-containers-get-their-own-address)
20. [Environment Variables — Secret Configuration](#20-environment-variables--secret-configuration)
21. [Encryption — Protecting Sensitive Data](#21-encryption--protecting-sensitive-data)
22. [React + Vite — The Frontend](#22-react--vite--the-frontend)
23. [The Complete Request Journey — End to End](#23-the-complete-request-journey--end-to-end)
24. [Supabase Connection Details](#24-supabase-connection-details)

---

## 1. What Problem Are We Solving?

### The Problem

Imagine you discover **OpenClaw** — an amazing open-source AI assistant that can:
- Chat on WhatsApp and Telegram
- Browse the web for you
- Write emails, code, documents
- Manage your calendar

But to use it, you need to:
- Rent a Linux server ($5-20/mo)
- Install Docker
- Run terminal commands
- Configure files manually
- Maintain it yourself 24/7

**99% of people will never do this.** They want AI but don't want to deal with servers.

### The Solution (What We Build)

We do the hard part **once**, then sell it to hundreds of people:

```
WITHOUT US (user does everything):
  User → Rents server → Installs Docker → Configures OpenClaw → Maintains it
  Time: 2-4 hours
  Skill: Advanced (Linux, Docker, networking)

WITH US (user does nothing):
  User → Signs up on our website → Clicks "Create Employee" → Scans QR code → Done
  Time: 5 minutes
  Skill: None (just a web browser and a phone)
```

### Real-World Analogy

```
Think of it like ELECTRICITY:

Option A (self-hosted OpenClaw):
  You buy a diesel generator, fuel, learn to maintain it,
  fix it when it breaks, buy replacement parts...

Option B (ClawCloud — us):
  You plug into the wall and pay a monthly electricity bill.
  Someone else maintains the power plant.

We are the power company. OpenClaw is the generator.
The customer just wants the electricity (AI responses).
```

### The Money

```
Our costs:
  Server: $18/month (Hetzner CX41)
  Domain: $1/month ($10/year)
  Total:  ~$19/month

Our revenue per customer:
  Basic plan: $20/month

Break-even: 1 customer
10 customers: $200/month revenue, $19 cost = $181 profit
100 customers: $2,000/month revenue, $24 cost = $1,976 profit
```

---

## 2. Docker — The Isolation Engine

### What is Docker?

Docker lets you run an application in a **container** — a lightweight, isolated mini-computer inside your real computer.

### Real-World Analogy

```
YOUR SERVER = An apartment building

WITHOUT Docker:
  All tenants share one big room.
  If one person plays loud music, everyone suffers.
  If one person breaks the plumbing, the whole building floods.

WITH Docker (containers):
  Each tenant gets their OWN apartment with:
  - Their own bathroom (filesystem)
  - Their own kitchen (CPU/memory)
  - Their own front door (network port)
  - Sound-proof walls (isolation)

  If Sarah's apartment floods, Bob's apartment is fine.
```

### Why We Need Docker

Each customer gets their own OpenClaw instance. Without Docker:

```
BAD — No Docker (all customers on same machine):
  Customer Sarah's bot crashes → EVERYONE's bot crashes
  Customer Bob installs bad plugin → breaks Sarah's bot too
  Can't give each customer separate settings

GOOD — With Docker:
  Customer Sarah's container → completely isolated
  Customer Bob's container → completely isolated
  Sarah crashes? Only Sarah is affected.
  Bob has different settings? No problem, separate container.
```

### Docker in Action — What It Looks Like

```bash
# Start a new container for customer "sarah"
docker run -d \
  --name claw-sarah \
  -p 19001:18789 \
  -v /opt/claw-platform/users/sarah/config:/root/.openclaw \
  -e OPENAI_API_KEY=sk-sarah-key \
  openclaw:local

# What this command does:
#   -d                    = Run in background (detached)
#   --name claw-sarah     = Name this container "claw-sarah"
#   -p 19001:18789        = Map port 19001 (outside) → 18789 (inside)
#   -v /opt/.../config:/root/.openclaw = Share a folder with the container
#   -e OPENAI_API_KEY=... = Set an environment variable inside
#   openclaw:local        = The image (template) to use
```

### Docker Images vs Containers

```
IMAGE = The blueprint/recipe (like a cookie cutter)
  - Created once
  - Read-only
  - Shared by all containers

CONTAINER = A running instance (like an actual cookie)
  - Created from an image
  - Each one is independent
  - Can be started, stopped, deleted

Example:
  1 Image:  "openclaw:local"  (the OpenClaw software)
  ↓
  100 Containers from that same image:
    claw-sarah  (customer 1)
    claw-bob    (customer 2)
    claw-jane   (customer 3)
    ... each with their own data, settings, and API keys
```

### Key Docker Commands

```bash
docker ps                    # List running containers
docker ps -a                 # List ALL containers (including stopped)
docker logs claw-sarah       # See logs from Sarah's container
docker restart claw-sarah    # Restart Sarah's container
docker stop claw-sarah       # Stop Sarah's container
docker rm claw-sarah         # Delete Sarah's container
docker exec -it claw-sarah bash  # Open a terminal inside the container
```

---

## 3. Docker Compose — The Blueprint

### What is Docker Compose?

Docker Compose is a **YAML file** that describes exactly how to run a container (or multiple containers). Instead of typing a long `docker run` command, you write a file.

### Real-World Analogy

```
docker run command = Telling a builder verbally what to build
docker-compose.yml = Giving the builder architectural blueprints

The blueprint is:
  - Repeatable (build the same thing every time)
  - Shareable (anyone can read it)
  - Version-controlled (save in Git)
```

### Example: One Customer's docker-compose.yml

```yaml
# File: /opt/claw-platform/users/sarah/docker-compose.yml

version: '3.8'

services:
  openclaw:
    image: openclaw:local
    container_name: claw-sarah
    restart: always
    ports:
      - "19001:18789"
    volumes:
      - ./config:/root/.openclaw
    environment:
      - OPENAI_API_KEY=sk-proj-sarah-key
      - GATEWAY_AUTH_TOKEN=abc123secret
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### What Each Field Means (Plain English)

```
image: openclaw:local
  → "Use the OpenClaw software template we built"

container_name: claw-sarah
  → "Call this container claw-sarah so we can find it later"

restart: always
  → "If it crashes at 3 AM, restart automatically without waking us up"

ports: "19001:18789"
  → "When someone connects to port 19001 on our server,
     forward it to port 18789 inside the container"

volumes: ./config:/root/.openclaw
  → "Share a folder between our server and the container"

environment: OPENAI_API_KEY=sk-...
  → "Set this secret value INSIDE the container"

deploy.resources.limits
  → "Don't let this container use more than 0.5 CPU and 512MB RAM"

healthcheck
  → "Every 30 seconds, check if the container is alive"
```

### Docker Compose Commands

```bash
docker-compose up -d        # Start container in background
docker-compose down          # Stop and remove container
docker-compose restart       # Restart container
docker-compose logs -f       # Watch live logs
docker-compose ps            # Check status
```

---

## 4. Nginx — The Traffic Director

### What is Nginx?

Nginx (pronounced "engine-X") is a **web server** and **reverse proxy**. It sits at the front door of your server and decides where to send each incoming request.

### Real-World Analogy

```
YOUR SERVER = A huge office building

Nginx = The RECEPTIONIST at the front desk

Visitor arrives: "I'm here for c-sarah.clawcloud.com"
Receptionist: "Sarah is in Room 19001, go right ahead."

Another visitor: "I need c-bob.clawcloud.com"
Receptionist: "Bob is in Room 19002, down the hall."

Another visitor: "I want app.clawcloud.com"
Receptionist: "That's our main dashboard, follow me to the lobby."

Without the receptionist:
  Visitors would wander the halls aimlessly.
  Some might walk into the wrong room.
  There's no security check.
```

### What Nginx Does in Our Project

```
                    ┌─────────────────────────┐
   Internet ───────►│         NGINX           │
   (all traffic)    │     (Port 80 & 443)     │
                    │                         │
                    │  1. Terminates SSL      │  (handles HTTPS encryption)
                    │  2. Reads the domain    │  (which subdomain?)
                    │  3. Routes to backend   │  (which container/service?)
                    └────────┬────────────────┘
                             │
               ┌─────────────┼─────────────────┐
               │             │                  │
               ▼             ▼                  ▼
        app.clawcloud.com   api.clawcloud.com  c-sarah.clawcloud.com
        → React files       → Backend :3000    → Container :19001
        (static HTML/JS)    (Node.js API)      (OpenClaw)
```

### Nginx Config Example

```nginx
# This "map" is like a phone directory:
map $host $backend_port {
    hostnames;
    default 0;
    include /etc/nginx/customer_map.conf;
}

server {
    listen 443 ssl;
    server_name *.clawcloud.com;

    ssl_certificate     /etc/letsencrypt/live/clawcloud.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clawcloud.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:$backend_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### The Customer Map File

```nginx
# File: /etc/nginx/customer_map.conf
# AUTO-GENERATED by our backend API — never edit manually
c-sarah.clawcloud.com   19001;
c-bob.clawcloud.com     19002;
c-jane.clawcloud.com    19003;
```

Every time a new customer signs up, our backend:
1. Adds a line to this file
2. Runs `nginx -s reload` (applies changes without downtime)

---

## 5. Reverse Proxy — How Nginx Routes Traffic

### What is a Reverse Proxy?

A reverse proxy sits **in front** of your actual servers and forwards requests to them. The client never talks to the real server directly.

### Forward Proxy vs Reverse Proxy

```
FORWARD PROXY (like a VPN):
  You → Proxy → Internet
  Purpose: Hide YOUR identity from websites

REVERSE PROXY (what we use):
  Internet → Nginx → Your containers
  Purpose: Hide your CONTAINERS from the internet
  The user has no idea which container they're talking to
```

### Why We Need a Reverse Proxy

```
WITHOUT reverse proxy:
  User must go to: http://your-server-ip:19001
  Problems:
    - Ugly URL (who wants to type an IP and port?)
    - No SSL (insecure, browsers show warnings)
    - Exposes container ports to the internet (security risk)
    - Can't use domain names

WITH reverse proxy (Nginx):
  User goes to: https://c-sarah.clawcloud.com
  Benefits:
    - Beautiful URL with your brand
    - SSL encrypted (padlock icon in browser)
    - Container ports hidden behind Nginx
    - Domain-based routing
```

### How a Request Flows Through the Reverse Proxy

```
Step 1:  User types https://c-sarah.clawcloud.com in browser
Step 2:  DNS resolves to your server's IP (e.g., 65.108.100.50)
Step 3:  Browser connects to port 443 (HTTPS) on that IP
Step 4:  Nginx receives the connection
Step 5:  Nginx reads the Host header: "c-sarah.clawcloud.com"
Step 6:  Nginx looks up customer_map.conf → finds port 19001
Step 7:  Nginx forwards the request to localhost:19001
Step 8:  OpenClaw container on port 19001 processes the request
Step 9:  Container sends response back to Nginx
Step 10: Nginx sends response back to user's browser

The user NEVER knows they're talking to port 19001.
They just see "https://c-sarah.clawcloud.com" — clean and secure.
```

---

## 6. DNS — How Domains Work

### What is DNS?

DNS (Domain Name System) is the **phone book of the internet**. It converts human-readable names into IP addresses that computers understand.

### How DNS Works

```
You type: google.com
Your computer asks DNS: "What's the IP for google.com?"
DNS replies: "142.250.80.46"
Your computer connects to 142.250.80.46

Without DNS, you'd have to memorize:
  142.250.80.46 instead of google.com
  65.108.100.50 instead of clawcloud.com
```

### DNS Records We Need

```
TYPE    NAME                    VALUE                   PURPOSE
─────   ─────────────────────   ─────────────────────   ────────────────────
A       clawcloud.com           65.108.100.50           Main website
A       app.clawcloud.com       65.108.100.50           React dashboard
A       api.clawcloud.com       65.108.100.50           Backend API
A       *.clawcloud.com         65.108.100.50           ALL subdomains
```

### Wildcard DNS — The Magic

```
Normal DNS:
  You must create a SEPARATE record for EACH subdomain:
    c-sarah.clawcloud.com → 65.108.100.50   (manual)
    c-bob.clawcloud.com   → 65.108.100.50   (manual)
    ... 100 more records? No way!

Wildcard DNS (what we use):
  ONE record covers ALL subdomains:
    *.clawcloud.com → 65.108.100.50

  Now ANY subdomain automatically points to our server:
    c-sarah.clawcloud.com  ✅ (works automatically)
    c-bob.clawcloud.com    ✅ (works automatically)
    c-anything.clawcloud.com ✅ (works automatically)
```

### Cloudflare — Our DNS Manager

```
Why Cloudflare (not just any DNS provider)?
  1. FREE plan is enough
  2. Built-in DDoS protection
  3. API access (needed for automatic SSL certificate generation)
  4. Fast DNS propagation (changes apply in seconds, not hours)
  5. Proxying option (hides your server's real IP)
```

---

## 7. Wildcard SSL — One Certificate, Infinite Subdomains

### What is SSL/TLS?

SSL encrypts the connection between a user's browser and your server.

```
WITHOUT SSL (http://):
  User sends password: "mypassword123"
  Anyone on the network can see: "mypassword123"  ← DANGEROUS
  Browser shows: "Not Secure" warning

WITH SSL (https://):
  User sends password: "mypassword123"
  On the network it looks like: "x7$kL9#mQ2..."  ← Encrypted
  Browser shows: 🔒 padlock icon
```

### The Problem with Normal SSL Certificates

```
Normal SSL = covers ONE domain.

100 customers = 100 certificates needed.
Let's Encrypt limit: ~50 per week.
Day 1: Create 50 ✅
Day 2: Need 10 more → "RATE LIMITED, wait a week" ❌
```

### Wildcard SSL — The Solution

```
ONE wildcard certificate covers ALL subdomains:

  *.clawcloud.com = covers:
    c-sarah.clawcloud.com    ✅
    c-bob.clawcloud.com      ✅
    c-customer-999.clawcloud.com ✅

  Cost: FREE (Let's Encrypt)
  Renewal: Automatic (every 90 days)
```

### How to Get a Wildcard Certificate

```
Step 1: Certbot asks Let's Encrypt: "Give me a cert for *.clawcloud.com"
Step 2: Let's Encrypt says: "Prove you own clawcloud.com.
         Add this TXT record: _acme-challenge.clawcloud.com = abc123xyz"
Step 3: Certbot uses Cloudflare API to add the TXT record automatically
Step 4: Let's Encrypt checks DNS → finds the record → "Verified!"
Step 5: Certificate issued → saved to /etc/letsencrypt/live/clawcloud.com/
Step 6: Nginx uses this certificate for ALL subdomains
```

---

## 8. WebSockets — Real-Time Communication

### What is a WebSocket?

Normal HTTP is like **sending letters** — send request, wait, get response, done.
WebSocket is like a **phone call** — connection stays open, both sides talk anytime.

### HTTP vs WebSocket

```
HTTP (request-response):
  Browser: "Any new messages?"     → Server: "No."
  [5 seconds later]
  Browser: "Any new messages?"     → Server: "No."
  [5 seconds later]
  Browser: "Any new messages?"     → Server: "Yes! Here's one."
  Problem: Wastes bandwidth asking over and over

WebSocket (persistent connection):
  Browser: "Let's open a phone line."  → Server: "OK, connected."
  [Connection stays open]
  [30 seconds later]
  Server: "New message just arrived!"  → Browser: "Got it!"
  Benefit: Server pushes data INSTANTLY when it happens
```

### Where We Use WebSockets in ClawCloud

```
USE CASE 1: WhatsApp QR Code
  Dashboard shows QR code that updates in real-time.
  QR changes every few seconds until user scans it.

  React Frontend ←── WS ──→ Backend ←── WS ──→ OpenClaw Container
       (shows QR)            (relays)            (generates QR)

USE CASE 2: Live Agent Status
  Dashboard shows if bot is connected, processing, etc.

USE CASE 3: Real-Time Logs
  User watches their AI agent's activity live.
```

### WebSocket Code Example

```javascript
// FRONTEND: connecting to our backend for QR code
const ws = new WebSocket('wss://api.clawcloud.com/ws/whatsapp/emp_123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'qr') {
    setQrCode(data.qrData);        // Display QR on page
  }
  if (data.type === 'connected') {
    setStatus('Connected ✅');       // WhatsApp connected!
  }
};

// BACKEND: relaying from container to frontend
wss.on('connection', (clientWs, req) => {
  const employeeId = req.url.split('/').pop();
  const containerPort = await getPortForEmployee(employeeId);

  // Connect to the OpenClaw container
  const containerWs = new WebSocket(`ws://localhost:${containerPort}`);

  // Relay: container → frontend
  containerWs.on('message', (data) => clientWs.send(data));

  // Relay: frontend → container
  clientWs.on('message', (data) => containerWs.send(data));
});
```

---

## 9. REST API — How Frontend Talks to Backend

### What is a REST API?

REST API is a set of **URLs (endpoints)** your frontend calls to do things on the backend. Each URL does one specific thing.

### Real-World Analogy

```
REST API = A restaurant menu

The MENU (API) has items (endpoints):
  GET  /api/employees        → "Show me all my AI employees"
  POST /api/employees        → "Create a new AI employee"
  PUT  /api/employees/123    → "Update employee #123"
  DELETE /api/employees/123  → "Delete employee #123"

The WAITER (HTTP) takes your ORDER (request) to the KITCHEN (backend).
The KITCHEN processes it and sends back your FOOD (response).

You don't go into the kitchen yourself (that's the backend).
You just read the menu and place an order (that's the frontend).
```

### HTTP Methods Explained

```
GET    = READ data      (looking at a menu)
POST   = CREATE data    (placing a new order)
PUT    = UPDATE data    (changing your order)
DELETE = DELETE data    (canceling your order)

Examples:
  GET    /api/employees         → List all my employees
  POST   /api/employees         → Create new employee
  PUT    /api/employees/emp_123 → Update employee's settings
  DELETE /api/employees/emp_123 → Delete employee
  POST   /api/auth/signup       → Register new account
  POST   /api/auth/login        → Login and get token
```

### API Request/Response Example

```javascript
// FRONTEND: Create a new AI employee
const response = await fetch('https://api.clawcloud.com/api/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGc...'   // JWT token (proves who you are)
  },
  body: JSON.stringify({
    name: 'Assistant Amy',
    role: 'general',
    systemPrompt: 'You are a helpful AI assistant.'
  })
});

const data = await response.json();
// Response:
// {
//   "id": "emp_abc123",
//   "name": "Assistant Amy",
//   "status": "provisioning",
//   "createdAt": "2026-02-07T10:30:00Z"
// }
```

### Status Codes — What the Numbers Mean

```
200 OK          → Success! Here's your data.
201 Created     → Success! New thing created.
400 Bad Request → You sent invalid data (missing field, wrong format).
401 Unauthorized→ You're not logged in (no token or expired token).
403 Forbidden   → You're logged in but don't have permission.
404 Not Found   → That thing doesn't exist.
409 Conflict    → Already exists (e.g., duplicate email on signup).
500 Server Error→ Something broke on our end (bug in our code).
```

---

## 10. JWT Authentication — Who Are You?

### What is JWT?

JWT (JSON Web Token) is a **signed token** that proves who you are. After logging in, the server gives you a token. You send this token with every request.

### Real-World Analogy

```
JWT = A wristband at a concert

Step 1: Show your TICKET (email + password) at the entrance
Step 2: Security gives you a WRISTBAND (JWT token)
Step 3: For the rest of the night, flash your wristband
        to access VIP areas, buy drinks, etc.
Step 4: You don't show your ticket again
Step 5: Wristband EXPIRES at the end of the night (token expires)
```

### How JWT Works in Our App

```
1. User logs in:
   POST /api/auth/login
   Body: { email: "sarah@gmail.com", password: "mypassword" }

2. Server verifies credentials → creates JWT:
   Token: "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQ..."

3. Frontend stores the token (localStorage or cookie)

4. Every subsequent request includes the token:
   GET /api/employees
   Headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9..." }

5. Server reads token → knows it's Sarah → returns ONLY Sarah's data
```

### What's Inside a JWT?

```
A JWT has 3 parts separated by dots:  header.payload.signature

HEADER: { "alg": "HS256", "typ": "JWT" }
  → "This token uses HMAC-SHA256 encryption"

PAYLOAD: {
  "userId": "user_sarah_123",
  "email": "sarah@gmail.com",
  "plan": "basic",
  "iat": 1706123456,           ← issued at timestamp
  "exp": 1706728256            ← expires in 7 days
}
  → The actual data about the user

SIGNATURE: HMAC-SHA256(header + payload, SECRET_KEY)
  → Proves the token hasn't been tampered with
  → Only our server knows the SECRET_KEY
  → If someone changes the payload, signature won't match → REJECTED
```

### JWT Code Example

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// LOGIN: verify password and create JWT
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Wrong password' });

  const token = jwt.sign(
    { userId: user.rows[0].id, email: user.rows[0].email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.rows[0].id, email } });
});

// MIDDLEWARE: protect routes — verify JWT on every request
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // Now req.user.userId is available
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// PROTECTED ROUTE: only returns THIS user's employees
app.get('/api/employees', authMiddleware, async (req, res) => {
  const employees = await db.query(
    'SELECT * FROM employees WHERE user_id = $1', [req.user.userId]
  );
  res.json(employees.rows);
});
```

---

## 11. PostgreSQL — The Database

### What is PostgreSQL?

PostgreSQL (often called "Postgres") is a **relational database** — it stores data in tables with rows and columns, like a spreadsheet but much more powerful.

### Real-World Analogy

```
PostgreSQL = A filing cabinet with labeled drawers

Drawer 1: "USERS" folder
  - Sarah's file: { email, password, plan, created_at }
  - Bob's file: { email, password, plan, created_at }

Drawer 2: "EMPLOYEES" folder
  - Assistant Amy: { user_id: sarah, port: 19001, status: running }
  - Dev Dan: { user_id: bob, port: 19002, status: running }

Drawer 3: "SKILLS" folder
  - Coding skill installed for Sarah's employee
  - Weather skill installed for Bob's employee
```

### Our Database Tables

```sql
-- USERS: account info
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  plan            TEXT DEFAULT 'basic',
  api_key_encrypted TEXT,            -- OpenAI/Anthropic key (encrypted!)
  stripe_customer_id TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- EMPLOYEES: each AI employee = one Docker container
CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  port            INTEGER UNIQUE NOT NULL,
  subdomain       TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'provisioning',
  container_id    TEXT,
  system_prompt   TEXT,
  whatsapp_connected BOOLEAN DEFAULT false,
  telegram_connected BOOLEAN DEFAULT false,
  telegram_token_encrypted TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- SKILLS: which skills installed where
CREATE TABLE employee_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  skill_name      TEXT NOT NULL,
  installed_at    TIMESTAMP DEFAULT NOW()
);
```

### SQL Examples — What the Backend Does

```sql
-- When Sarah signs up:
INSERT INTO users (email, password_hash, plan)
VALUES ('sarah@gmail.com', '$2b$10$hash...', 'basic');

-- When Sarah creates an AI employee (next available port):
INSERT INTO employees (user_id, name, port, subdomain)
VALUES ('sarah-uuid', 'Assistant Amy',
  (SELECT COALESCE(MAX(port), 19000) + 1 FROM employees),
  'c-sarah-amy');

-- List Sarah's employees:
SELECT * FROM employees WHERE user_id = 'sarah-uuid';

-- Update WhatsApp status:
UPDATE employees SET whatsapp_connected = true WHERE id = 'emp-uuid';

-- Delete employee (ON DELETE CASCADE removes skills too):
DELETE FROM employees WHERE id = 'emp-uuid' AND user_id = 'sarah-uuid';
```

---

## 12. Supabase — PostgreSQL Made Easy

### What is Supabase?

Supabase is a **hosted PostgreSQL database** with extra features. Instead of installing PostgreSQL yourself, Supabase gives you a ready-to-use database with:

- **Dashboard** — Visual interface to view/edit tables
- **Auth** — Built-in signup, login, OAuth (Google, GitHub, etc.)
- **REST API** — Auto-generated API for your tables
- **Realtime** — Live updates when data changes
- **Storage** — File uploads
- **Edge Functions** — Serverless code

### Real-World Analogy

```
PostgreSQL on your own server:
  You buy a car, insure it, maintain it, fix it when it breaks.
  Full control, but lots of work.

Supabase:
  You use Uber. Someone else owns and maintains the car.
  You just tell it where to go.
  Less control, but way less hassle.
```

### Supabase Auth — Built-In User Management

Instead of writing signup/login code ourselves, Supabase handles it:

```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (safe for frontend — anon key is public)
const supabase = createClient(
  'https://vrxhqpnzhilpnllfevcj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

// SIGN UP a new user
const { data, error } = await supabase.auth.signUp({
  email: 'sarah@gmail.com',
  password: 'mypassword123'
});
// Supabase creates user, sends verification email, returns session

// LOG IN
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'sarah@gmail.com',
  password: 'mypassword123'
});
// data.session.access_token = JWT (auto-managed!)

// GET CURRENT USER
const { data: { user } } = await supabase.auth.getUser();
// { id: 'uuid', email: 'sarah@gmail.com', ... }

// LOG OUT
await supabase.auth.signOut();
```

### Supabase Database Queries (from Frontend)

```javascript
// READ: Get all employees for current user
const { data, error } = await supabase
  .from('employees')
  .select('*')
  .eq('user_id', user.id);

// CREATE: Insert new employee
const { data, error } = await supabase
  .from('employees')
  .insert({ user_id: user.id, name: 'Assistant Amy', port: 19001 })
  .select();

// UPDATE: Mark WhatsApp as connected
const { data, error } = await supabase
  .from('employees')
  .update({ whatsapp_connected: true })
  .eq('id', 'emp-uuid');

// DELETE: Remove employee
const { data, error } = await supabase
  .from('employees')
  .delete()
  .eq('id', 'emp-uuid');
```

### Row-Level Security (RLS) — Each User Sees ONLY Their Own Data

```sql
-- Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: users can only SELECT their own employees
CREATE POLICY "Users see own employees"
  ON employees FOR SELECT
  USING (user_id = auth.uid());

-- Policy: users can only INSERT their own employees
CREATE POLICY "Users create own employees"
  ON employees FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: users can only DELETE their own employees
CREATE POLICY "Users delete own employees"
  ON employees FOR DELETE
  USING (user_id = auth.uid());

-- Now even if frontend code has a bug:
--   Sarah queries employees → sees ONLY hers
--   Bob queries employees → sees ONLY his
--   The DATABASE enforces this, not our code
```

---

## 13. OpenClaw — The AI Brain Inside Each Container

### What is OpenClaw?

OpenClaw is the **open-source AI assistant software** running inside each Docker container. It:
- Connects to WhatsApp / Telegram
- Receives messages
- Sends them to an LLM (ChatGPT / Claude)
- Gets AI response
- Sends response back to user

### How OpenClaw Works Inside a Container

```
┌──────────────── Docker Container ──────────────────┐
│                                                     │
│  ┌─────────────┐                                   │
│  │  OpenClaw    │                                   │
│  │  Gateway     │  ← Main process, port 18789      │
│  │  (Node.js)   │                                   │
│  └──────┬───────┘                                   │
│         │                                           │
│    ┌────┴────────────────────────┐                  │
│    │                              │                  │
│    ▼                              ▼                  │
│  ┌──────────────┐         ┌──────────────┐          │
│  │  Channels    │         │  Skills      │          │
│  │  - WhatsApp  │         │  - Coding    │          │
│  │    (Baileys) │         │  - Calendar  │          │
│  │  - Telegram  │         │  - Email     │          │
│  │    (grammY)  │         │  - Browser   │          │
│  └──────────────┘         └──────────────┘          │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────┐                           │
│  │  LLM Provider        │                           │
│  │  (API call)          │                           │
│  │  OpenAI / Anthropic  │ ← Customer's OWN API key │
│  └──────────────────────┘                           │
│                                                     │
│  Config: /root/.openclaw/openclaw.json              │
│  Skills: /root/.openclaw/workspace/skills/          │
└─────────────────────────────────────────────────────┘
```

### The openclaw.json Config File

```json
{
  "gateway": {
    "port": 18789,
    "auth": { "token": "abc123-gateway-token" }
  },
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "sk-proj-sarah-key-here"
  },
  "channels": {
    "whatsapp": { "enabled": true },
    "telegram": {
      "enabled": true,
      "botToken": "12345:ABC-DEF-telegram-token"
    }
  },
  "agents": [
    {
      "name": "Assistant Amy",
      "systemPrompt": "You are a helpful personal assistant..."
    }
  ]
}
```

### How Our Backend Controls OpenClaw Containers

Our backend talks to containers via their **Gateway WebSocket API**:

```javascript
// Backend connects to Sarah's container
const ws = new WebSocket('ws://localhost:19001');

// Authenticate with gateway token
ws.send(JSON.stringify({ type: 'auth', token: 'abc123-gateway-token' }));

// Request WhatsApp QR code
ws.send(JSON.stringify({
  type: 'channel-action', channel: 'whatsapp', action: 'login'
}));

// Receive QR code data → relay to frontend
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'qr') {
    frontendWs.send(JSON.stringify({ type: 'qr', data: msg.qrData }));
  }
});
```

**KEY POINT: Users NEVER see OpenClaw's UI. Our backend is the middleman.**

---

## 14. WhatsApp Integration (Baileys) — How QR Pairing Works

### What is Baileys?

Baileys is an **open-source JavaScript library** that reverse-engineers the WhatsApp Web protocol. It lets you connect to WhatsApp WITHOUT the official Business API (which costs money).

### How WhatsApp Web Works (Normal Use)

```
When you use WhatsApp Web on your computer:
  1. You open web.whatsapp.com
  2. A QR code appears
  3. You scan the QR code with your phone
  4. WhatsApp says: "Authorize this device"
  5. Messages now flow to BOTH phone AND computer
  6. The computer can send/receive messages

Baileys does the SAME thing, but programmatically:
  1. Baileys generates a QR code (like WhatsApp Web does)
  2. User scans it with their phone
  3. Baileys receives authorization
  4. Now Baileys can send/receive messages via code
  5. Runs 24/7 inside the Docker container
```

### The QR Code Flow in Our App

```
User clicks "Connect WhatsApp" on OUR dashboard
        │
        ▼
  OUR REACT FRONTEND (app.clawcloud.com)
  Opens WebSocket to our backend
        │
        ▼
  OUR BACKEND API
  1. Looks up Sarah's container port (19001)
  2. Connects to ws://localhost:19001
  3. Sends "start WhatsApp pairing" command
        │
        ▼
  OPENCLAW CONTAINER (claw-sarah)
  Baileys library:
  1. Contacts WhatsApp servers
  2. Generates QR code data
  3. Sends QR data back via WebSocket
        │
        ▼ (QR relayed back through chain)
  OUR REACT FRONTEND
  Renders QR using qrcode.react library
  ┌────────────┐
  │ ██ ▄▄ ██   │  ← User scans this with their phone
  │ ██ ▀▀ ██   │
  └────────────┘
  After scan: "WhatsApp Connected ✅"
```

### Important WhatsApp Facts

```
- QR code expires after ~60 seconds → must keep regenerating
- Session survives container restarts (stored in volume)
- Max 4 linked devices per WhatsApp account
- Not official API → WhatsApp COULD block it (small risk)
- User's personal number → NOT a business account
- Messages are end-to-end encrypted by WhatsApp
```

---

## 15. Telegram Integration (grammY) — How Bot Tokens Work

### What is grammY?

grammY is a JavaScript library for building **Telegram bots** using the OFFICIAL Telegram Bot API.

### Telegram vs WhatsApp — Key Difference

```
WhatsApp:
  - Reverse-engineered protocol (Baileys) — unofficial
  - Connects as "linked device" on user's personal number
  - QR code pairing (visual)
  - Risk: WhatsApp could block it

Telegram:
  - OFFICIAL Bot API — fully supported by Telegram
  - User creates a separate BOT account via @BotFather
  - Bot token authentication (just a text string)
  - No risk of being blocked
```

### How Telegram Bot Creation Works

```
User does this on their phone (takes 2 minutes):

  1. Open Telegram → search @BotFather
  2. Send: /newbot
  3. BotFather: "What name for your bot?"
  4. User: "Sarah's AI Assistant"
  5. BotFather: "Choose a username (must end in 'bot')"
  6. User: "SarahAIAssistantBot"
  7. BotFather: "Done! Your token is: 7123456789:AAH3k5Lz1PxR9mN..."

Then on OUR dashboard:

  1. Go to app.clawcloud.com/connect/telegram
  2. Paste token: "7123456789:AAH3k5Lz1PxR9mN..."
  3. Click "Connect"

Our backend:

  1. Encrypts the token → stores in DB
  2. Writes to container config
  3. Restarts container
  4. Container connects to Telegram via grammY
  5. Now @SarahAIAssistantBot responds with AI
```

### How Telegram Messages Flow

```
Someone sends "Hello" to @SarahAIAssistantBot
        │
        ▼
Telegram Servers receive message
        │
        ▼
Telegram delivers to our container via polling or webhook
        │
        ▼
grammY library inside container receives message
        │
        ▼
OpenClaw processes: message → LLM → response
        │
        ▼
grammY sends response back via Telegram API
        │
        ▼
User sees AI response in Telegram chat
```

---

## 16. Stripe — Payment Processing

### What is Stripe?

Stripe handles **credit card payments, subscriptions, and billing**. We never touch credit card numbers ourselves (that requires expensive security compliance called PCI-DSS).

### Real-World Analogy

```
WITHOUT Stripe:
  You handle cash yourself.
  Need a cash register, safe, security guards, insurance...

WITH Stripe:
  Customers pay through a card terminal (Stripe's checkout page).
  Stripe deposits money to your bank.
  You focus on selling, not counting bills.
  Fee: 2.9% + $0.30 per transaction.
```

### How Stripe Subscriptions Work

```
Step 1: Create Products in Stripe Dashboard
  Product: "ClawCloud Basic Plan"
  Price: $20/month (recurring)
  Stripe gives you: price_1ABC... (Price ID)

Step 2: User Clicks "Subscribe" on Our Website
  Our frontend asks our backend to create a "Checkout Session"
  User is redirected to Stripe's hosted payment page
  We NEVER see their credit card number

Step 3: User Pays on Stripe's Page
  Stripe processes payment
  Creates a Subscription (charges monthly)

Step 4: Stripe Notifies Us via Webhook
  POST https://api.clawcloud.com/api/billing/webhook
  "Hey, checkout completed for user Sarah!"

Step 5: Our Backend Provisions the Container
  Creates Docker container → assigns subdomain → employee is live

Step 6: Every Month (automatic)
  Stripe charges customer's card
  If payment fails → Stripe sends "payment_failed" webhook
  We pause/warn the customer
```

### Stripe Code Example

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create Stripe Checkout Session
app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
  const { planId } = req.body;

  const priceMap = {
    basic: process.env.STRIPE_PRICE_BASIC,       // price_1ABC...
    pro: process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS
  };

  const session = await stripe.checkout.sessions.create({
    customer_email: req.user.email,
    mode: 'subscription',
    line_items: [{ price: priceMap[planId], quantity: 1 }],
    success_url: 'https://app.clawcloud.com/dashboard?payment=success',
    cancel_url: 'https://app.clawcloud.com/billing?cancelled=true',
    metadata: { userId: req.user.userId, plan: planId }
  });

  res.json({ url: session.url });
  // Frontend redirects user to session.url → Stripe payment page
});

// Handle Stripe Webhook (Stripe calls this after payment)
app.post('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId;
      // Payment succeeded → provision container!
      await provisionEmployee(userId);
    }

    if (event.type === 'invoice.payment_failed') {
      // Monthly payment failed → warn user or pause container
      const customerId = event.data.object.customer;
      await pauseUserContainers(customerId);
    }

    res.json({ received: true });
  }
);
```

---

## 17. Webhooks — Events Calling Your Server

### What is a Webhook?

A webhook is when **another service calls YOUR server** to tell you something happened. Instead of constantly asking "anything new?", they TELL you.

### Analogy: Polling vs Webhooks

```
POLLING (without webhooks):
  You call pizza shop every 2 minutes:
  "Is my pizza ready?" → "No."
  "Is my pizza ready?" → "No."
  "Is my pizza ready?" → "Yes!"
  Problem: 3 wasted calls

WEBHOOK:
  Give pizza shop your phone number.
  They CALL YOU when ready.
  "Hey, your pizza is ready!"
  Efficient: 1 call, exactly when needed.
```

### Webhooks We Use

```
STRIPE WEBHOOKS (payment events):
  Stripe → POST https://api.clawcloud.com/api/billing/webhook
  Events:
    checkout.session.completed   → "User paid! Provision container"
    invoice.payment_failed       → "Payment failed! Warn user"
    customer.subscription.deleted → "Cancelled! Tear down container"

TELEGRAM WEBHOOKS (optional — message delivery):
  Telegram → POST to container URL
  Events:
    New message → container processes with AI

WEBHOOK SECURITY:
  How do we know it's REALLY Stripe calling (not a hacker)?
  → Stripe signs every webhook with a secret key
  → We verify the signature before processing
  → stripe.webhooks.constructEvent(body, signature, secret)
```

---

## 18. Multi-Tenancy — One Server, Many Customers

### What is Multi-Tenancy?

Multi-tenancy means **one system serves multiple customers** (tenants), each isolated from each other.

### Types of Multi-Tenancy

```
TYPE 1: Shared Everything (like Gmail)
  One app, one database. All users share everything.
  Isolation: Each row tagged with user_id
  Cost: Cheapest | Isolation: Weakest

TYPE 2: Shared App, Separate Database (like Slack)
  One app, each customer has their own database.
  Cost: Medium | Isolation: Good

TYPE 3: Separate Everything (WHAT WE DO)
  Each customer gets their own Docker container.
  Cost: Most expensive per tenant | Isolation: Strongest

  WHY TYPE 3 for ClawCloud?
  - OpenClaw REQUIRES its own process per customer
  - WhatsApp sessions can't be shared across users
  - Each customer has different API keys
  - If Sarah's bot crashes, Bob's is unaffected
  - Security: complete filesystem isolation
```

### Resource Limits — Preventing One User from Hogging Everything

```
Without limits:
  One customer's bot goes crazy → uses all CPU and RAM
  Every other customer's bot slows down or crashes

With limits (in docker-compose.yml):
  deploy:
    resources:
      limits:
        cpus: '0.5'     ← Max half a CPU core
        memory: 512M     ← Max 512 MB RAM

Server: 4 CPU cores, 16 GB RAM
  Theoretical: ~8 containers at full 0.5 CPU each
  Reality:     ~30-50 containers (most idle most of the time)
  Why? A bot only uses CPU when processing a message (~3 sec)
       Rest of the time it's idle (0% CPU)
```

---

## 19. Port Mapping — How Containers Get Their Own Address

### The Problem

Every OpenClaw container listens on port **18789** internally. But you can't have 100 things on the same port.

### The Solution: Port Mapping

```
INSIDE container:  OpenClaw always runs on port 18789 (same for all)
OUTSIDE container: Each gets a UNIQUE external port

Container 1 (Sarah): Port 19001 → maps to → 18789 inside
Container 2 (Bob):   Port 19002 → maps to → 18789 inside
Container 3 (Jane):  Port 19003 → maps to → 18789 inside

Analogy — apartments:
  Apt 101 (Sarah): Door number is 101, but room layout inside is identical
  Apt 102 (Bob):   Door number is 102, same layout inside
  Apt 103 (Jane):  Door number is 103, same layout inside
  Each door leads to the same type of room, but different contents
```

### How Ports Are Assigned (Atomic — No Duplicates)

```sql
-- Database guarantees unique ports, even under concurrent requests:
INSERT INTO employees (user_id, name, port, subdomain)
VALUES ('sarah-uuid', 'Assistant Amy',
  (SELECT COALESCE(MAX(port), 19000) + 1 FROM employees),
  'c-sarah-amy');

-- First employee:  MAX(port) is NULL → COALESCE returns 19000 → +1 = 19001
-- Second employee: MAX(port) is 19001 → +1 = 19002
-- Third employee:  MAX(port) is 19002 → +1 = 19003

-- "ATOMIC" means: even if 2 requests arrive at the EXACT same millisecond,
-- the database ensures they get DIFFERENT ports. No race conditions.
```

### How Ports Connect to Subdomains

```
PORT ASSIGNMENT:            NGINX MAP:                      USER SEES:
employees table             customer_map.conf               browser URL
─────────────               ─────────────────               ──────────────
port: 19001                 c-sarah.clawcloud.com 19001;    https://c-sarah.clawcloud.com
port: 19002                 c-bob.clawcloud.com   19002;    https://c-bob.clawcloud.com
port: 19003                 c-jane.clawcloud.com  19003;    https://c-jane.clawcloud.com

Chain: User → DNS → Nginx → reads subdomain → looks up port → forwards to container
```

---

## 20. Environment Variables — Secret Configuration

### What Are Environment Variables?

Environment variables are **key-value pairs** set OUTSIDE your code that your code reads at runtime. They keep secrets OUT of your source code.

### Why Not Just Put Secrets in Code?

```
BAD (hardcoded):
  const stripe = require('stripe')('sk_live_abc123xyz');
  // If you push to GitHub, EVERYONE sees your Stripe key
  // Hackers scan GitHub for exactly this

GOOD (environment variable):
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // Actual value is in a .env file that's NOT in Git
```

### .env File Example

```env
# This file lives on the server, NOT in Git
# Add ".env" to your .gitignore file!

NODE_ENV=production
PORT=3000
DOMAIN=clawcloud.com
DB_HOST=localhost
DB_PASSWORD=super-secret-password
JWT_SECRET=a1b2c3d4e5f6...64-char-random-string
STRIPE_SECRET_KEY=sk_live_abcdefgh
STRIPE_WEBHOOK_SECRET=whsec_abcdefgh
TOKEN_ENCRYPTION_KEY=6f8a2b3c4d5e...32-byte-hex
```

### How Code Reads Them

```javascript
require('dotenv').config();  // Load .env file (top of your app)

const port = process.env.PORT;              // "3000"
const dbPassword = process.env.DB_PASSWORD; // "super-secret-password"
const jwtSecret = process.env.JWT_SECRET;   // "a1b2c3d4e5..."
```

---

## 21. Encryption — Protecting Sensitive Data

### Why Encrypt?

We store sensitive data like API keys and Telegram tokens. If someone hacks our database, they could steal everything.

### Encryption = Locking Data in a Safe

```
WITHOUT encryption:
  Database stores: "sk-proj-sarah-real-openai-key"
  Hacker reads database → instantly has the key → charges $$$

WITH encryption:
  Database stores: "a3f2b1c4:9c0d1e2f3a4b5c..."
  Hacker reads database → sees meaningless characters
  Can't decrypt without our encryption key (stored separately in .env)
```

### AES-256 Encryption Code

```javascript
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // 32 bytes hex
const ALGORITHM = 'aes-256-cbc';

// ENCRYPT: readable text → encrypted gibberish
function encrypt(text) {
  const iv = crypto.randomBytes(16);  // Random "salt" (makes each encryption unique)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// DECRYPT: encrypted gibberish → readable text
function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// USAGE:
const apiKey = 'sk-proj-sarah-real-key';
const encrypted = encrypt(apiKey);
// → "a3f2b1c4d5e6f7a8:9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f"
const decrypted = decrypt(encrypted);
// → "sk-proj-sarah-real-key"  (back to original)
```

---

## 22. React + Vite — The Frontend

### What is React?

React is a **JavaScript library** for building user interfaces. You break your UI into **components** (reusable pieces) and React efficiently updates only what changes.

### What is Vite?

Vite is a **build tool** that makes React development fast. It replaces the older Create React App.

```
Vite advantages:
  - Dev server starts in < 1 second (CRA takes 10-30 seconds)
  - Changes appear instantly in browser (Hot Module Replacement)
  - Fast production builds
  - Modern defaults (TypeScript, CSS modules)
```

### Our Frontend Stack

```
React 18+       → UI library (components, state, hooks)
TypeScript      → Type safety (catches bugs before runtime)
Vite            → Build tool (fast dev server)
TailwindCSS     → Styling ("bg-blue-500 p-4 rounded-lg")
shadcn/ui       → Pre-built components (buttons, forms, dialogs, tables)
Lucide React    → Icons
React Router    → Page navigation (/dashboard, /settings, etc.)
TanStack Query  → Server state management (auto-caching, refetching)
Zustand         → Client state (logged-in user, theme)
Stripe.js       → Payment UI integration
qrcode.react    → QR code rendering for WhatsApp pairing
```

### React Component Example — Employee Card

```tsx
// File: src/components/EmployeeCard.tsx

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wifi, MessageSquare, Bot } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'provisioning';
  whatsapp_connected: boolean;
  telegram_connected: boolean;
}

export function EmployeeCard({ employee }: { employee: Employee }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-orange-500" />
          <div>
            <h3 className="text-lg font-semibold">{employee.name}</h3>
            <Badge variant={employee.status === 'running' ? 'default' : 'destructive'}>
              {employee.status}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          {employee.whatsapp_connected && (
            <Badge variant="outline" className="text-green-600">
              <Wifi className="h-3 w-3 mr-1" /> WhatsApp
            </Badge>
          )}
          {employee.telegram_connected && (
            <Badge variant="outline" className="text-blue-600">
              <MessageSquare className="h-3 w-3 mr-1" /> Telegram
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm">Settings</Button>
        <Button variant="outline" size="sm">View Logs</Button>
        <Button variant="destructive" size="sm">Delete</Button>
      </div>
    </Card>
  );
}
```

### Project Structure

```
frontend/
  ├── src/
  │   ├── components/          # Reusable UI components
  │   │   ├── ui/              # shadcn/ui components (Button, Card, etc.)
  │   │   ├── EmployeeCard.tsx
  │   │   ├── QrCodeDisplay.tsx
  │   │   └── Navbar.tsx
  │   ├── pages/               # Full pages (one per route)
  │   │   ├── Landing.tsx      # Marketing page (/)
  │   │   ├── Login.tsx        # Login form (/login)
  │   │   ├── Signup.tsx       # Signup form (/signup)
  │   │   ├── Dashboard.tsx    # Main dashboard (/dashboard)
  │   │   ├── Employees.tsx    # AI employees list (/employees)
  │   │   ├── ConnectWhatsApp.tsx  # QR code page
  │   │   ├── ConnectTelegram.tsx  # Token input page
  │   │   ├── Marketplace.tsx  # Skill marketplace (/marketplace)
  │   │   ├── Billing.tsx      # Subscription management
  │   │   └── Settings.tsx     # API key, profile (/settings)
  │   ├── lib/
  │   │   ├── supabase.ts      # Supabase client init
  │   │   └── api.ts           # API helper functions
  │   ├── hooks/               # Custom React hooks
  │   ├── App.tsx              # Router + layout
  │   └── main.tsx             # Entry point
  ├── package.json
  ├── tailwind.config.js
  ├── tsconfig.json
  └── vite.config.ts
```

---

## 23. The Complete Request Journey — End to End

### Journey 1: Sarah Signs Up and Creates Her First AI Employee

```
STEP 1: Sarah visits clawcloud.com
  Browser → DNS (Cloudflare) → resolves to 65.108.100.50
  Browser → Nginx (port 443) → serves React static files
  Sarah sees the landing page

STEP 2: Sarah clicks "Get Started" → redirected to /signup
  React Router renders Signup page
  Sarah types email + password → clicks "Sign Up"
  Frontend calls: supabase.auth.signUp({ email, password })
  Supabase creates user → sends verification email
  Sarah clicks email link → account verified

STEP 3: Sarah logs in → redirected to /dashboard
  Frontend calls: supabase.auth.signInWithPassword({ email, password })
  Supabase returns JWT token → stored in browser
  Dashboard page loads → shows "No employees yet"

STEP 4: Sarah clicks "Create New Employee"
  Frontend shows form: name, role
  Sarah types "Assistant Amy" → clicks "Create"
  Frontend calls: POST api.clawcloud.com/api/employees
    Headers: { Authorization: "Bearer <jwt>" }
    Body: { name: "Assistant Amy" }

STEP 5: Backend provisions container
  Backend receives request → verifies JWT → knows it's Sarah
  Backend assigns port 19001 (atomic DB query)
  Backend creates /opt/claw-platform/users/sarah/
  Backend writes docker-compose.yml with Sarah's settings
  Backend runs: docker-compose up -d → container starts
  Backend updates Nginx map → reloads Nginx
  Backend updates DB: status = "running"
  Backend returns: { id: "emp_abc", name: "Assistant Amy", status: "running" }

STEP 6: Sarah provides API key
  Dashboard prompts: "Add your AI API key"
  Sarah goes to /settings/api-keys → pastes OpenAI key
  Frontend calls: PUT api.clawcloud.com/api/settings/api-key
  Backend encrypts key → writes to container config → restarts container

STEP 7: Sarah connects WhatsApp
  Sarah clicks "Connect WhatsApp" on dashboard
  Frontend opens WebSocket to: wss://api.clawcloud.com/ws/whatsapp/emp_abc
  Backend connects to container's WebSocket: ws://localhost:19001
  Backend sends "start WhatsApp pairing" command to container
  Container (Baileys) contacts WhatsApp servers → generates QR code
  QR data flows: Container → Backend (WS) → Frontend (WS) → rendered on screen
  Sarah opens WhatsApp → Linked Devices → scans QR code
  WhatsApp authorizes the container as a linked device
  Container confirms connection → Backend updates DB → Frontend shows "Connected ✅"

STEP 8: Sarah uses her AI assistant
  Sarah texts on WhatsApp: "Summarize today's tech news"
  Message path:
    Sarah's phone → WhatsApp servers (Meta)
    → Baileys in container (claw-sarah) receives message
    → OpenClaw processes: creates prompt with system message + user message
    → OpenClaw calls OpenAI API with Sarah's key: sk-proj-...
    → OpenAI returns AI response
    → OpenClaw sends response via Baileys → WhatsApp servers
    → Sarah's phone shows AI response (2-5 seconds total)

  Sarah has NO IDEA about Docker, Nginx, OpenClaw, Baileys, or any of this.
  She just sees a WhatsApp chat with an AI that helps her.
```

### Journey 2: What Happens When Sarah Sends a Message

```
Time: 0ms    Sarah types "Write me a haiku about coding" on WhatsApp
Time: 50ms   Message reaches Meta's WhatsApp servers
Time: 100ms  WhatsApp servers deliver to Baileys in container claw-sarah
Time: 150ms  OpenClaw Gateway receives message via Baileys channel
Time: 200ms  OpenClaw builds prompt:
               System: "You are Assistant Amy, a helpful personal assistant"
               User: "Write me a haiku about coding"
Time: 250ms  OpenClaw sends API request to api.openai.com
               Model: gpt-4o-mini
               API Key: Sarah's own key (decrypted from config)
Time: 2000ms OpenAI returns response:
               "Fingers on the keys
                Logic flows like morning streams
                Bugs become features"
Time: 2050ms OpenClaw sends response via Baileys
Time: 2100ms Baileys delivers to WhatsApp servers
Time: 2200ms Sarah's phone buzzes — she reads the haiku

Total time: ~2.2 seconds
Cost to us: $0.00 (Sarah's API key, Sarah's WhatsApp, our server was idle)
Cost to Sarah: ~$0.001 (OpenAI token usage)
```

---

## 24. Supabase Connection Details

### Your Supabase Project

```
Project URL:      https://vrxhqpnzhilpnllfevcj.supabase.co
Publishable Key:  sb_publishable_lNmIWHivWNy1HKK3Vt8H9w_LlkZjVI9
Anon Key:         eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeGhxcG56aGlscG5sbGZldmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMwODYsImV4cCI6MjA4NjAyOTA4Nn0.9ew2t4lMwHP0gUs25MUJC0K6NeejtkerKNQmKXebJxU
```

### How to Use in Code

```javascript
// Frontend: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrxhqpnzhilpnllfevcj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeGhxcG56aGlscG5sbGZldmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMwODYsImV4cCI6MjA4NjAyOTA4Nn0.9ew2t4lMwHP0gUs25MUJC0K6NeejtkerKNQmKXebJxU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Key Concepts About These Keys

```
ANON KEY (safe for frontend):
  - This is a PUBLIC key — safe to put in frontend JavaScript
  - It can only do what Row Level Security (RLS) allows
  - Cannot bypass security policies
  - Anyone can see it (it's in your JavaScript bundle)

SERVICE ROLE KEY (NEVER in frontend):
  - This is a SECRET key — only for server-side code
  - Bypasses ALL Row Level Security
  - Can read/write/delete anything
  - NEVER expose this in frontend code

PUBLISHABLE KEY:
  - New format Supabase key (replaces anon key for new apps)
  - Same purpose as anon key — safe for frontend
  - Format: sb_publishable_...
```

---

## Summary — How Everything Connects

```
┌────────────────────────────────────────────────────────────────┐
│                    THE BIG PICTURE                              │
│                                                                │
│  USER'S PHONE                                                  │
│  ├── WhatsApp/Telegram message                                 │
│  │   → WhatsApp/Telegram servers                               │
│  │   → Baileys/grammY in Docker container (OpenClaw)           │
│  │   → OpenClaw calls LLM (user's API key)                    │
│  │   → AI response sent back to user's phone                  │
│  │                                                             │
│  USER'S BROWSER                                                │
│  ├── app.clawcloud.com (React frontend)                       │
│  │   → Supabase Auth (signup/login)                           │
│  │   → api.clawcloud.com (our backend API)                    │
│  │   → Backend manages Docker containers (hidden from user)   │
│  │   → Backend proxies QR codes, status, logs to frontend     │
│  │                                                             │
│  PAYMENT                                                       │
│  ├── Stripe Checkout (user pays)                               │
│  │   → Stripe webhook → our backend                           │
│  │   → Backend provisions container → employee is live         │
│  │                                                             │
│  INFRASTRUCTURE                                                │
│  ├── Cloudflare DNS (*.clawcloud.com → our server)            │
│  ├── Nginx (routes traffic to correct container)              │
│  ├── Let's Encrypt (wildcard SSL for all subdomains)          │
│  ├── Docker (isolates each customer)                          │
│  ├── PostgreSQL/Supabase (stores all data)                    │
│  └── Hetzner VPS (the actual server running everything)       │
└────────────────────────────────────────────────────────────────┘
```

**You now understand every core concept needed to build ClawCloud.**
