# Production Readiness Report — LikelyClaw

**Date:** July 2025  
**Scope:** Full backend + frontend codebase audit  
**Verdict:** ⚠️ **Conditionally Production-Ready** — 3 crash risks, 6 medium issues, several low-priority items

---

## Executive Summary

The application is **functional and deployable** but has **3 issues that can cause crashes or broken behavior in production**, plus several medium-severity items that should be addressed. The codebase is generally well-structured with consistent error handling, proper auth middleware, and good logging. The main risks are dead code references, stale integration logic, and a variable shadowing bug.

---

## 🔴 CRITICAL — Crash / Data-Loss Risks

### C1. Variable Shadowing in `provisionContainer()` — `res` overwritten
**File:** `backend/src/routes/employees.js` line 633  
**Issue:** The variable `res` is declared as `const res = PLAN_RESOURCES[plan] || PLAN_RESOURCES.basic;` inside `provisionContainer()`. However, `provisionContainer()` is called from the `POST /` route handler which also has `res` (Express response) in its outer scope. While `provisionContainer` runs in background (after `res.status(201).json(...)` already sent), if any code path inside `provisionContainer` accidentally references the Express `res` after line 633, it would get the wrong object. This is a **naming hazard** that could cause confusing bugs.  
**Severity:** 🟡 Medium-High (no crash today, but fragile)  
**Fix:** Rename the variable to `resources` or `planRes`.

### C2. `oauth.js` references undefined `allScopes` in callback
**File:** `backend/src/routes/oauth.js` line 219  
**Issue:** In the `GET /google/callback` handler, line 219 references `allScopes` as a fallback: `const grantedScopes = tokenData.scope ? tokenData.scope.split(' ') : allScopes;`. But `allScopes` is only defined in the `GET /google/start` handler — it does **not exist** in the callback scope. If `tokenData.scope` is falsy, this will throw a `ReferenceError` and crash the callback, leaving the user stuck.  
**Severity:** 🔴 Critical (crash on OAuth callback if scope field missing)  
**Fix:** Replace `allScopes` with a fallback like `Object.values(SCOPES_BY_SKILL).flat()` or simply `[]`.

### C3. Frontend `api.ts` — MCP endpoints reference disabled backend routes
**File:** `frontend/src/lib/api.ts` lines 90-99  
**Issue:** Three API functions (`configureMcp`, `getMcpServers`, `removeMcpServer`) call backend endpoints that are **commented out** in `marketplace.js` (lines 564-720). If any frontend code calls these, the backend will return 404, causing unhandled errors. The `Chat.tsx` page also references MCP servers in its logic.  
**Severity:** 🟡 Medium (404 errors, not crashes — but confusing UX)  
**Fix:** Either remove these from `api.ts` or add `// disabled` comments. Verify no active UI calls them.

---

## 🟡 MEDIUM — Functional / Security Issues

### M1. `chat.js` — Stale tool hints reference direct Gmail/Calendar scripts
**File:** `backend/src/routes/chat.js` lines 47-73  
**Issue:** `INTEGRATION_TOOL_HINTS` still references `gmail-tools/` and `calendar-tools/` scripts (e.g., `node gmail-tools/check_emails.js`). These scripts were part of the direct Google OAuth flow which has been disabled. The agent now uses Composio integrations. When a user chats via the web dashboard with Gmail/Calendar connected, the agent receives **stale instructions** pointing to non-existent scripts.  
**Severity:** 🟡 Medium (agent will fail silently or hallucinate tool usage)  
**Fix:** Update hints to reference Composio tool commands (`integrations` command) matching the updated `IDENTITY.md` template.

### M2. `integrations.js` — Disconnect route still handles `direct-oauth-` prefix
**File:** `backend/src/routes/integrations.js` lines 344-353  
**Issue:** The disconnect handler checks `connectionId.startsWith('direct-oauth-')` and deletes OAuth tokens. Since direct OAuth is disabled, this code path is dead but harmless. However, it creates confusion about which OAuth flow is active.  
**Severity:** 🟢 Low (dead code, no crash)  
**Fix:** Remove the `isDirectOAuth` branch or add a comment that it's legacy.

