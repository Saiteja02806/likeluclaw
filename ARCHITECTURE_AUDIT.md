# LikelyClaw Architecture Audit Report
**Date**: Feb 9, 2026 | **Auditor**: Cascade AI | **Validation Source**: Perplexity MCP (production architecture patterns)

---

## 1. ARCHITECTURE OVERVIEW

### Our Current Architecture
```
User (Browser)
  │
  ├─── React SPA (Vite) ─── served by Nginx (static files)
  │         │
  │         ├── Supabase Auth (direct client-side auth)
  │         └── REST API calls (Bearer JWT)
  │
  ▼
Nginx (SSL termination, reverse proxy)
  │
  ├── /api/*  ──► Node.js/Express (PM2, port 3000)
  ├── /ws/*   ──► WebSocket upgrade (same Express server)
  └── /*      ──► SPA fallback (/var/www/frontend/index.html)
  
Node.js Backend (Express monolith)
  │
  ├── Supabase (PostgreSQL) ── auth, profiles, employees, skills, logs, oauth_tokens
  ├── Docker Socket (/var/run/docker.sock) ── container CRUD
  ├── File System (/opt/claw-platform/users/) ── config files
  └── Background Jobs (token refresh cron)

Docker Containers (per employee)
  │
  ├── openclaw:local image
  ├── Volume: ./config → /home/node/.openclaw
  ├── Resource limits: 2GB RAM, 0.8 CPU
  ├── Health check: curl localhost:18789/health
  └── Telegram long-polling (built-in)

User (Telegram)
  │
  └── Messages ──► Telegram API ──► OpenClaw container (long-polling)
```

### Recommended Architecture (from Perplexity)
```
User (Browser)
  │
  ├─── React SPA / Next.js (SSR optional)
  │         │
  │         ├── Auth (Supabase/JWT)
  │         └── REST + WebSocket
  │
  ▼
Nginx / API Gateway (Kong/Tyk)
  │
  ├── Rate limiting, auth, routing
  ├── Dynamic upstream to Docker containers
  └── SSL termination
  
Node.js Backend (monolith → microservices at scale)
  │
  ├── Database (Supabase + PgBouncer + RLS)
  ├── Docker API (not shell exec)
  ├── Redis/BullMQ for job queues
  ├── Vault for secrets
  └── Prometheus + Grafana monitoring

Docker Containers (orchestrated)
  │
  ├── User namespace isolation
  ├── Per-user Docker networks
  ├── AppArmor/Seccomp profiles
  └── Resource limits + auto-scaling
```

---

## 2. COMPONENT-BY-COMPONENT VALIDATION

### 2.1 FRONTEND

| Aspect | Recommended | Our Implementation | Verdict |
|--------|------------|-------------------|---------|
| **Framework** | React SPA or Next.js | React SPA (Vite + React Router) | ✅ GOOD — SPA is correct for dashboard apps |
| **Routing** | React Router / Next.js pages | React Router v6 with nested layouts | ✅ GOOD |
| **State Mgmt** | Context/Zustand + React Query | AuthContext + React Query (TanStack) | ✅ GOOD |
| **Auth** | Supabase client-side auth | Supabase `onAuthStateChange` + JWT | ✅ GOOD |
| **API Layer** | Centralized API client with interceptors | `api.ts` with `apiCall()` wrapper, auto-JWT | ✅ GOOD |
| **Code Splitting** | React.lazy/Suspense | ❌ All pages eager-loaded (604KB bundle) | ⚠️ NEEDS FIX |
| **TypeScript** | Full TypeScript | ✅ TypeScript throughout | ✅ GOOD |
| **Protected Routes** | Auth guards | `ProtectedRoute` + `PremiumGuard` | ✅ GOOD |
| **Toast/UX** | Toast notifications | Sonner toast library | ✅ GOOD |
| **OAuth Popup** | `window.open` → `postMessage` → `close()` | ✅ Implemented (just fixed) | ✅ GOOD |
| **Error Boundaries** | React Error Boundaries | ❌ Missing | ⚠️ NEEDS FIX |

**Frontend Score: 8/10** — Solid SPA architecture. Needs code splitting and error boundaries.

---

### 2.2 BACKEND

