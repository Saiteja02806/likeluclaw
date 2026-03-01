# LikelyClaw Project Memory

> **Last Updated:** Feb 16, 2026

---

## 🖥️ Server Infrastructure

| Component | Value |
|-----------|-------|
| **Current Server** | DigitalOcean Droplet |
| **IP Address** | `167.71.226.121` |
| **Domain** | `likelyclaw.com` |
| **Region** | Mumbai (ap-south-1) |
| **SSH Key** | `~/.ssh/id_ed25519_likelyclaw` |

### Server Paths
- **Backend:** `/opt/claw-backend/`
- **Frontend:** `/var/www/frontend/`
- **User Configs:** `/opt/claw-platform/users/{employee_id}/`
- **Process Manager:** PM2 (`claw-backend`)

---

## 🗄️ Database (Supabase)

| Property | Value |
|----------|-------|
| **Project Name** | cloudclaw |
| **Project ID** | `pbrfftorddhbsujcuclk` |
| **Region** | ap-south-1 (Mumbai) |
| **URL** | `https://pbrfftorddhbsujcuclk.supabase.co` |

### Tables
- `profiles` (4 rows) — User accounts
- `employees` (6 rows) — AI employees/containers
- `skills` (12 rows) — Marketplace skills
- `employee_skills` (8 rows) — Installed skills
- `oauth_tokens` (1 row) — Google OAuth
- `activity_logs` (86 rows) — Activity tracking
- `chat_messages` (12 rows) — Web chat
- `composio_connections` (2 rows) — Third-party apps
- `reports` (0 rows) — User feedback

---

## 💳 Payments

| Provider | Environment |
|----------|-------------|
| **Razorpay** | Live |
| **Key ID** | `rzp_live_SDxUEIQOHRaLOE` |

---

## 🔑 Key Credentials (DO NOT COMMIT)

> Store actual values in `.env` files, not here!

- `SUPABASE_SERVICE_ROLE_KEY` — Backend only
- `TOKEN_ENCRYPTION_KEY` — AES encryption for tokens
- `RAZORPAY_KEY_SECRET` — Payment processing
- `GOOGLE_CLIENT_SECRET` — OAuth integrations

---

## 📁 Local Project Structure

```
sai claw/
├── backend/           # Node.js/Express API
│   ├── src/
│   │   ├── routes/    # 12 API route modules
│   │   ├── lib/       # Utilities (encryption, docker, etc.)
│   │   ├── middleware/# Auth middleware
│   │   ├── ws/        # WebSocket handler
│   │   └── server.js  # Entry point
│   └── package.json
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── pages/     # 20 page components
│   │   ├── components/# Shared components
│   │   ├── contexts/  # Auth context
│   │   └── lib/       # API client, Supabase
│   └── package.json
└── deploy scripts     # .sh files for deployment
```

---

## 🚀 Deployment Commands

```bash
# SSH to server
ssh -i ~/.ssh/id_ed25519_likelyclaw root@167.71.226.121

# Deploy full stack
scp backend-deploy.tar frontend-dist.tar root@167.71.226.121:/root/
ssh root@167.71.226.121 'bash /root/deploy-full.sh'

# Check backend status
ssh root@167.71.226.121 'pm2 status && curl localhost:3000/api/health'
```

---

## 🔧 Server Alternatives (Research)

| Provider | 4 vCPU / 16GB | India Region | Notes |
|----------|---------------|--------------|-------|
| **DigitalOcean** | ~$96/mo | Mumbai ✅ | Current, reliable |
| **Hetzner Cloud** | ~€17/mo (~$18) | No ❌ | Best value, EU only |
| **Contabo** | ~€9.50/mo | No ❌ | Cheapest, mixed reviews |
| **Vultr** | ~$80/mo | Mumbai ✅ | Good alternative |
| **Linode** | ~$96/mo | Mumbai ✅ | Similar to DO |

**Recommendation:** Stay with DigitalOcean for Mumbai latency. Consider Hetzner if latency to EU is acceptable (adds ~100-150ms for Indian users).