### M3. Webhook signature verification is optional
**File:** `backend/src/routes/billing.js` lines 174-183  
**Issue:** The Razorpay webhook handler only verifies the signature if `RAZORPAY_WEBHOOK_SECRET` is set. If the env var is missing, **any request** to `/api/billing/webhook` can trigger plan changes, container stops, etc. This is a **security risk** in production.  
**Severity:** 🟡 Medium-High (security — allows forged webhooks)  
**Fix:** Make webhook secret required in production. Return 401 if missing.

### M4. `preview.js` — No authentication on file serving
**File:** `backend/src/routes/preview.js` lines 13-14  
**Issue:** The comment says "No auth required — preview links are shareable." While directory traversal is prevented, this means **anyone** can enumerate employee IDs and browse all user-generated project files. The employee ID is a UUID (hard to guess), but once known, all files are exposed.  
**Severity:** 🟡 Medium (information disclosure if UUID leaks)  
**Fix:** Consider adding optional auth or rate limiting on preview routes.

### M5. `vapi.js` — Webhook has no authentication
**File:** `backend/src/routes/vapi.js` lines 61-62  
**Issue:** The VAPI webhook endpoint has no signature verification or shared secret. Anyone who knows an employee ID can send fake webhook events, triggering activity log entries and potentially sending messages to containers.  
**Severity:** 🟡 Medium (spoofable webhooks)  
**Fix:** Add VAPI webhook signature verification or a shared secret header check.

### M6. `employees.js` — `execPromise` used for shell commands without sanitization
**File:** `backend/src/routes/employees.js` line 40-47, and various `execSync`/`execPromise` calls  
**Issue:** Several places use `exec()` with string interpolation for container names and paths. Container names are derived from UUIDs (safe), but the pattern is fragile. The `docker exec` calls in `chat.js` line 29 also use string interpolation.  
**Severity:** 🟢 Low (UUIDs are safe input, but pattern is risky)  
**Fix:** No immediate action needed, but consider using `execFile` for better safety.

---

## 🟢 LOW — Code Quality / Cleanup

### L1. Stale file: `frontend/src/pages/Untitled-1.txt`
**Issue:** Contains a PWA manifest JSON for "StartClaw" (old name). Should be deleted or moved to `public/manifest.json` with updated branding.

### L2. Temporary test scripts in backend root
**Files:** `backend/tmp-fix-identity.py`, `backend/tmp-fix-all-identity.py`, `backend/tmp-test-gmail.js`, `backend/tmp-test-composio.js`  
**Issue:** These are development/debugging scripts that should not be deployed to production. They contain hardcoded API keys and test logic.  
**Fix:** Delete before production deployment or add to `.gitignore`.

### L3. `oauth.js` and `token-refresh.js` — Fully disabled but still in codebase
**Issue:** These files implement direct Google OAuth which is disabled (routes commented out in `server.js`). They still run the `pendingOAuthStates` cleanup interval (line 54-61 in `oauth.js`) even though the routes are never mounted.  
**Fix:** Since routes aren't mounted in `server.js`, the interval doesn't run. No action needed, but consider deleting or archiving these files.

### L4. `Chat.tsx` and `chatStore.ts` — Chat feature disabled but code remains
**Issue:** The `/chat` route exists in `App.tsx` but is commented out in `Layout.tsx` navigation. The chat store, SSE streaming, and full chat UI are still in the bundle, adding ~15KB to the frontend build.  
**Fix:** Either remove from the route config or keep for future re-enablement. Not a production risk.

### L5. `OAuthCallback.tsx` — References direct Google OAuth flow
**Issue:** This page handles `?success=true` and `?error=...` params from the old direct Google OAuth callback. Since OAuth now goes through Composio (which redirects to `/integrations?connected=...`), this page is only reached for edge cases. It still works but shows "Google account linked to skill" messaging that's outdated.  
**Fix:** Low priority — the page gracefully handles all states.