| Aspect | Recommended | Our Implementation | Verdict |
|--------|------------|-------------------|---------|
| **Framework** | Express monolith (fine for <1000 users) | Express.js monolith | ✅ GOOD |
| **Auth Middleware** | JWT validation per request | `authMiddleware` creates Supabase client per request, validates JWT | ✅ GOOD |
| **Rate Limiting** | Per-endpoint rate limits | `express-rate-limit`: 100/15min API, 20/15min auth | ✅ GOOD |
| **Security Headers** | Helmet.js | ✅ `helmet()` middleware | ✅ GOOD |
| **CORS** | Whitelist origins | ✅ Production whitelist + dev origins | ✅ GOOD |
| **Request Logging** | Structured logging (Winston/Pino) | Custom Winston logger with structured JSON | ✅ GOOD |
| **Error Handling** | Global error handler | ✅ 404 handler + global error middleware | ✅ GOOD |
| **Body Parsing** | Size limits | ✅ `express.json({ limit: '10mb' })` | ✅ GOOD |
| **Docker Mgmt** | Docker API client (dockerode) | ✅ `dockerode` for inspect + `exec()` for compose | ⚠️ MIXED |
| **Container Restart** | Debounced, health-aware | ✅ `scheduleDebouncedRestart()` with health polling | ✅ EXCELLENT |
| **Config File Mgmt** | File locking for concurrent writes | ✅ `withConfigLock()` using proper-lockfile | ✅ EXCELLENT |
| **Background Jobs** | BullMQ/Redis queues | Simple `setInterval` for token refresh | ⚠️ OK FOR NOW |
| **WebSocket** | Socket.io or ws library | ✅ `ws` library on same HTTP server | ✅ GOOD |
| **Input Validation** | Joi/Zod schemas | ❌ Manual if-checks only | ⚠️ NEEDS FIX |
| **Health Check** | `/health` endpoint | ✅ `/api/health` with uptime + env | ✅ GOOD |

**Backend Score: 8/10** — Solid monolith. Needs input validation library and Docker API migration.

---

### 2.3 SERVER / INFRASTRUCTURE

| Aspect | Recommended | Our Implementation | Verdict |
|--------|------------|-------------------|---------|
| **Hosting** | DigitalOcean droplet (fine for MVP) | ✅ DO droplet, Mumbai region | ✅ GOOD |
| **Reverse Proxy** | Nginx with dynamic upstreams | ✅ Nginx with `/api/*` and `/ws/*` proxy | ✅ GOOD |
| **SSL** | Let's Encrypt auto-renew | ✅ Certbot with auto-renew | ✅ GOOD |
| **Process Manager** | PM2 with clustering | PM2 single fork mode | ⚠️ OK (cluster at scale) |
| **WebSocket Proxy** | Upgrade headers + long timeout | ✅ `proxy_read_timeout 86400` | ✅ GOOD |
| **Static Caching** | Cache-Control headers | ✅ 30d immutable for assets | ✅ GOOD |
| **SPA Fallback** | `try_files` | ✅ `try_files $uri $uri/ /index.html` | ✅ GOOD |
| **Docker Compose** | Per-user compose files | ✅ One `docker-compose.yml` per employee | ✅ GOOD |
| **Container Limits** | CPU + Memory limits | ✅ 2GB RAM, 0.8 CPU, 3GB swap | ✅ GOOD |
| **Container Health** | Docker HEALTHCHECK | ✅ `curl -f http://localhost:18789/health` | ✅ GOOD |
| **Container Restart** | `restart: always` policy | ✅ Docker restart + PM2 restart | ✅ GOOD |
| **Log Rotation** | json-file with max-size | ✅ `max-size: 10m`, `max-file: 3` | ✅ GOOD |
| **Monitoring** | Prometheus + Grafana | ❌ No monitoring stack | 🔴 NEEDS FIX (production) |
| **Backups** | Automated DB + volume backups | ❌ Supabase handles DB, no volume backups | ⚠️ NEEDS PLAN |
| **Firewall** | UFW rules | ❌ Not verified | ⚠️ CHECK |

**Server Score: 7.5/10** — Good for MVP. Needs monitoring and backup strategy for production.

---

### 2.4 DATABASE (Supabase)

| Aspect | Recommended | Our Implementation | Verdict |
|--------|------------|-------------------|---------|
| **Engine** | PostgreSQL | ✅ Supabase PostgreSQL | ✅ GOOD |
| **RLS Enabled** | All tables | ✅ All 6 tables have RLS | ✅ GOOD |
| **RLS Performance** | Use `(select auth.uid())` | ❌ Using `auth.uid()` directly (15 policies affected) | 🔴 NEEDS FIX |
| **Connection Pooling** | PgBouncer | ✅ Supabase-managed PgBouncer | ✅ GOOD |
| **Foreign Keys** | Indexed | ❌ `employee_skills.skill_id` unindexed | ⚠️ NEEDS FIX |
| **Schema Design** | Normalized with check constraints | ✅ Check constraints on status, plan, provider | ✅ GOOD |
| **Encryption** | AES-256 for secrets | ✅ Custom AES encryption for API keys, tokens | ✅ GOOD |
| **Leaked Password Protection** | Enabled | ❌ Disabled | 🔴 NEEDS FIX |
| **Function Search Path** | Immutable | ❌ `get_next_port` has mutable search_path | ⚠️ NEEDS FIX |
| **Unused Indexes** | Clean up | 2 unused indexes (idx_profiles_stripe_customer, idx_employees_subdomain) | ⚠️ MINOR |

**Database Score: 7/10** — Good schema, RLS everywhere. Performance and security advisors need attention.

---

### 2.5 SECURITY