---

## ⚠️ Known Issues (From Architecture Audit)

### P0 — Critical
- [ ] RLS policies use `auth.uid()` instead of `(select auth.uid())`
- [ ] No monitoring/alerting (add UptimeRobot)

### P1 — Before Scaling
- [ ] Add Zod validation to API routes
- [ ] Add React Error Boundaries
- [ ] Add code splitting (React.lazy)
- [ ] Per-user Docker networks

---

## � Chat Flow Architecture

### Flow 1: Integration Chat (Web Dashboard → Agent)

```
User types message in Chat.tsx
  │
  ├─ POST /api/chat/message (HTTP)
  │    ├─ Saves user message to Supabase chat_messages
  │    ├─ Fetches connected apps from composio_connections
  │    ├─ Fetches MCP servers from employee_skills
  │    ├─ Builds context-enriched message (buildFullMessage)
  │    ├─ Returns chatId immediately (async processing)
  │    │
  │    └─ wsPool.sendMessage() (async)
  │         ├─ Opens persistent WS to ws://127.0.0.1:{port}
  │         ├─ Handshake: connect.challenge → authenticate → sessions.list
  │         ├─ Sends chat.send with sessionKey: agent:{empId}:integration-chat
  │         ├─ Handles: thinking, tool-call, streaming, final states
  │         ├─ Auto-approves exec.approval.requested
  │         └─ publishEvent() → Redis Stream (chat:{chatId})
  │
  └─ GET /api/chat/stream/:chatId (SSE)
       ├─ Replays buffered events from Redis
       ├─ Tails for new events via XREAD BLOCK
       └─ Frontend renders: connecting → thinking → tool-call → streaming → done
```

**Key: Agent executes tools via `exec` (shell commands)**
- Gmail: `node gmail-tools/check_emails.js`
- Calendar: `node calendar-tools/check_calendar.js`
- These scripts read `~/.openclaw/gmail-credentials.json` for OAuth tokens

### Flow 2: Telegram Chat (Telegram → Agent)

```
User sends Telegram message
  │
  ├─ Telegram API (long-polling by grammY inside container)
  │    └─ OpenClaw Gateway receives message directly
  │         ├─ Routes to agent based on channel config
  │         ├─ Agent has IDENTITY.md with skill instructions
  │         ├─ Agent has marketplace skills (gmail, calendar, news, etc.)
  │         ├─ Agent executes tools (exec, read, write, web_search)
  │         └─ Agent responds back via Telegram API
  │
  ├─ ADDITIONAL capabilities vs Integration Chat:
  │    ├─ Built-in channel features (Telegram-native)
  │    ├─ All marketplace skills available (same IDENTITY.md)
  │    ├─ Composio integrations via mcp-bridge-tools/
  │    └─ Agent writes to Supabase via tool scripts
  │
  └─ NO backend intermediary — container handles everything directly
```

### Key Differences

| Aspect | Integration Chat | Telegram Chat |
|--------|-----------------|---------------|
| **Entry point** | HTTP → Node.js → WS → Gateway | Telegram API → Gateway directly |
| **Intermediary** | Backend (wsPool) proxies all messages | None — container handles directly |
| **Latency** | Higher (HTTP + WS handshake + Redis SSE) | Lower (direct long-polling) |
| **Context injection** | buildFullMessage() adds integration context | IDENTITY.md only |
| **Streaming** | SSE via Redis Streams | Telegram sends complete messages |
| **Session** | `agent:{empId}:integration-chat` | Per-channel-peer (Telegram DM) |

---

## 🔌 Server Migrations & Config