### L6. Duplicate `PROVIDER_CONFIG` definitions
**Files:** `employees.js` (lines 367-392) and `settings.js` (lines 89-114)  
**Issue:** The same provider/model configuration is defined in two places. If models are updated in one place but not the other, they'll diverge.  
**Fix:** Extract to a shared config module.

### L7. `employees.js` — Post-provision cleanup removes `gmail-tools/` and `calendar-tools/`
**File:** `backend/src/routes/employees.js` line 678  
**Issue:** The cleanup command removes `gmail-tools` and `calendar-tools` directories, which is correct since they're no longer used. However, if a user has the Gmail skill installed (which copies `gmail-tools/` from templates), the cleanup will delete the skill's tools immediately after provisioning.  
**Fix:** Only remove deprecated tool directories, not active skill directories. Or ensure skill injection happens after cleanup.

---

## ✅ What's Working Well

### Backend Strengths
- **Consistent error handling:** Every route has try/catch with proper HTTP status codes and logger calls
- **Auth middleware:** Properly validates JWT tokens and creates per-request Supabase clients with RLS
- **Encryption:** AES-256 for API keys, tokens, and credentials with proper key validation
- **File locking:** Atomic read-modify-write for config files prevents race conditions
- **Debounced restarts:** Container restarts are debounced to prevent excessive Docker operations
- **Graceful shutdown:** PM2 process handles SIGTERM/SIGINT with cleanup
- **Rate limiting:** Global rate limiter configured in `server.js`
- **Helmet security headers:** Properly configured with CSP, HSTS, etc.
- **Activity logging:** Comprehensive audit trail for all user actions

### Frontend Strengths
- **Auth flow:** Proper session management with Supabase auth state listener
- **Protected routes:** Both `ProtectedRoute` (auth) and `PremiumGuard` (plan) work correctly
- **TanStack Query:** Proper cache invalidation, stale times, and error handling
- **Responsive design:** Mobile sidebar, responsive grids, proper touch targets
- **Loading states:** Skeleton loaders throughout, no blank screens during data fetch
- **Error boundaries:** Toast notifications for all API errors with user-friendly messages
- **Type safety:** TypeScript interfaces for all API responses

### Infrastructure Strengths
- **Docker isolation:** Each employee runs in its own container with resource limits
- **Health checks:** Container health polling with configurable intervals
- **Nginx integration:** Automatic subdomain mapping with file locking
- **Redis SSE:** Reliable event streaming with replay capability
- **WebSocket pool:** Persistent connections with queue management

---

## Recommended Priority Actions

| Priority | Item | Effort |
|----------|------|--------|
| 🔴 P0 | Fix `oauth.js` `allScopes` ReferenceError (C2) | 5 min |
| 🔴 P0 | Rename `res` variable shadowing in `employees.js` (C1) | 2 min |
| 🟡 P1 | Make webhook secret required in production (M3) | 10 min |
| 🟡 P1 | Update `chat.js` tool hints to Composio (M1) | 15 min |
| 🟡 P1 | Add VAPI webhook auth (M5) | 20 min |
| 🟢 P2 | Remove disabled MCP API functions from `api.ts` (C3) | 5 min |
| 🟢 P2 | Delete temp test scripts (L2) | 2 min |
| 🟢 P2 | Delete `Untitled-1.txt` (L1) | 1 min |
| 🟢 P3 | Extract shared `PROVIDER_CONFIG` (L6) | 15 min |
| 🟢 P3 | Fix post-provision cleanup vs skill tools conflict (L7) | 10 min |

---

## Conclusion

The application is **production-ready with caveats**. The two critical items (C1, C2) should be fixed before any further deployment. The webhook security issues (M3, M5) should be addressed soon. Everything else is cleanup that can be done incrementally.

The overall code quality is **good** — consistent patterns, proper error handling, and thoughtful architecture. The main technical debt comes from the Google OAuth → Composio migration leaving some stale references.
