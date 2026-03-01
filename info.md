# ClawCloud Platform — Complete Technical Documentation

> **Project**: Multi-tenant SaaS platform selling managed OpenClaw AI agents to customers via WhatsApp & Telegram
> **Business Model**: You host OpenClaw in isolated Docker containers; customers pay monthly subscriptions
> **Comparable Services**: StartClaw ($49-$200/mo), but you build & own the infrastructure

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What is OpenClaw?](#2-what-is-openclaw)
3. [Architecture Overview](#3-architecture-overview)
4. [Flow Diagrams](#4-flow-diagrams)
5. [Infrastructure Setup (Step 1)](#5-infrastructure-setup)
6. [Provisioning Engine (Step 2)](#6-provisioning-engine)
7. [User Experience (Step 3)](#7-user-experience)
8. [Marketplace & Skills](#8-marketplace--skills)
9. [Employees Feature (AI Personas)](#9-employees-feature)
10. [Integrations (Email, Calendar, Browser)](#10-integrations)
11. [Security Architecture](#11-security-architecture)
12. [Database Schema](#12-database-schema)
13. [API Endpoints Reference](#13-api-endpoints-reference)
14. [File System Structure](#14-file-system-structure)
15. [Monitoring & Health Checks](#15-monitoring--health-checks)
16. [Backup Strategy](#16-backup-strategy)
17. [Scaling Roadmap](#17-scaling-roadmap)
18. [Cost Analysis](#18-cost-analysis)
19. [Tools & Requirements](#19-tools--requirements)
20. [Deployment Checklist](#20-deployment-checklist)
21. [Validation Report & Known Issues](#21-validation-report--known-issues)

---

## 1. Executive Summary

### What We Are Building

A **managed hosting platform** (like StartClaw) where customers pay a monthly fee to get their own private AI assistant powered by **OpenClaw**. Each customer gets:

- A **private OpenClaw instance** running in an isolated Docker container
- A **unique subdomain** (e.g., `customer-sarah.clawcloud.com`)
- **WhatsApp and/or Telegram** connectivity
- Access to a **skill marketplace** (coding, calendar, email, etc.)
- Ability to create **AI "employees"** (multiple personas with different roles)

### The Business Analogy

```
You = Apartment building owner
Each Customer = Tenant with their own apartment
Docker Container = The apartment (isolated, private)
Nginx = The receptionist who routes visitors to the right apartment
Your Domain = The building's address
Wildcard SSL = One master key system for all apartments
```

### Revenue Model

| Plan     | Price    | Features                        |
|----------|----------|---------------------------------|
| Basic    | $20/mo   | WhatsApp/Telegram AI bot        |
| Pro      | $35/mo   | + Marketplace skills            |
| Business | $75/mo   | + Multiple AI employees         |

**Break-even**: 2 customers. At 100 customers: ~$2,000/mo revenue, ~$24 costs = **98% margin**.

---

## CRITICAL DESIGN PRINCIPLE — Custom Frontend (Users NEVER See OpenClaw)

> **This is the single most important architectural decision in the project.**

### How StartClaw Works (Our Reference)

StartClaw users **never interact with OpenClaw's native Control UI**. Instead:

1. User signs up on **StartClaw's website** (custom React frontend)
2. User creates an "AI Employee" from StartClaw's dashboard
3. User provides their **own API key** (Claude/OpenAI) via StartClaw's UI
4. User connects **Telegram** (enters bot token) or **WhatsApp** (scans QR) via StartClaw's UI
5. User monitors AI agent activity via StartClaw's **custom dashboard**
6. OpenClaw runs **invisibly** in a Docker container behind the scenes

**The user never knows OpenClaw exists. They see YOUR brand, YOUR dashboard, YOUR UI.**

### Our Architecture (Same Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WHAT THE USER SEES                                │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              YOUR CUSTOM FRONTEND (React)                     │  │
│  │              Hosted at: app.clawcloud.com                     │  │
│  │                                                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│  │
│  │  │ Sign Up  │ │Dashboard │ │ Connect  │ │  Manage AI       ││  │
│  │  │ / Login  │ │ (Status) │ │ WhatsApp │ │  Employees       ││  │
│  │  │          │ │          │ │ Telegram │ │                  ││  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│  │
│  │  │ Skill    │ │ API Key  │ │ Billing  │ │  Chat History    ││  │
│  │  │Marketplace│ │ Settings │ │ (Stripe) │ │  / Logs          ││  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    API calls (REST + WebSocket)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WHAT THE USER NEVER SEES                          │
│                                                                      │
│  ┌──────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  YOUR BACKEND API        │  │  OpenClaw Containers            │ │
│  │  (Node.js/Express)       │  │  (Hidden from users)            │ │
│  │                          │  │                                 │ │
│  │  - Auth (JWT/Sessions)   │  │  claw-sarah → port 19001       │ │
│  │  - Provisioning          │  │  claw-bob   → port 19002       │ │
│  │  - Container management  │  │  claw-jane  → port 19003       │ │
│  │  - Stripe webhooks       │  │                                 │ │
│  │  - QR code proxy         │  │  Each runs OpenClaw Gateway    │ │
│  │  - Telegram token relay  │  │  internally on :18789          │ │
│  └──────────────────────────┘  └─────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  PostgreSQL              │  │  Nginx Reverse Proxy            │ │
│  │  - Users, auth           │  │  - Routes subdomains to ports   │ │
│  │  - Container mappings    │  │  - SSL termination              │ │
│  │  - OAuth tokens          │  │  - WebSocket upgrade            │ │
│  └──────────────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### StartClaw Onboarding Flow (What We Replicate)

```
Step 1: Sign Up
  User visits clawcloud.com → creates account (email + password)

Step 2: Create AI Employee
  User clicks "New Employee" → gives it a name → selects plan → Stripe checkout

Step 3: Provide API Key
  User enters their OpenAI or Anthropic API key in the dashboard settings
  (They pay for their own LLM usage — we don't subsidize AI costs)

Step 4: Connect Messaging Channel
  Option A — Telegram: User enters bot token from @BotFather
  Option B — WhatsApp: User scans QR code displayed in dashboard
  Option C — Both: User connects both channels

Step 5: AI Employee is Live
  Dashboard shows: Status ✅ Connected
  User can now text their bot on WhatsApp/Telegram and get AI responses
```

### Key Differences: StartClaw vs. Our Platform vs. Raw OpenClaw

| Feature              | Raw OpenClaw         | StartClaw           | Our Platform (ClawCloud) |
|----------------------|----------------------|---------------------|--------------------------|
| User sees OpenClaw UI| Yes                  | **No** (custom UI)  | **No** (custom UI)       |
| Setup difficulty     | 2-4 hours (Docker)   | 5 minutes           | 5 minutes                |
| Frontend             | OpenClaw Control UI  | Custom React app    | Custom React app         |
| Backend              | User runs Gateway    | Managed containers  | Managed containers       |
| Pricing              | Free (self-hosted)   | $49-$200/mo         | $20-$75/mo               |
| User provides API key| Yes                  | Yes                 | Yes                      |
| User manages server  | Yes                  | No                  | No                       |

---

## COMPLETE REQUIREMENTS — What You Need Before Building

### A. Accounts & API Keys You Must Obtain

| # | Requirement              | Where to Get                     | Cost      | Purpose                              |
|---|--------------------------|----------------------------------|-----------|---------------------------------------|
| 1 | **Domain name**          | Namecheap / Cloudflare           | ~$10/yr   | `clawcloud.com` (your brand)         |
| 2 | **Cloudflare account**   | cloudflare.com (free plan)       | Free      | DNS management + wildcard SSL        |
| 3 | **Cloudflare API token** | Cloudflare Dashboard → API Tokens| Free      | Certbot DNS challenge for wildcard   |
| 4 | **Hetzner account**      | hetzner.com                      | €17/mo    | VPS server (CX41)                    |
| 5 | **Stripe account**       | stripe.com                       | 2.9%+$0.30| Payment processing + subscriptions   |
| 6 | **Stripe API keys**      | Stripe Dashboard → Developers    | Free      | Publishable key + Secret key         |
| 7 | **Stripe webhook secret**| Stripe Dashboard → Webhooks      | Free      | Verify incoming webhook signatures   |
| 8 | **SendGrid account**     | sendgrid.com                     | Free tier | Send welcome/notification emails     |
| 9 | **SendGrid API key**     | SendGrid Dashboard → Settings    | Free      | Transactional email delivery         |
| 10| **Google Cloud project** | console.cloud.google.com         | Free      | OAuth credentials for Gmail/Calendar |
| 11| **Google OAuth Client ID**| GCP → APIs → Credentials        | Free      | Gmail + Calendar integration         |
| 12| **Google OAuth Secret**  | GCP → APIs → Credentials         | Free      | Gmail + Calendar integration         |
| 13| **Backblaze B2 account** | backblaze.com                    | ~$3/mo    | Backup storage (optional initially)  |

### B. Server Infrastructure

| Component              | Specification                              |
|------------------------|--------------------------------------------|
| **Provider**           | Hetzner Cloud                              |
| **Plan**               | CX41 (start) → CX51 (at 50 customers)     |
| **OS**                 | Ubuntu 24.04 LTS                           |
| **CPU**                | 4 cores (CX41) / 8 cores (CX51)           |
| **RAM**                | 16 GB (CX41) / 32 GB (CX51)               |
| **Storage**            | 160 GB SSD                                 |
| **Location**           | Nuremberg / Falkenstein / Helsinki          |
| **Cost**               | €17/mo (~$18) for CX41                     |

### C. Software Stack — Backend (Runs on Hetzner Server)

| Software               | Version     | Purpose                                |
|-------------------------|-------------|----------------------------------------|
| **Ubuntu**              | 24.04 LTS   | Operating system                       |
| **Docker**              | Latest      | Container runtime for OpenClaw         |
| **Docker Compose**      | v2+         | Multi-container orchestration          |
| **Node.js**             | ≥ 22        | Backend API runtime                    |
| **PostgreSQL**          | 16+         | Database (users, tokens, mappings)     |
| **Nginx**               | Latest      | Reverse proxy + SSL termination        |
| **Certbot**             | Latest      | Wildcard SSL certificate management    |
| **Git**                 | Latest      | Code deployment                        |
| **UFW**                 | Pre-installed | Firewall                             |
| **OpenClaw**            | Latest      | AI agent (runs inside Docker containers)|

### D. Node.js Packages — Backend API

| Package                | Purpose                                |
|------------------------|----------------------------------------|
| `express`              | Web framework for REST API             |
| `pg`                   | PostgreSQL client                      |
| `dotenv`               | Environment variable management        |
| `bcrypt`               | Password hashing (user auth)           |
| `jsonwebtoken`         | JWT tokens for frontend auth           |
| `express-rate-limit`   | Rate limiting                          |
| `helmet`               | Security HTTP headers                  |
| `cors`                 | Cross-origin (frontend ↔ backend)      |
| `stripe`               | Stripe payment integration             |
| `proper-lockfile`      | File locking (Nginx map race condition)|
| `googleapis`           | Gmail/Calendar OAuth                   |
| `dockerode`            | Docker API client (manage containers)  |
| `winston`              | Structured logging                     |
| `node-cron`            | Scheduled tasks (health checks, etc.)  |
| `ws`                   | WebSocket server (QR code relay, logs) |
| `nodemailer` or `@sendgrid/mail` | Sending emails to customers |
| `crypto` (built-in)    | Token encryption (AES-256)             |

### E. Software Stack — Frontend (React Dashboard)

| Technology             | Purpose                                |
|------------------------|----------------------------------------|
| **React 18+** (Vite)  | Frontend framework                     |
| **TypeScript**         | Type safety                            |
| **TailwindCSS**        | Styling (modern, utility-first)        |
| **shadcn/ui**          | Pre-built UI components                |
| **Lucide React**       | Icons                                  |
| **React Router v6**    | Client-side routing                    |
| **Axios** or **fetch** | API calls to backend                   |
| **TanStack Query**     | Server state management + caching      |
| **Zustand** or **Context** | Client state management           |
| **React Toastify**     | Toast notifications                    |
| **Stripe.js** + **@stripe/react-stripe-js** | Payment UI        |
| **qrcode.react**       | QR code display (WhatsApp pairing)     |
| **recharts** (optional)| Usage charts / analytics               |

### F. Frontend Pages Required

| Page                     | Route                | Features                                          |
|--------------------------|----------------------|---------------------------------------------------|
| **Landing Page**         | `/`                  | Marketing, pricing, CTA "Get Started"            |
| **Sign Up**              | `/signup`            | Email + password registration                     |
| **Login**                | `/login`             | Email + password login                            |
| **Dashboard**            | `/dashboard`         | Agent status, connected channels, quick actions   |
| **Connect WhatsApp**     | `/connect/whatsapp`  | QR code display, connection status                |
| **Connect Telegram**     | `/connect/telegram`  | Token input field, connection status              |
| **API Key Settings**     | `/settings/api-keys` | Enter/update OpenAI or Anthropic key              |
| **AI Employees**         | `/employees`         | List, create, edit, delete AI personas            |
| **Create Employee**      | `/employees/new`     | Name, role, system prompt, trigger prefix         |
| **Skill Marketplace**    | `/marketplace`       | Browse and install skills                         |
| **Billing**              | `/billing`           | Current plan, upgrade/downgrade, invoices         |
| **Chat History / Logs**  | `/logs`              | View recent conversations + agent activity        |
| **Settings**             | `/settings`          | Profile, password change, integrations            |

### G. Backend API Endpoints Required

| Method | Endpoint                    | Purpose                                    | Auth  |
|--------|-----------------------------|--------------------------------------------|-------|
| POST   | `/api/auth/signup`          | Register new user                          | None  |
| POST   | `/api/auth/login`           | Login, return JWT                          | None  |
| GET    | `/api/auth/me`              | Get current user profile                   | JWT   |
| POST   | `/api/employees`            | Create new AI employee (provisions container)| JWT |
| GET    | `/api/employees`            | List user's AI employees                   | JWT   |
| PUT    | `/api/employees/:id`        | Update employee (name, prompt, etc.)       | JWT   |
| DELETE | `/api/employees/:id`        | Delete employee (tears down container)     | JWT   |
| GET    | `/api/employees/:id/status` | Get container health + connection status   | JWT   |
| POST   | `/api/connect/whatsapp/:id` | Initiate WhatsApp QR pairing (WebSocket)   | JWT   |
| POST   | `/api/connect/telegram/:id` | Connect Telegram bot token                 | JWT   |
| PUT    | `/api/settings/api-key`     | Save/update user's LLM API key             | JWT   |
| GET    | `/api/marketplace/skills`   | List available skills                      | JWT   |
| POST   | `/api/marketplace/install`  | Install skill on an employee               | JWT   |
| POST   | `/api/billing/checkout`     | Create Stripe checkout session             | JWT   |
| POST   | `/api/billing/webhook`      | Stripe webhook handler                     | Stripe|
| GET    | `/api/billing/subscription` | Get current subscription info              | JWT   |
| GET    | `/api/logs/:employeeId`     | Get chat history / agent logs              | JWT   |
| GET    | `/api/health`               | Server + container health (internal)       | Admin |

### H. Environment Variables Required (Backend `.env`)

```env
# Server
NODE_ENV=production
PORT=3000
DOMAIN=clawcloud.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clawcloud
DB_USER=clawadmin
DB_PASSWORD=<generate-strong-password>

# Authentication
JWT_SECRET=<generate-64-char-random-string>
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...

# Email
SENDGRID_API_KEY=SG....
FROM_EMAIL=hello@clawcloud.com

# Google OAuth (for Gmail/Calendar integrations)
GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://app.clawcloud.com/auth/google/callback

# Encryption
TOKEN_ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# OpenClaw
OPENCLAW_BASE_PORT=19000
OPENCLAW_IMAGE=openclaw:local

# Cloudflare
CLOUDFLARE_API_TOKEN=<your-token>
```

### I. What You Need on Your LOCAL Dev Machine

| Tool                   | Purpose                              |
|------------------------|--------------------------------------|
| **VS Code** (or similar)| Code editor                         |
| **Node.js 22+**        | Local development                    |
| **Git**                | Version control                      |
| **Docker Desktop**     | Test containers locally (optional)   |
| **Postman** or **Thunder Client** | API testing               |
| **SSH client**         | Connect to Hetzner server            |

---

## 2. What is OpenClaw?

### Overview (From Research)

**OpenClaw** (formerly Clawdbot/Moltbot) is an **open-source personal AI assistant** (60,000+ GitHub stars) that:

- Runs as a **Node.js Gateway daemon** on your own hardware
- Connects to **messaging apps**: WhatsApp (via Baileys), Telegram (via grammY), Discord, Slack, Signal, iMessage, Microsoft Teams, and more
- Uses **LLMs** (Anthropic Claude, OpenAI GPT) to process and respond to messages
- Has **browser control** (Playwright/Chromium), **file system access**, **shell execution**
- Supports **skills & plugins** — extendable via community or custom skills
- Has a **web dashboard** (Control UI) served on port `18789` by default
- Supports **multi-agent routing** — different agents for different channels/contacts

### Key Technical Facts

| Property              | Value                                          |
|-----------------------|------------------------------------------------|
| Runtime               | Node.js ≥ 22                                   |
| Default Gateway Port  | `18789`                                        |
| Config File           | `~/.openclaw/openclaw.json`                    |
| Workspace             | `~/.openclaw/workspace/`                       |
| Skills Directory      | `~/.openclaw/workspace/skills/<skill>/SKILL.md`|
| Docker Setup Script   | `./docker-setup.sh`                            |
| Install Command       | `npm install -g openclaw@latest`               |
| Onboarding            | `openclaw onboard --install-daemon`            |
| WhatsApp Protocol     | Baileys (Web WhatsApp reverse-engineered)      |
| Telegram Protocol     | grammY (Telegram Bot API)                      |
| Security              | DM pairing by default, allowlist-based access  |

### How OpenClaw Works (Architecture)

```
WhatsApp / Telegram / Slack / Discord / Signal / iMessage / WebChat
                              │
                              ▼
                ┌───────────────────────────┐
                │         Gateway           │
                │     (control plane)       │
                │   ws://127.0.0.1:18789    │
                └─────────────┬─────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────┴─────┐  ┌─────┴─────┐  ┌──────┴──────┐
        │ Pi Agent   │  │ CLI Tools │  │ Control UI  │
        │ (RPC mode) │  │           │  │ (Web Panel) │
        └────────────┘  └───────────┘  └─────────────┘
```

### StartClaw (The Commercial Competitor)

StartClaw is a managed hosting service that does exactly what we're building:
- **Starter**: $49/mo — 1 OpenClaw agent + $15 credits
- **Pro**: $99/mo — 3 agents + $25 credits
- **Enterprise**: $200/mo — Unlimited agents + $50 credits
- Tagline: *"No servers. No Docker. No DevOps. Just your AI, running 24/7."*

**Our advantage**: We build this ourselves at ~$24/mo server cost and sell at $20-75/customer.

---

## 3. Architecture Overview

### High-Level System Diagram (Custom Frontend — Users Never See OpenClaw)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         THE INTERNET                                  │
│                                                                       │
│  USER INTERACTION PATHS:                                              │
│                                                                       │
│  PATH A — Dashboard (Browser):                                        │
│    User visits app.clawcloud.com → YOUR React Dashboard              │
│    (Sign up, manage employees, connect channels, view logs)          │
│                                                                       │
│  PATH B — Messaging (Phone):                                          │
│    User texts WhatsApp/Telegram → message goes to their container    │
│    (AI responds automatically — no dashboard needed)                 │
└───────────┬──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE DNS + SSL                              │
│        app.clawcloud.com    → Your Server (Frontend/API)             │
│        api.clawcloud.com    → Your Server (Backend API)              │
│        *.clawcloud.com      → Your Server (Container routing)        │
│        Wildcard SSL Certificate (Let's Encrypt)                      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      YOUR HETZNER SERVER                             │
│                      (CX41: 4 CPU, 16GB RAM)                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    NGINX REVERSE PROXY                         │  │
│  │                    (Port 443 HTTPS)                            │  │
│  │                                                                │  │
│  │  app.clawcloud.com          ──►  Static React files (or CDN) │  │
│  │  api.clawcloud.com          ──►  localhost:3000 (Backend API) │  │
│  │  c-sarah.clawcloud.com      ──►  localhost:19001 (container)  │  │
│  │  c-bob.clawcloud.com        ──►  localhost:19002 (container)  │  │
│  │  c-jane.clawcloud.com       ──►  localhost:19003 (container)  │  │
│  │                                                                │  │
│  │  Container map: /etc/nginx/customer_map.conf                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────┐                                │
│  │  CUSTOM FRONTEND (React)        │  ◄── User sees THIS only      │
│  │  Served at: app.clawcloud.com   │                                │
│  │  Static files or Nginx-served   │                                │
│  └─────────────────────────────────┘                                │
│                                                                      │
│  ┌─────────────────────────────────┐                                │
│  │  BACKEND API (Node.js/Express)  │  ◄── Powers the dashboard     │
│  │  Port: 3000                     │                                │
│  │  - Auth (signup/login/JWT)      │                                │
│  │  - Employee CRUD + provisioning │                                │
│  │  - Channel connection proxy     │                                │
│  │  - Stripe webhook handler       │                                │
│  │  - Container health management  │                                │
│  │  - QR code relay (WebSocket)    │                                │
│  └──────────────┬──────────────────┘                                │
│                 │ manages                                            │
│                 ▼                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Container 1  │  │ Container 2  │  │ Container 3  │              │
│  │ claw-sarah   │  │ claw-bob     │  │ claw-jane    │  ◄── HIDDEN │
│  │ Port: 19001  │  │ Port: 19002  │  │ Port: 19003  │     from    │
│  │              │  │              │  │              │     users    │
│  │ OpenClaw     │  │ OpenClaw     │  │ OpenClaw     │              │
│  │ Gateway      │  │ Gateway      │  │ Gateway      │              │
│  │ :18789       │  │ :18789       │  │ :18789       │              │
│  │              │  │              │  │              │              │
│  │ WhatsApp ✓   │  │ Telegram ✓   │  │ Both ✓       │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    POSTGRESQL DATABASE                         │  │
│  │   Users (auth), Employees, Ports, OAuth Tokens, Skills, Logs  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component              | Role                                                          |
|------------------------|---------------------------------------------------------------|
| **Custom Frontend**    | React dashboard — the ONLY thing users interact with          |
| **Backend API**        | Node.js/Express — auth, provisioning, container management    |
| **Cloudflare DNS**     | Routes `*.clawcloud.com` to server IP                         |
| **Let's Encrypt**      | Wildcard SSL via Certbot + Cloudflare DNS plugin              |
| **Nginx**              | Reverse proxy: subdomain → container, app → frontend, api → backend |
| **Docker**             | Isolates each customer in separate container                  |
| **OpenClaw**           | AI bot engine running HIDDEN inside each container            |
| **PostgreSQL**         | Users, employees, port mappings, OAuth tokens, skills, logs   |
| **Stripe**             | Payment processing + subscription management                 |

### How the Backend Talks to OpenClaw Containers

The backend API acts as a **proxy/bridge** between the user's dashboard and their hidden OpenClaw container:

```
User Action in Dashboard          Backend API Does                   OpenClaw Container
─────────────────────────         ──────────────────────             ──────────────────────
"Connect WhatsApp" click    →     Calls container's WS API    →     Generates QR code
                            ←     Relays QR to frontend       ←     Returns QR data

"Enter Telegram token"      →     Writes to container config  →     Reads config on restart
                            →     Restarts container          →     Connects to Telegram

"Create AI Employee"        →     Provisions new container    →     Container starts
                            →     Writes openclaw.json config →     Loads agent settings

"View chat history"         →     Reads container logs/API    →     Returns conversation data
                            ←     Formats and sends to UI     ←

"Install Coding Skill"      →     Copies skill template       →     Reads skill on restart
                            →     Restarts container          →     Skill available
```

---

## 4. Flow Diagrams

### FLOW 1: Customer Provisioning (New User Buys Service)

```
User pays $20 on website
        │
        ▼
Stripe sends webhook to your billing server
        │
        ▼
Billing server calls: POST http://localhost:3000/provision
        │               { customerId: "sarah", openaiKey: "sk-..." }
        │
        ▼
┌─────────────────────────────────────────────┐
│         PROVISIONING ENGINE                  │
│                                              │
│  1. Query DB for next available port         │
│     INSERT INTO customers (...) RETURNING *  │
│     → port = 19001                           │
│                                              │
│  2. Create directory:                        │
│     /opt/claw-platform/users/sarah/          │
│     /opt/claw-platform/users/sarah/config/   │
│                                              │
│  3. Write docker-compose.yml:                │
│     - image: openclaw (built from source)    │
│     - container: claw-sarah                  │
│     - ports: 19001:18789                     │
│     - volumes: ./config:/root/.openclaw      │
│     - env: API keys, password                │
│     - restart: always                        │
│                                              │
│  4. Run: docker-compose up -d                │
│     → Container starts on port 19001         │
│                                              │
│  5. Append to /etc/nginx/customer_map.conf:  │
│     customer-sarah.clawcloud.com 19001;      │
│     (with file locking to prevent races)     │
│                                              │
│  6. Reload Nginx: systemctl reload nginx     │
│                                              │
│  7. Return:                                  │
│     { url: "https://customer-sarah...",      │
│       password: "k8jx9p2m" }                 │
└─────────────────────────────────────────────┘
        │
        ▼
Send welcome email to customer with URL + password
```

**What each step does:**

| Step | Action                  | Purpose                                              |
|------|-------------------------|------------------------------------------------------|
| 1    | DB port assignment      | Atomic operation prevents duplicate ports            |
| 2    | Directory creation      | Isolated folder for customer's config & data         |
| 3    | docker-compose.yml      | Blueprint telling Docker exactly what to run         |
| 4    | `docker-compose up -d`  | Actually starts the container in background          |
| 5    | Nginx map update        | Tells Nginx "this subdomain → this port"             |
| 6    | Nginx reload            | Applies new routing rule without downtime            |
| 7    | Return credentials      | Customer gets their unique URL and password          |

---

### FLOW 2: WhatsApp Connection (User Links Phone via YOUR Dashboard)

```
User is logged into YOUR dashboard at app.clawcloud.com
        │
        ▼
User clicks "Connect WhatsApp" button on YOUR React UI
        │
        ▼
Frontend sends: POST api.clawcloud.com/api/connect/whatsapp/emp_123
  (with JWT auth header)
        │
        ▼
┌─────────────────────────────────────────────────┐
│  YOUR BACKEND API (the proxy layer)              │
│                                                   │
│  1. Verifies JWT → identifies user as "sarah"    │
│  2. Looks up sarah's container port from DB       │
│     → port 19001                                  │
│  3. Opens WebSocket to container's OpenClaw API   │
│     ws://localhost:19001 (OpenClaw Gateway WS)    │
│  4. Sends "channels login whatsapp" command       │
│  5. OpenClaw generates QR code via Baileys        │
│  6. Backend RELAYS QR data back to frontend       │
│     via WebSocket to user's browser               │
└─────────────────────────────────────────────────┘
        │
        ▼
YOUR React frontend renders QR code using qrcode.react library
  (User sees YOUR branded page, NOT OpenClaw's UI)
        │
        ▼
User opens WhatsApp → Settings → Linked Devices → Scan QR
        │
        ▼
WhatsApp sends session credentials to container via Baileys
        │
        ▼
OpenClaw container establishes persistent connection to WhatsApp servers
        │
        ▼
Backend detects connection success → updates DB status
        │
        ▼
YOUR dashboard shows: "WhatsApp: Connected ✅"
```

**Key technical points:**
- **Backend as proxy**: User NEVER talks to OpenClaw directly. Backend relays QR from container to frontend.
- **WebSocket chain**: Frontend ↔ Backend (ws) ↔ Container (ws). Two WebSocket hops.
- **Baileys**: Open-source library inside OpenClaw that reverse-engineers WhatsApp Web protocol.
- **Persistent connection**: Container keeps socket open to WhatsApp servers 24/7.
- **Linked Devices**: WhatsApp feature allowing up to 4 linked devices per account.
- **QR code display**: Rendered by YOUR frontend (`qrcode.react` library), not OpenClaw's Control UI.

---

### FLOW 3: Message Processing (User Sends WhatsApp Message)

```
User texts WhatsApp: "Summarize the news today"
        │
        ▼
User's Phone → WhatsApp Servers (Meta infrastructure)
        │
        ▼
WhatsApp Servers → deliver to linked device (OpenClaw container)
        │
        ▼
Baileys client inside container receives message via WebSocket
        │
        ▼
┌─────────────────────────────────────────────┐
│         OPENCLAW MESSAGE PIPELINE            │
│                                              │
│  1. Message normalization                    │
│     - Extract text, media, sender info       │
│     - Check DM policy (allowlist/pairing)    │
│                                              │
│  2. Session management                       │
│     - Load conversation history              │
│     - Load user preferences & memory         │
│                                              │
│  3. Skill/Agent routing                      │
│     - Check if message matches a trigger     │
│     - Route to appropriate AI persona        │
│                                              │
│  4. LLM API call                             │
│     - System prompt + context + user message │
│     - Uses customer's OpenAI/Anthropic key   │
│     - Model: Claude Opus 4.6 or GPT-4o      │
│                                              │
│  5. Response generation                      │
│     - AI generates response text             │
│     - May invoke tools (browser, code exec)  │
│                                              │
│  6. Send reply via WhatsApp                  │
│     - Baileys sends message back             │
│     - Supports text, images, files           │
└─────────────────────────────────────────────┘
        │
        ▼
WhatsApp Servers deliver reply to user's phone
        │
        ▼
User sees AI response (typically 2-5 seconds total)
```

---

### FLOW 4: Telegram Connection (Alternative Channel)

```
User creates bot via @BotFather on Telegram (on their phone)
        │
        ▼
BotFather returns token: "12345:ABC-DEF..."
        │
        ▼
User pastes token into YOUR dashboard at app.clawcloud.com/connect/telegram
  (YOUR React UI — NOT OpenClaw's Control UI)
        │
        ▼
Frontend sends: POST api.clawcloud.com/api/connect/telegram/emp_123
  { token: "12345:ABC..." } (with JWT auth header)
        │
        ▼
Backend writes token to: /opt/claw-platform/users/sarah/config/secrets.json
        │
        ▼
Backend restarts container: docker restart claw-sarah
        │
        ▼
Container reads token on startup
        │
        ▼
OpenClaw (via grammY library) calls Telegram API:
  setWebhook → https://customer-sarah.clawcloud.com/webhook/telegram
        │
        ▼
Telegram servers now POST incoming messages to that URL
        │
        ▼
Same message processing pipeline as WhatsApp from here
```

**Telegram vs WhatsApp differences:**

| Feature          | WhatsApp           | Telegram              |
|------------------|--------------------|-----------------------|
| Auth method      | QR code scan       | Bot token from BotFather |
| Protocol         | Baileys (reverse-eng) | Official Bot API      |
| Webhook setup    | Automatic (Baileys) | Programmatic via API  |
| Can run both?    | ✅ Yes              | ✅ Yes                 |

---

### FLOW 5: Skill Installation (User Adds Capability)

```
User clicks "Install Coding Agent" in dashboard marketplace
        │
        ▼
Frontend sends: POST /api/install-skill
                { userId: "sarah", skillId: "coding" }
        │
        ▼
┌─────────────────────────────────────────────┐
│         SKILL INSTALLATION ENGINE            │
│                                              │
│  1. Read template:                           │
│     /opt/claw-platform/templates/coding.json │
│                                              │
│  2. Copy to customer's skill folder:         │
│     /opt/claw-platform/users/sarah/config/   │
│       skills/coding.json                     │
│                                              │
│  3. Check if skill needs sidecar container   │
│     (e.g., Python sandbox for code execution)│
│                                              │
│  4. IF sidecar needed:                       │
│     - Update docker-compose.yml              │
│     - Add python-sandbox service             │
│     - Run: docker-compose up -d              │
│                                              │
│  5. Restart main container:                  │
│     docker restart claw-sarah                │
│                                              │
│  6. Container reads new skill on startup     │
│                                              │
│  7. Return: "Coding Agent Installed ✓"       │
└─────────────────────────────────────────────┘
        │
        ▼
User can now text: "Write a Python script to analyze my CSV"
```

**Sidecar container explained:**

```
┌─────────────────────────────────────────┐
│        Customer Sarah's Environment      │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ Main         │  │ Sidecar          │ │
│  │ Container    │◄─►│ Container        │ │
│  │ (OpenClaw)   │  │ (Python Sandbox) │ │
│  │              │  │                  │ │
│  │ Handles msgs │  │ Runs user code   │ │
│  │ Calls LLM    │  │ Isolated exec    │ │
│  │ Port: 19001  │  │ No external net  │ │
│  └──────────────┘  └──────────────────┘ │
│        │                    │            │
│        └────── HTTP ────────┘            │
│          (internal network)              │
└─────────────────────────────────────────┘
```

- **Main container**: Runs OpenClaw (WhatsApp/Telegram bot logic)
- **Sidecar container**: Runs Python/code in isolation
- **Communication**: Main sends code to sidecar via internal HTTP
- **Safety**: If code crashes sidecar, main container is unaffected

---

### FLOW 6: Employee Creation (Multiple AI Personas)

```
User clicks "Add Employee" in dashboard
        │
        ▼
POST /api/add-employee
{
    userId: "sarah",
    employeeName: "Marketing Mary",
    role: "marketing",
    prompt: "You are an expert marketer. Generate engaging content..."
}
        │
        ▼
Backend reads existing agents.json for sarah
        │
        ▼
Adds new agent entry with unique ID
        │
        ▼
Writes back to: /opt/claw-platform/users/sarah/config/agents.json
        │
        ▼
Restarts container to load new config
        │
        ▼
Now when Sarah texts "Marketing: Create 5 posts for our launch"
        │
        ▼
OpenClaw routing logic checks message prefix against triggers:
  "Marketing:" → route to Marketing Mary's system prompt
  "Code:" → route to Dev Dan's system prompt
  "Sales:" → route to Sales Sam's system prompt
        │
        ▼
Selected agent's system_prompt + user message → LLM API
        │
        ▼
Response sent back via WhatsApp/Telegram
```

**agents.json structure:**
```json
[
    {
        "id": "emp_1706123456",
        "name": "Marketing Mary",
        "role": "marketing",
        "system_prompt": "You are an expert marketer...",
        "active": true,
        "trigger": "Marketing:"
    },
    {
        "id": "emp_1706123789",
        "name": "Dev Dan",
        "role": "developer",
        "system_prompt": "You are a Python expert...",
        "active": true,
        "trigger": "Code:"
    }
]
```

---

## 5. Infrastructure Setup

### 5A. Server Requirements

| Spec         | Minimum    | Recommended      |
|--------------|------------|------------------|
| Provider     | Hetzner    | Hetzner          |
| Plan         | CX41       | CX51 (at 50+ customers) |
| CPU          | 4 cores    | 8 cores          |
| RAM          | 16 GB      | 32 GB            |
| Storage      | 160 GB SSD | 240 GB SSD       |
| OS           | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Cost         | €17/mo (~$18) | €30/mo (~$32)  |

### 5B. Wildcard SSL Certificate

**Problem it solves**: Let's Encrypt allows ~50 certificates per domain per week. With 100+ customers, you'd hit the limit immediately.

**Solution**: ONE wildcard certificate covers ALL subdomains.

```
*.clawcloud.com = covers:
  customer1.clawcloud.com  ✓
  customer2.clawcloud.com  ✓
  customer999.clawcloud.com ✓
```

**Setup steps:**

```bash
# 1. Store Cloudflare API token
mkdir -p /etc/letsencrypt/secrets
cat > /etc/letsencrypt/secrets/cloudflare.ini << EOF
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
EOF
chmod 600 /etc/letsencrypt/secrets/cloudflare.ini

# 2. Generate wildcard certificate
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/secrets/cloudflare.ini \
  -d "*.clawcloud.com" \
  -d "clawcloud.com"

# 3. Auto-renewal (certbot sets up cron automatically)
certbot renew --dry-run  # Test renewal
```

### 5C. Nginx Configuration

**Main config: `/etc/nginx/sites-available/clawcloud`**

```nginx
# Dynamic subdomain-to-port mapping
map $host $backend_port {
    hostnames;
    default 18789;                              # Fallback
    include /etc/nginx/customer_map.conf;       # Customer mappings
}

# HTTPS server block
server {
    listen 443 ssl;
    server_name *.clawcloud.com;

    # Wildcard SSL certificate
    ssl_certificate     /etc/letsencrypt/live/clawcloud.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clawcloud.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:$backend_port;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (CRITICAL for QR code scanning)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name *.clawcloud.com;
    return 301 https://$host$request_uri;
}
```

**Customer map file: `/etc/nginx/customer_map.conf`**

```
customer-sarah.clawcloud.com 19001;
customer-bob.clawcloud.com 19002;
customer-jane.clawcloud.com 19003;
```

**How the map works:**
1. Request arrives: `customer-sarah.clawcloud.com`
2. Nginx checks `customer_map.conf`
3. Finds: `customer-sarah.clawcloud.com 19001;`
4. Sets `$backend_port = 19001`
5. Proxies to `http://127.0.0.1:19001`
6. OpenClaw container on that port responds

### 5D. Swap File (Memory Safety Net)

```bash
# Create 8GB swap file
fallocate -l 8G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make permanent across reboots
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Why**: 50 customers × 200MB each = 10GB normally. On spikes (Black Friday, viral moment), usage can double. Without swap, server crashes and ALL customers go offline. With swap, server slows but stays alive.

### 5E. Firewall Configuration

```bash
ufw allow 22/tcp    # SSH access
ufw allow 80/tcp    # HTTP (redirects to HTTPS)
ufw allow 443/tcp   # HTTPS (customer traffic)
ufw deny 3000       # BLOCK provisioning API from internet
# Only allow from billing server:
# ufw allow from BILLING_SERVER_IP to any port 3000
ufw --force enable
```

**Critical**: Port 3000 (provisioning API) must NEVER be publicly accessible. Otherwise anyone can create free containers on your server.

---

## 6. Provisioning Engine

### Docker Compose Template (Per Customer)

```yaml
version: '3.8'

services:
  openclaw:
    image: openclaw:local
    container_name: claw-${CUSTOMER_ID}
    restart: always
    ports:
      - "${USER_PORT}:18789"
    volumes:
      - ./config:/root/.openclaw
    environment:
      - OPENCLAW_API_PASSWORD=${PASSWORD}
      - OPENAI_API_KEY=${OPENAI_KEY}
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          memory: 128M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Docker Compose fields explained:**

| Field              | Real-World Analogy                                    |
|--------------------|-------------------------------------------------------|
| `image`            | The apartment blueprint/template                      |
| `container_name`   | The apartment number (unique identifier)              |
| `ports`            | The apartment's private entrance (external:internal)  |
| `volumes`          | Personal storage that survives even if you remodel    |
| `environment`      | Keys and access codes given to the tenant             |
| `restart: always`  | Auto-repairs: if apartment floods, auto-fix at 3 AM   |
| `logging`          | Prevents log files from filling disk (max 30MB each)  |
| `deploy.resources` | Prevents one tenant from consuming all building power |
| `healthcheck`      | Automatic "is the tenant alive?" check every 30s      |

### Provisioning API (Node.js)

```javascript
// File: /opt/claw-backend/server.js

const express = require('express');
const { Pool } = require('pg');
const { exec } = require('child_process');
const fs = require('fs');
const lockfile = require('proper-lockfile');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const pool = new Pool({
    host: 'localhost',
    database: 'clawcloud',
    user: 'clawadmin',
    password: process.env.DB_PASSWORD
});

const DOMAIN = 'clawcloud.com';
const BASE_PORT = 19000;

function generatePassword(length = 12) {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

app.post('/provision', async (req, res) => {
    const { customerId, openaiKey } = req.body;

    try {
        // 1. Validate input
        if (!customerId || !openaiKey) {
            return res.status(400).json({ error: 'customerId and openaiKey required' });
        }

        // 2. Check if already exists
        const existing = await pool.query(
            'SELECT * FROM customers WHERE customer_id = $1', [customerId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Customer already exists' });
        }

        // 3. Atomic port assignment via DB
        const password = generatePassword();
        const subdomain = `customer-${customerId}.${DOMAIN}`;

        const result = await pool.query(`
            INSERT INTO customers (customer_id, subdomain, port, password, openai_key)
            VALUES ($1, $2,
                (SELECT COALESCE(MAX(port), $3) + 1 FROM customers),
                $4, $5
            )
            RETURNING *
        `, [customerId, subdomain, BASE_PORT, password, openaiKey]);

        const { port } = result.rows[0];

        // 4. Create directory structure
        const userDir = `/opt/claw-platform/users/${customerId}`;
        fs.mkdirSync(`${userDir}/config`, { recursive: true });

        // 5. Write docker-compose.yml
        const composeContent = `
version: '3.8'
services:
  openclaw:
    image: openclaw:local
    container_name: claw-${customerId}
    restart: always
    ports:
      - "${port}:18789"
    volumes:
      - ./config:/root/.openclaw
    environment:
      - OPENCLAW_API_PASSWORD=${password}
      - OPENAI_API_KEY=${openaiKey}
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
`;
        fs.writeFileSync(`${userDir}/docker-compose.yml`, composeContent);

        // 6. Start container
        await execPromise(`docker-compose up -d`, { cwd: userDir });

        // 7. Update Nginx map (WITH FILE LOCKING)
        const mapEntry = `${subdomain} ${port};\n`;
        const release = await lockfile.lock('/etc/nginx/customer_map.conf');
        try {
            fs.appendFileSync('/etc/nginx/customer_map.conf', mapEntry);
            await execPromise('systemctl reload nginx');
        } finally {
            await release();
        }

        // 8. Return credentials
        res.json({
            status: 'success',
            url: `https://${subdomain}`,
            password,
            port
        });

    } catch (error) {
        console.error('Provision failed:', error);
        // Cleanup on failure
        await cleanup(customerId);
        res.status(500).json({ error: 'Provisioning failed', message: error.message });
    }
});

function execPromise(cmd, options = {}) {
    return new Promise((resolve, reject) => {
        exec(cmd, options, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

async function cleanup(customerId) {
    try {
        const userDir = `/opt/claw-platform/users/${customerId}`;
        await execPromise(`docker-compose down`, { cwd: userDir }).catch(() => {});
        await pool.query('DELETE FROM customers WHERE customer_id = $1', [customerId]);
    } catch (e) {
        console.error('Cleanup failed:', e);
    }
}

app.listen(3000, () => console.log('Provisioning API on port 3000'));
```

---

## 7. User Experience (Custom Frontend — Like StartClaw)

### Day 1: Sarah's Journey (What She Sees)

**Step 1 — Sign Up on YOUR website**
```
Sarah visits clawcloud.com (YOUR landing page)
  → Sees pricing plans, features, testimonials
  → Clicks "Get Started"
  → Redirected to app.clawcloud.com/signup
  → Creates account: email + password
  → Email verification link sent
```

**Step 2 — Create First AI Employee**
```
Sarah logs into app.clawcloud.com/dashboard (YOUR React dashboard)
  → Dashboard is empty: "No AI Employees yet"
  → Clicks "Create New Employee"
  → Names it: "Assistant Amy"
  → Selects plan: Basic ($20/mo)
  → Stripe checkout → pays
  → Returns to dashboard
```

**Step 3 — Behind the scenes (0-30 seconds, user sees loading spinner)**
```
Stripe webhook fires → YOUR backend receives it
  → POST /api/employees (internal provisioning)
  → DB: assigns port 19001, creates employee record
  → Creates /opt/claw-platform/users/sarah/
  → Writes docker-compose.yml + openclaw.json
  → docker-compose up -d → container starts
  → Updates Nginx map → reloads Nginx
  → Updates DB: employee status = "running"
  → Dashboard auto-updates: "Assistant Amy — Running ✅"
```

**Step 4 — Provide API Key**
```
Dashboard prompts: "Add your AI API key to get started"
  → Sarah goes to app.clawcloud.com/settings/api-keys
  → Enters her OpenAI key: sk-proj-...
  → Backend encrypts key → writes to container config
  → Restarts container to apply
  → Dashboard shows: "AI Key: Connected ✅"
```

**Step 5 — Connect WhatsApp (5 minutes)**
```
Sarah clicks "Connect WhatsApp" on YOUR dashboard
  → YOUR frontend opens WebSocket to YOUR backend
  → Backend proxies to OpenClaw container → gets QR code
  → QR code renders on YOUR branded page (not OpenClaw's UI)
  → Sarah scans QR with WhatsApp → Linked Devices → Scan
  → Container confirms connection via Baileys
  → Backend updates DB status
  → YOUR dashboard shows: "WhatsApp: Connected ✅"
```

**Step 5b — Connect Telegram (optional, 2 minutes)**
```
Sarah goes to app.clawcloud.com/connect/telegram
  → Instructions shown: "Open Telegram → @BotFather → /newbot → copy token"
  → Sarah pastes token into YOUR input field
  → Backend writes token to container config → restarts
  → Container connects to Telegram via grammY
  → YOUR dashboard shows: "Telegram: Connected ✅"
```

**Step 6 — Daily use (Sarah never opens the dashboard again)**
```
Sarah texts WhatsApp: "Write a thank-you email to my client John"

[3 seconds later]
AI Bot: "Here's a draft:

Subject: Thank You for Your Partnership

Dear John,

I wanted to take a moment to express my sincere gratitude
for your continued partnership..."
```

**What happens behind the scenes during a message:**
```
Sarah's Phone
    → WhatsApp Servers (Meta)
        → Baileys in Container (claw-sarah) [HIDDEN from Sarah]
            → OpenClaw processes message [HIDDEN from Sarah]
                → Calls OpenAI API (Sarah's own key)
                    → Gets AI response
                        → Sends via WhatsApp API
                            → Sarah's Phone receives reply

Sarah has NO IDEA OpenClaw exists. She just sees "ClawCloud" as the product.
```

---

## 8. Marketplace & Skills

### Available Skills

| Skill         | Price    | Needs Sidecar? | Needs Credentials? |
|---------------|----------|-----------------|---------------------|
| Coding Agent  | $5/mo    | Yes (Python)    | No                  |
| Calendar      | Free     | No              | Yes (Google OAuth)  |
| Email         | $3/mo    | No              | Yes (Google OAuth)  |
| Web Browser   | $5/mo    | Yes (Playwright)| No                  |
| Weather       | Free     | No              | No (free API)       |
| News          | Free     | No              | No (free API)       |
| Sales CRM     | $10/mo   | No              | Yes (custom)        |

### What Works Out of the Box (No Extra Credentials)

- **General AI chat**: Ask questions, get AI answers
- **Text generation**: Write emails, code, content
- **Code execution**: Run code in sandboxed container
- **Weather**: Uses free weather APIs
- **News headlines**: Uses free news APIs
- **Math/calculations**: No API needed

### What Requires User Setup

- **Email (Gmail)**: Requires Google OAuth flow (user clicks "Connect Gmail")
- **Calendar**: Same Google OAuth flow, different scopes
- **Web browsing**: Needs Playwright sidecar container
- **Custom integrations**: User provides API keys

---

## 9. Employees Feature

### Concept

Instead of ONE AI personality, customers can create multiple "employees" with different roles, each with:
- **A name** (Marketing Mary, Dev Dan)
- **A role** (marketer, developer, sales)
- **A system prompt** (detailed instructions for the AI)
- **A trigger** (message prefix that activates this persona)

### User Workflow Example

```
Sarah creates 3 employees:

1. "Marketing Mary" — triggered by "Marketing:"
   → Expert marketer, generates social media content

2. "Dev Dan" — triggered by "Code:"
   → Python expert, writes production-ready code

3. "Sales Sam" — triggered by "Sales:"
   → Tracks deals, follows up with leads

Sarah's morning texts:
  "Marketing: Create 5 Instagram posts for our launch"
    → Marketing Mary responds with creative content

  "Sales: What deals close this week?"
    → Sales Sam checks CRM and lists 3 deals

  "Code: Debug my API endpoint"
    → Dev Dan analyzes code and suggests fixes
```

---

## 10. Integrations

### 10A. Email Integration (Best Practice: OAuth 2.0)

**Why OAuth, NOT passwords:**

| Method       | Security  | Google Support     | Auto-Refresh |
|--------------|-----------|--------------------|--------------|
| Password     | Terrible  | Being deprecated   | No           |
| App Password | Medium    | Limited support    | No           |
| **OAuth 2.0**| Excellent | Recommended        | Yes          |

**OAuth Flow:**

```
User clicks "Connect Gmail" in dashboard
        │
        ▼
Redirect to: https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=YOUR_GOOGLE_CLIENT_ID
  &redirect_uri=https://clawcloud.com/auth/callback
  &scope=https://www.googleapis.com/auth/gmail.readonly
  &response_type=code
  &state=userId:sarah
        │
        ▼
Google shows: "ClawCloud wants to read your email. Allow?"
        │
        ▼
User clicks "Allow"
        │
        ▼
Google redirects to: https://clawcloud.com/auth/callback?code=AUTH_CODE
        │
        ▼
Backend exchanges code for tokens:
  POST https://oauth2.googleapis.com/token
  → { access_token, refresh_token, expiry }
        │
        ▼
Tokens encrypted (AES-256-CBC) and stored in PostgreSQL
        │
        ▼
Auto-refresh: Token refreshed 5 minutes before expiry
  → User NEVER needs to re-authenticate
```

**Token encryption:**
```javascript
const crypto = require('crypto');
const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
```

### 10B. Calendar Integration

Same OAuth flow as Gmail but with different scopes:
```
Gmail scope:    https://www.googleapis.com/auth/gmail.readonly
Calendar scope: https://www.googleapis.com/auth/calendar.events
```

Natural language parsing:
```
User: "Schedule meeting with John tomorrow at 2pm for 1 hour"
  → AI parses: { summary: "Meeting with John", start: "2026-02-08T14:00", end: "2026-02-08T15:00" }
  → Google Calendar API creates the event
  → User sees it in their Google Calendar
```

### 10C. Web Browsing (Headless Browser)

**Architecture**: Playwright sidecar container

```yaml
# Added to customer's docker-compose.yml when browser skill installed
services:
  openclaw:
    # ... main container config ...
    environment:
      - BROWSER_SERVICE_URL=http://browser:3001
    depends_on:
      - browser
    networks:
      - claw-network

  browser:
    image: mcr.microsoft.com/playwright:v1.40.0-focal
    container_name: claw-${CUSTOMER_ID}-browser
    restart: always
    command: node /app/browser-service.js
    volumes:
      - ./browser-service:/app
    networks:
      - claw-network
    mem_limit: 1g
    cpus: 0.5
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL

networks:
  claw-network:
    driver: bridge
```

**Browser service endpoints:**
- `POST /fetch` — Fetch page content (handles JavaScript rendering)
- `POST /search` — Search Google and return results
- `POST /interact` — Fill forms, click buttons, etc.

### 10D. Honest Assessment — What Works vs. Doesn't

| Feature              | Out of Box? | Needs Setup?                     |
|----------------------|-------------|----------------------------------|
| AI Chat              | ✅ Yes       | Just API key                     |
| Code execution       | ✅ Yes       | Sidecar container                |
| Web search           | ✅ Yes       | Browser sidecar                  |
| Gmail read           | ❌ No        | Google OAuth + skill code        |
| Calendar             | ❌ No        | Google OAuth + skill code        |
| Access user's files  | ❌ No        | Not possible remotely            |
| Control user's phone | ❌ No        | Not possible                     |

**Bottom line**: The bot can do AI chat, code, and web browsing out of the box. Email/calendar require OAuth setup and additional skill code.

---

## 11. Security Architecture

### Security Checklist

| Risk                        | Mitigation                                           |
|-----------------------------|------------------------------------------------------|
| Provisioning API exposed    | Firewall blocks port 3000 from internet              |
| Port collision              | Atomic DB assignment (not formula-based)             |
| Race condition on Nginx map | File locking with `proper-lockfile`                  |
| Container escapes           | Resource limits, read-only where possible            |
| Cross-customer access       | Separate Docker networks per customer                |
| Token theft                 | AES-256-CBC encryption in database                   |
| DDoS                        | Cloudflare protection (free tier)                    |
| Brute force                 | Rate limiting on all API endpoints                   |
| Log disk overflow           | Docker log rotation (max 30MB per container)         |
| RAM exhaustion              | 8GB swap file + container memory limits              |

### Container Isolation

```
Customer A's Network: claw-network-A
Customer B's Network: claw-network-B

Customer A ──✕──► Customer B  (CANNOT communicate)
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 50,                    // 50 requests per window
    keyGenerator: (req) => req.body.userId,
    message: 'Too many requests, please try again later'
});

app.use('/api/', apiLimiter);
```

---

## 12. Database Schema

```sql
-- Customers table (core)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    port INTEGER UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    openai_key TEXT,
    telegram_token TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP
);

CREATE INDEX idx_customers_port ON customers(port);
CREATE INDEX idx_customers_subdomain ON customers(subdomain);

-- Installed skills per customer
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    skill_id VARCHAR(50) NOT NULL,
    installed_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active'
);

-- AI employee personas
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    system_prompt TEXT,
    trigger_prefix VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- OAuth tokens (encrypted)
CREATE TABLE oauth_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,     -- AES-256 encrypted
    refresh_token TEXT NOT NULL,    -- AES-256 encrypted
    expiry TIMESTAMP NOT NULL,
    scopes TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_tokens_user ON oauth_tokens(user_id, provider);

-- Integration usage logs
CREATE TABLE integration_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    integration VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_user ON integration_logs(user_id, timestamp);
```

---

## 13. API Endpoints Reference

### POST `/provision`

Creates a new customer environment.

| Field       | Type   | Required | Description               |
|-------------|--------|----------|---------------------------|
| customerId  | string | Yes      | Unique customer identifier|
| openaiKey   | string | Yes      | Customer's OpenAI API key |

**Response:**
```json
{
    "status": "success",
    "url": "https://customer-sarah.clawcloud.com",
    "password": "k8jx9p2m",
    "port": 19001
}
```

### POST `/api/connect/telegram`

Connects Telegram bot to a customer's container.

| Field  | Type   | Required | Description                 |
|--------|--------|----------|-----------------------------|
| userId | string | Yes      | Customer ID                 |
| token  | string | Yes      | Telegram bot token from BotFather |

### POST `/api/install-skill`

Installs a skill/capability to a customer.

| Field   | Type   | Required | Description                |
|---------|--------|----------|----------------------------|
| userId  | string | Yes      | Customer ID                |
| skillId | string | Yes      | Skill identifier           |

### POST `/api/add-employee`

Creates a new AI persona for a customer.

| Field        | Type   | Required | Description               |
|--------------|--------|----------|---------------------------|
| userId       | string | Yes      | Customer ID               |
| employeeName | string | Yes      | Display name              |
| role         | string | Yes      | Role category             |
| prompt       | string | Yes      | System prompt for this AI |

### GET `/api/health`

Returns health status of all containers.

**Response:**
```json
{
    "total": 50,
    "healthy": 48,
    "unhealthy": 2,
    "details": [
        { "container": "claw-101", "status": "healthy" },
        { "container": "claw-102", "status": "unhealthy" }
    ]
}
```

---

## 14. File System Structure

```
/opt/
├── claw-backend/                    # Provisioning API
│   ├── server.js                    # Main API server
│   ├── package.json
│   ├── lib/
│   │   ├── token-manager.js         # OAuth token encryption
│   │   └── db.js                    # Database connection
│   └── integrations/
│       ├── gmail-service.js         # Gmail OAuth integration
│       ├── calendar-service.js      # Calendar integration
│       └── browser-service.js       # Headless browser client
│
├── claw-platform/
│   ├── templates/                   # Skill definition templates
│   │   ├── coding.json
│   │   ├── calendar.json
│   │   ├── email.json
│   │   ├── browser.json
│   │   └── sales-crm.json
│   │
│   └── users/                       # Customer data (one dir per customer)
│       ├── sarah/
│       │   ├── docker-compose.yml   # Container config
│       │   └── config/
│       │       ├── openclaw.json    # OpenClaw configuration
│       │       ├── secrets.json     # API keys, tokens
│       │       ├── agents.json      # AI employee definitions
│       │       └── workspace/
│       │           └── skills/      # Installed skill files
│       │               ├── coding/
│       │               └── weather/
│       │
│       └── bob/
│           └── ... (same structure)
│
├── backups/                         # Automated backup storage
│   └── daily-backup.sh
│
└── scripts/
    └── setup-server.sh              # Server initialization script

/etc/nginx/
├── sites-available/clawcloud        # Nginx config
├── sites-enabled/clawcloud          # Symlink to above
└── customer_map.conf                # Subdomain → port mapping
```

---

## 15. Monitoring & Health Checks

### Container Health Monitoring

```javascript
// In provisioning API: /opt/claw-backend/server.js

app.get('/api/health', async (req, res) => {
    try {
        const result = await execPromise(
            'docker ps --format "{{.Names}},{{.Status}}"'
        );
        const lines = result.split('\n').filter(l => l.startsWith('claw-'));

        const containers = lines.map(line => {
            const [name, status] = line.split(',');
            return {
                container: name,
                status: status.includes('healthy') ? 'healthy' : 'unhealthy'
            };
        });

        const unhealthy = containers.filter(c => c.status === 'unhealthy');

        if (unhealthy.length > 0) {
            await sendAlert(`${unhealthy.length} containers unhealthy: ${
                unhealthy.map(c => c.container).join(', ')
            }`);
        }

        res.json({
            total: containers.length,
            healthy: containers.length - unhealthy.length,
            unhealthy: unhealthy.length,
            details: containers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**Cron job (check every minute):**
```
* * * * * curl -s http://localhost:3000/api/health > /dev/null
```

### External Monitoring

- **UptimeRobot** (free): Monitor `https://clawcloud.com` uptime
- **Prometheus + Grafana** (self-hosted): Detailed metrics and dashboards (add at 50+ customers)

---

## 16. Backup Strategy

### What to Back Up

| Data                     | Location                          | Criticality |
|--------------------------|-----------------------------------|-------------|
| Customer configs         | `/opt/claw-platform/users/*/`     | Critical    |
| PostgreSQL database      | `pg_dump clawcloud`               | Critical    |
| Nginx mappings           | `/etc/nginx/customer_map.conf`    | High        |
| SSL certificates         | `/etc/letsencrypt/`               | Medium      |

### Automated Daily Backup Script

```bash
#!/bin/bash
# File: /opt/backups/daily-backup.sh

BACKUP_DIR="/opt/backups/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# 1. Backup all customer configs
tar -czf $BACKUP_DIR/customer-configs.tar.gz /opt/claw-platform/users/

# 2. Backup database
pg_dump clawcloud > $BACKUP_DIR/database.sql

# 3. Backup Nginx config
cp /etc/nginx/customer_map.conf $BACKUP_DIR/

# 4. Upload to cloud storage (Backblaze B2 or AWS S3)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/$(date +%Y-%m-%d)/

# 5. Keep only last 30 days locally
find /opt/backups/ -mtime +30 -delete

echo "Backup complete: $BACKUP_DIR"
```

**Cron job (run at 2 AM daily):**
```
0 2 * * * /opt/backups/daily-backup.sh >> /var/log/backup.log 2>&1
```

---

## 17. Scaling Roadmap

### Current Architecture Limits

| Resource        | Limit               | Calculation                          |
|-----------------|---------------------|--------------------------------------|
| Available ports | ~46,535             | Ports 19000-65535                    |
| RAM (16GB)      | ~80 containers      | 16GB ÷ 200MB per container          |
| CPU (4 cores)   | ~50 active users    | 4 cores ÷ 0.08 per active user      |
| Disk I/O        | ~100 customers      | SSD handles ~100 concurrent writes   |
| Nginx map file  | ~10,000 lines       | Performance degrades after this      |

### Scaling Milestones

| Customers | Action                                                    |
|-----------|-----------------------------------------------------------|
| **10**    | Current setup works fine                                  |
| **50**    | Upgrade to CX51 (32GB RAM, €30/mo). Add monitoring.      |
| **100**   | Move port assignment to DB-driven. Add automated backups. |
| **200**   | Multiple servers + load balancer (HAProxy). Kubernetes.   |
| **500**   | Multi-region. Separate DB server. CDN for static assets.  |
| **1000+** | Kubernetes orchestration. Dedicated ops team.             |

---

## 18. Cost Analysis

### Your Fixed Costs (Monthly)

| Item                    | Cost          |
|-------------------------|---------------|
| Hetzner CX41 server    | $18/mo        |
| Domain name             | $1/mo         |
| Backups (Backblaze B2)  | $3-5/mo       |
| **Total**               | **$22-24/mo** |

### Per-Transaction Costs

| Item                    | Cost                  |
|-------------------------|-----------------------|
| Stripe processing fee   | 2.9% + $0.30/payment |
| Per-customer cost       | $24 ÷ N customers    |

### Profit Projections

| Customers | Revenue (@ $20/mo) | Costs    | Profit      | Margin |
|-----------|---------------------|----------|-------------|--------|
| 2         | $40                 | $24      | $16         | 40%    |
| 10        | $200                | $24      | $176        | 88%    |
| 50        | $1,000              | $32*     | $968        | 97%    |
| 100       | $2,000              | $32*     | $1,968      | 98%    |

*\*Upgraded server at 50 customers*

---

## 19. Tools & Requirements

### Server Software (Install on Ubuntu)

| Tool                     | Purpose                              | Install Command                           |
|--------------------------|--------------------------------------|-------------------------------------------|
| Docker                   | Container runtime                    | `apt install docker.io`                   |
| Docker Compose           | Multi-container orchestration        | `apt install docker-compose`              |
| Nginx                    | Reverse proxy                        | `apt install nginx`                       |
| Certbot                  | SSL certificate manager              | `apt install certbot`                     |
| Certbot Cloudflare       | DNS challenge for wildcard SSL       | `apt install python3-certbot-dns-cloudflare` |
| PostgreSQL               | Database                             | `apt install postgresql postgresql-contrib` |
| Node.js 22+              | Backend runtime                      | `curl -fsSL https://deb.nodesource.com/setup_22.x \| bash - && apt install nodejs` |
| Git                      | Version control                      | `apt install git`                         |
| UFW                      | Firewall                             | `apt install ufw` (usually pre-installed) |

### Node.js Packages (Backend)

| Package              | Purpose                          |
|----------------------|----------------------------------|
| `express`            | Web framework                    |
| `pg`                 | PostgreSQL client                |
| `dotenv`             | Environment variables            |
| `bcrypt`             | Password hashing                 |
| `jsonwebtoken`       | JWT authentication               |
| `express-rate-limit` | Rate limiting                    |
| `helmet`             | Security headers                 |
| `cors`               | Cross-origin requests            |
| `stripe`             | Payment processing               |
| `proper-lockfile`    | File locking (race conditions)   |
| `googleapis`         | Gmail/Calendar OAuth             |
| `winston`            | Logging                          |
| `node-cron`          | Scheduled tasks                  |
| `dockerode`          | Docker API client                |

### External Services

| Service          | Purpose                 | Cost            |
|------------------|-------------------------|-----------------|
| Hetzner          | Server hosting          | €17/mo          |
| Cloudflare       | DNS + DDoS protection   | Free            |
| Let's Encrypt    | SSL certificates        | Free            |
| Stripe           | Payments                | 2.9% + $0.30   |
| SendGrid         | Transactional emails    | Free (100/day)  |
| Backblaze B2     | Backup storage          | $0.005/GB/mo    |
| UptimeRobot      | Uptime monitoring       | Free (50 monitors) |
| Google Cloud     | OAuth credentials       | Free            |

### Frontend Stack (Customer Dashboard)

| Tool                 | Purpose                    |
|----------------------|----------------------------|
| React (Vite)         | Frontend framework         |
| TailwindCSS          | Styling                    |
| React Router         | Page routing               |
| Axios                | API calls                  |
| React Query          | Data fetching/caching      |
| React Toastify       | Notifications              |

---

## 20. Deployment Checklist

### Phase 1: Server Setup (Week 1)

- [ ] Buy domain name (e.g., `clawcloud.com`)
- [ ] Sign up for Hetzner CX41 server
- [ ] Point domain DNS to Cloudflare
- [ ] SSH into server
- [ ] Install Docker, Nginx, Certbot, PostgreSQL, Node.js
- [ ] Generate wildcard SSL certificate
- [ ] Configure Nginx reverse proxy with WebSocket support
- [ ] Create 8GB swap file
- [ ] Configure firewall (UFW)
- [ ] Build OpenClaw Docker image from source

### Phase 2: Backend (Week 2)

- [ ] Set up PostgreSQL database with schema
- [ ] Deploy Node.js provisioning API
- [ ] Implement atomic port assignment
- [ ] Implement file-locked Nginx updates
- [ ] Add health monitoring endpoint
- [ ] Set up automated backup script
- [ ] Add error handling and logging
- [ ] Add rate limiting

### Phase 3: Frontend (Week 3)

- [ ] Build customer dashboard (React)
- [ ] Add Stripe integration (subscriptions + webhooks)
- [ ] Create skill marketplace UI
- [ ] Create employee management UI
- [ ] Create settings page (connect Gmail, Telegram, etc.)

### Phase 4: Testing (Week 4)

- [ ] Provision 5 test customers simultaneously
- [ ] Connect WhatsApp and send test messages
- [ ] Connect Telegram and send test messages
- [ ] Install and test skills
- [ ] Kill a container → verify auto-restart
- [ ] Reboot server → verify all containers auto-start
- [ ] Test concurrent provisioning (race conditions)
- [ ] Test full backup and restore

### Phase 5: Launch Prep (Week 5)

- [ ] Write Terms of Service + Privacy Policy
- [ ] Set up support system (email or Discord)
- [ ] Beta test with 10 users
- [ ] Monitor for issues
- [ ] Fix bugs and iterate

### Phase 6: Launch (Week 6)

- [ ] Deploy to production
- [ ] Announce publicly
- [ ] Monitor closely for first 48 hours
- [ ] Iterate based on feedback

---

## 21. Validation Report & Known Issues

### Architecture Quality: B+ (85%)

**Strengths:**
- Core tunnel concept (Nginx → Docker) is solid and industry-standard
- Docker container isolation provides good security
- Wildcard SSL elegantly solves rate limit problem
- `restart: always` handles container crashes automatically
- Volume mounting ensures data persistence across restarts
- Both WhatsApp (Baileys) and Telegram (grammY) are well-supported channels

**Critical Issues to Fix Before Launch:**

| # | Issue                     | Risk Level | Fix                                             |
|---|---------------------------|------------|--------------------------------------------------|
| 1 | No database               | CRITICAL   | Add PostgreSQL with atomic port assignment       |
| 2 | Race conditions           | CRITICAL   | File locking for Nginx map + DB transactions     |
| 3 | No monitoring             | CRITICAL   | Health check endpoint + UptimeRobot              |
| 4 | No backups                | CRITICAL   | Automated daily backup script + cloud upload     |
| 5 | Port 3000 exposed         | HIGH       | Firewall rule: `ufw deny 3000`                  |
| 6 | Port formula broken       | HIGH       | DB-driven port assignment (not `BASE + parseInt`)| 
| 7 | No container resource limits | MEDIUM  | Add `deploy.resources.limits` to compose         |
| 8 | No Docker log rotation    | MEDIUM     | Add `logging` config to compose template         |
| 9 | No input validation       | MEDIUM     | Validate all API inputs, parameterized queries   |
| 10| No error handling         | MEDIUM     | Try-catch with cleanup on failure                |

### Production Readiness Verdict

```
WITHOUT fixes: Will break at 10+ customers. DO NOT LAUNCH.
WITH fixes:    Handles 100 customers comfortably. Can scale to 500.
Timeline:      2-3 weeks to implement all fixes.
```

---

## Quick Reference: Server Setup Script

```bash
#!/bin/bash
# File: setup-server.sh — Run on fresh Ubuntu 24.04

echo "=== ClawCloud Server Setup ==="

# Update system
apt update && apt upgrade -y

# Install core software
apt install -y docker.io docker-compose nginx \
    certbot python3-certbot-dns-cloudflare \
    postgresql postgresql-contrib \
    git ufw htop vim curl wget

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3000
ufw --force enable

# Create swap file
fallocate -l 8G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Create directory structure
mkdir -p /opt/claw-backend
mkdir -p /opt/claw-platform/templates
mkdir -p /opt/claw-platform/users
mkdir -p /opt/backups
mkdir -p /etc/letsencrypt/secrets

# Set up PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE clawcloud;"
sudo -u postgres psql -c "CREATE USER clawadmin WITH PASSWORD 'CHANGE_THIS_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE clawcloud TO clawadmin;"

echo "=== Setup Complete ==="
echo "Next: Configure Cloudflare DNS, generate SSL, deploy code"
```

---

*Document Version: 1.0 | Created: February 7, 2026 | Project: ClawCloud Platform*