### Current Container: `claw-8b0688f6-06e1b416`
- **Port:** 19006 → 18789 (internal)
- **Status:** Up 46h (healthy)
- **Agent:** "email reader and helper" (id: 06e1b416)
- **Model:** openai/gpt-4o-mini
- **Telegram:** Connected (bot token: 8002979852:...)
- **Gmail:** Connected (OAuth, auto-refreshing every 30min)
- **Calendar:** Connected (shares Gmail OAuth tokens)
- **Skills installed:** news, mcp-bridge
- **Tools allowed:** exec, read, write, web_fetch, web_search
- **Brave Search:** Configured (BSA4Eg0_...)

### Server Services
- **PM2 processes:** claw-backend (port 3000), llm-proxy (port 3100)
- **Redis:** Running (PONG), used for SSE event streaming
- **Docker:** 1 container running
- **Nginx:** Reverse proxy (HTTP only, no SSL currently)
- **OAuth token refresh:** Disabled (was every 30min) — now using Composio for Gmail/Calendar

### Composio Config (on container)
- API Key: `ak_dwQbQseD_XBpdKPeDgAE`
- Gmail: **Needs reconnection via Composio OAuth** (direct Google OAuth removed)
- Google Calendar: **Needs reconnection via Composio OAuth** (direct Google OAuth removed)

---

## � Session Notes

### Feb 16, 2026
- Set up new Windows laptop for development
- Generated SSH key: `id_ed25519_likelyclaw`
- Reviewed full project architecture
- Connected to Supabase via MCP
- SSH connected to server (167.71.226.121) — all services healthy
- Analyzed full Integration Chat + Telegram Chat flows
- **Deployed 4 fixes to improve integration chat effectiveness:**

#### Fix 1: Enriched `buildFullMessage()` with exact tool commands
- **File:** `src/routes/chat.js`
- Agent now receives exact exec commands for Gmail, Calendar, Sheets, Drive, Docs
- e.g. `node gmail-tools/check_emails.js [count] [--unread]`

#### Fix 2: Added skill-specific hints from installed employee_skills
- **File:** `src/routes/chat.js`
- Fetches installed skill slugs and adds hints (news, web-browser, mcp-bridge, etc.)
- Agent knows all available capabilities per message

#### Fix 3: Increased EARLY_TIMEOUT_MS from 30s → 60s
- **File:** `src/lib/wsPool.js`
- Integration tasks chain multiple exec calls (5-15s each)
- Prevents false "agent failed to start" errors

#### Fix 4: Improved tool-call status feedback
- **File:** `src/lib/wsPool.js`
- Added `_resolveToolDetail()` method that maps exec args to friendly messages
- User sees "Checking your emails..." instead of generic "Running integration..."

#### Removed Integration Chat from production (Feb 16, 2026)
- **Reason:** Increasing complexity, focusing on Telegram bot instead
- **Frontend:** Commented out `/chat` route in `App.tsx`, sidebar link in `Layout.tsx`, Chat CTA in `EmployeeDetail.tsx`
- **Backend:** Commented out `chatRoutes` import and mount in `server.js`
- **Local code preserved:** `Chat.tsx`, `chatStore.ts`, `chat.js`, `wsPool.js` all intact
- **Bundle size dropped:** 854KB → 680KB (Chat + Zustand tree-shaken out)
- **Server deployed:** Frontend rebuilt, backend restarted, nginx reloaded — all healthy

#### Fix 5 (local only, not deployed): Navigation-safe chat with Zustand global store
- **Root cause of "2-3 minute" perceived delay:**
  - Actual backend processing: **11-21 seconds** (confirmed from server logs)
  - User navigates away from /chat → React Router unmounts Chat component
  - `useEffect` cleanup closes the EventSource (SSE connection)
  - Backend continues processing, saves response to DB, but frontend never receives it
  - User navigates back → fresh component, no response shown
  - User resends → duplicate processing → messages queue up → cascading delays
- **Server constraints:** 1 vCPU, 2GB RAM (88MB free), 115MB swap active
- **Fix:** Created `frontend/src/stores/chatStore.ts` (Zustand)
  - All chat state (messages, SSE, sending, streaming) lives in global store
  - EventSource stays alive across React Router navigation
  - Auto-recovery from DB if SSE drops
  - Duplicate send prevention via `activeChatId` guard
  - `Chat.tsx` refactored to thin UI layer reading from store