| Aspect | Recommended | Our Implementation | Verdict |
|--------|------------|-------------------|---------|
| **Auth** | JWT with short expiry | ✅ Supabase JWT (1hr expiry, auto-refresh) | ✅ GOOD |
| **CSRF Protection** | State tokens for OAuth | ✅ Random state tokens, in-memory store | ✅ GOOD |
| **XSS Protection** | Helmet + CSP | ✅ Helmet.js (default CSP) | ✅ GOOD |
| **Secrets Storage** | Vault / encrypted in DB | ✅ AES-encrypted in Supabase, .env for server secrets | ✅ GOOD |
| **API Key in Logs** | Truncated/masked | ✅ `key_preview: api_key.slice(0, 7) + '...'` | ✅ GOOD |
| **Container Isolation** | User namespaces, seccomp | ❌ Default Docker isolation only | ⚠️ HARDEN |
| **Docker Socket** | Restricted access | Backend runs as root with full Docker access | ⚠️ RISKY |
| **Network Isolation** | Per-user Docker networks | ❌ Default bridge network | ⚠️ NEEDS FIX |
| **Input Sanitization** | Zod/Joi validation | ❌ Manual checks only | ⚠️ NEEDS FIX |
| **Telegram Token Validation** | Format check | ✅ Regex validation | ✅ GOOD |

**Security Score: 7/10** — Auth and encryption solid. Container isolation and input validation need hardening.

---

## 3. CRITICAL ISSUES (Must Fix Before Production)

### 🔴 P0 — Fix Immediately

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **RLS policies use `auth.uid()` instead of `(select auth.uid())`** | Re-evaluates per row = slow queries at scale (15 policies affected) | SQL migration to wrap in `(select ...)` |
| 2 | **Leaked password protection disabled** | Users can use compromised passwords | Enable in Supabase Auth settings |
| 3 | **No monitoring/alerting** | Blind to container crashes, resource exhaustion | Add at minimum: UptimeRobot for health checks |

### ⚠️ P1 — Fix Before Scaling

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 4 | **No input validation library** | Risk of injection, bad data | Add Zod schemas to all API routes |
| 5 | **Missing index on `employee_skills.skill_id`** | Slow joins at scale | `CREATE INDEX` |
| 6 | **No error boundaries in frontend** | White screen on React crash | Add `ErrorBoundary` component |
| 7 | **No code splitting** | 604KB bundle, slow initial load | `React.lazy()` for route-level splitting |
| 8 | **`get_next_port` function search path mutable** | Potential SQL injection vector | Set `search_path = ''` |
| 9 | **Docker socket exposed to backend** | If backend compromised, full host access | Run backend as non-root, use Docker proxy |
| 10 | **No per-user Docker networks** | Containers can see each other's traffic | `docker network create` per user |

---

## 4. OVERALL RELIABILITY SCORECARD

| Layer | Score | Status |
|-------|-------|--------|
| **Frontend** | 8/10 | ✅ Production-ready with minor improvements |
| **Backend** | 8/10 | ✅ Production-ready with minor improvements |
| **Server/Infra** | 7.5/10 | ⚠️ Needs monitoring before production |
| **Database** | 7/10 | ⚠️ RLS performance fix needed |
| **Security** | 7/10 | ⚠️ Container hardening needed |
| **OVERALL** | **7.5/10** | **⚠️ Good MVP — needs P0 fixes for production** |

---

## 5. WHAT WE GOT RIGHT (Strengths)

1. **Clean monolith architecture** — Correct for current scale, easy to maintain
2. **Supabase Auth + RLS** — Proper multi-tenant isolation at DB level
3. **Docker Compose per employee** — Good isolation, easy lifecycle management
4. **Debounced container restarts** — Prevents restart storms from rapid config changes
5. **File locking for config** — Prevents race conditions on openclaw.json
6. **Encrypted secrets** — API keys, bot tokens, OAuth tokens all AES-encrypted
7. **Structured logging** — Winston with JSON, timestamps, metadata
8. **OAuth popup flow** — Proper `window.open` → `postMessage` → `close()` pattern
9. **Health checks** — Both backend `/api/health` and Docker HEALTHCHECK
10. **SSL + CORS + Helmet** — Standard web security in place

---

## 6. ACTION PLAN

### Phase 1: P0 Fixes (Do Now)
- [ ] Fix RLS policies (`auth.uid()` → `(select auth.uid())`)
- [ ] Enable leaked password protection in Supabase
- [ ] Add UptimeRobot for `/api/health` monitoring
- [ ] Add missing foreign key index

### Phase 2: P1 Hardening (Before Scaling)
- [ ] Add Zod validation to API routes
- [ ] Add React Error Boundaries
- [ ] Add code splitting (React.lazy)
- [ ] Fix `get_next_port` search path
- [ ] Harden Docker: per-user networks, non-root backend

### Phase 3: Scale Preparation (When Needed)
- [ ] Add Prometheus + Grafana monitoring
- [ ] Add Redis + BullMQ for job queues
- [ ] PM2 cluster mode
- [ ] Volume backup strategy
- [ ] Consider Kubernetes migration at >50 users