- **Files changed:**
  - NEW: `frontend/src/stores/chatStore.ts`
  - MODIFIED: `frontend/src/pages/Chat.tsx`
  - ADDED: `zustand` dependency to `frontend/package.json`

#### Removed Custom MCP Section from server (Feb 16, 2026)
- **Reason:** Make Automation and VAPI MCPs no longer in use, adding complexity
- **Frontend:** Commented out MCP state, handlers, UI sections, modals, unused imports in `Integrations.tsx`
- **Backend:** Block-commented `POST /configure-mcp`, `DELETE /mcp-server`, `GET /mcp-servers/:employeeId` in `marketplace.js`
- **Local code preserved:** All MCP code intact locally, only disabled on server

#### Free User Experience — Marketplace & Integrations visible (Feb 16, 2026)
- **Goal:** Let free users SEE premium features (read-only) to encourage upgrades
- **Changes:**
  - Removed `PremiumGuard` from `/marketplace` and `/integrations` routes in `App.tsx`
  - Created `frontend/src/lib/usePlan.ts` — shared hook to check user's plan
  - `Marketplace.tsx`: Free users see all skills, but Install button replaced with golden "Upgrade to Install" CTA → `/billing`
  - `Integrations.tsx`: Free users see all apps, but Connect button replaced with golden "Upgrade to Connect" CTA → `/billing`
  - Premium users: zero change, all functionality works as before

#### Removed Direct Google OAuth — Switched to Composio (Feb 16, 2026)
- **Reason:** Google OAuth verification taking too long; Composio handles OAuth without needing Google verification
- **What was disabled on server (code preserved locally):**

| # | File | Change |
|---|------|--------|
| 1 | `backend/src/server.js` | Commented out `oauthRoutes` import/mount + `startTokenRefreshJob()` |
| 2 | `backend/src/routes/integrations.js` | Removed `DIRECT_OAUTH_APPS` bypass — Gmail/Calendar now go through Composio OAuth like all other apps |
| 3 | `backend/src/routes/employees.js` | Commented out `gmail-credentials.json` restore during provisioning |
| 4 | `backend/src/routes/employees.js` | Updated IDENTITY.md template: `gmail-tools/` → `integrations call GMAIL_*`, `calendar-tools/` → `integrations call GOOGLECALENDAR_*` |
| 5 | `backend/skill-templates/gmail/SKILL.md` | Rewritten to use Composio `integrations` command |
| 6 | `backend/skill-templates/calendar/SKILL.md` | Rewritten to use Composio `integrations` command |
| 7 | `frontend/src/pages/Marketplace.tsx` | `google_oauth` credential type now redirects to Integrations page instead of opening OAuth popup |

- **Files NOT deleted (kept locally for future use):**
  - `backend/src/routes/oauth.js` — Full Google OAuth start + callback + credential writing
  - `backend/src/jobs/token-refresh.js` — Token refresh job (30min interval)
  - `backend/skill-templates/gmail/tools/` — Direct Gmail API scripts (check_emails.js, send_email.js, etc.)
  - `backend/skill-templates/calendar/tools/` — Direct Calendar API scripts
  - `frontend/src/pages/OAuthCallback.tsx` — OAuth redirect handler

- **Container IDENTITY.md updated:** All 7 IDENTITY.md files on host + running container updated to use Composio commands
- **Action required:** User must reconnect Gmail and Google Calendar via Integrations page (Composio OAuth)

#### Black Screen Fix (Feb 16, 2026)
- **Root cause:** `scp -r` recreated `assets/` directory with `700` permissions; Nginx (`www-data`) couldn't read into it → HTTP 403 on JS/CSS assets
- **Fix:** `chmod 755 /var/www/frontend/assets/ && chmod 644 /var/www/frontend/assets/*`
- **Prevention:** Always run `chmod -R 755 /var/www/frontend/` after deploying frontend
