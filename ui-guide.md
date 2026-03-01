# ClawCloud — Complete UI Guide & Setup Walkthrough

> This file explains the ENTIRE frontend, every screen, how they connect to the backend,
> and a step-by-step setup guide for all external services.
> Written for someone with zero experience.

---

## Table of Contents

**PART 1 — UI Concept & Architecture**
1. [What is the UI?](#1-what-is-the-ui)
2. [The Tech Stack — What Tools We Use](#2-the-tech-stack)
3. [How Frontend Talks to Backend](#3-how-frontend-talks-to-backend)
4. [Authentication Flow — How Login Works](#4-authentication-flow)

**PART 2 — Every Screen Explained**
5. [Screen Map — All 13 Screens](#5-screen-map)
6. [Screen 1: Landing Page](#screen-1-landing-page)
7. [Screen 2: Sign Up](#screen-2-sign-up)
8. [Screen 3: Login](#screen-3-login)
9. [Screen 4: Dashboard (Home)](#screen-4-dashboard)
10. [Screen 5: Create Employee](#screen-5-create-employee)
11. [Screen 6: Employee Detail](#screen-6-employee-detail)
12. [Screen 7: Connect WhatsApp](#screen-7-connect-whatsapp)
13. [Screen 8: Connect Telegram](#screen-8-connect-telegram)
14. [Screen 9: API Key Settings](#screen-9-api-key-settings)
15. [Screen 10: Skill Marketplace](#screen-10-skill-marketplace)
16. [Screen 11: Billing & Plans](#screen-11-billing)
17. [Screen 12: Activity Logs](#screen-12-activity-logs)
18. [Screen 13: Profile Settings](#screen-13-profile-settings)

**PART 3 — Best Practices**
19. [Frontend Best Practices for Reliability](#19-best-practices)

**PART 4 — Step-by-Step External Service Setup**
20. [Hostinger Domain + DNS Setup](#20-hostinger-setup)
21. [DigitalOcean VPS Setup (Server)](#21-digitalocean-setup)
22. [Razorpay Setup (Payments — India)](#22-razorpay-setup)
23. [Connecting Everything Together](#23-connecting-everything)

**PART 5 — Detailed UI Screen Flows**
24. [Complete Screen-by-Screen Breakdown](#24-detailed-ui-flows)

---

# PART 1 — UI Concept & Architecture

## 1. What is the UI?

The UI (User Interface) is the **website your customers see and use**. It's the visual layer — buttons, forms, dashboards, charts — that lets people interact with ClawCloud without knowing anything about Docker, servers, or OpenClaw.

### The Concept

```
Think of a RESTAURANT:

  THE KITCHEN (Backend):
    - Chefs cooking food
    - Dishwashers cleaning
    - Inventory management
    - Suppliers delivering ingredients
    → Customers NEVER see this

  THE DINING ROOM (Frontend/UI):
    - Beautiful decor
    - Menu with pictures
    - Waiters taking orders
    - Food served on nice plates
    → This is ALL the customer sees

  OUR APP:
    BACKEND (the kitchen):
      - Docker containers running
      - Database queries
      - Stripe payment processing
      - WebSocket QR code relaying
      → Users never see this

    FRONTEND/UI (the dining room):
      - Beautiful dashboard
      - "Create Employee" button
      - QR code displayed in branded page
      - Status indicators: "Connected ✅"
      → This is ALL the user sees
```

### Single Page Application (SPA)

Our frontend is an **SPA** — a Single Page Application. This means:

```
TRADITIONAL WEBSITE (like Wikipedia):
  Click a link → browser loads ENTIRE new page from server
  Click another link → loads another ENTIRE page
  Each click = full page reload = slow, flickery

SPA (what we build):
  App loads ONCE → then ONLY the content area changes
  Click "Dashboard" → just the middle section updates (instant)
  Click "Settings" → just the middle section changes (instant)
  No page reloads → fast, smooth, app-like feel

  It's like a mobile app but running in the browser.
```

---

## 2. The Tech Stack

### What Tools We Use to Build the UI

```
┌──────────────────────────────────────────────────────────────┐
│                     OUR FRONTEND STACK                        │
│                                                              │
│  React 18          → The framework (builds UI from components)│
│  TypeScript        → Language (catches bugs before runtime)   │
│  Vite              → Build tool (instant dev server)          │
│  TailwindCSS       → Styling ("bg-blue-500 p-4 rounded-lg")  │
│  shadcn/ui         → Pre-built components (Button, Card, etc)│
│  Lucide React      → Icons (clean, consistent)                │
│  React Router v6   → Navigation (/dashboard, /settings, etc) │
│  TanStack Query    → Data fetching (auto-cache, auto-refresh)│
│  Supabase Client   → Auth + database (signup, login, queries)│
│  Stripe.js         → Payment UI (checkout redirect)           │
│  qrcode.react      → QR code rendering (WhatsApp pairing)    │
│  Sonner/Toasts     → Notifications ("Saved!", "Error!")       │
└──────────────────────────────────────────────────────────────┘
```

### Why Each Tool?

```
React:
  WHY: Most popular UI library. Huge ecosystem, tons of resources.
  WHAT: You write "components" — reusable building blocks.
  EXAMPLE: A <Button> component used 50 times across the app.

TypeScript:
  WHY: Catches errors before you run the code.
  WITHOUT: You type "user.namee" (typo) → crashes at runtime.
  WITH:    Editor underlines "namee" in red → you fix it before saving.

Vite:
  WHY: Dev server starts in <1 second. Changes appear instantly.
  OLD: Create React App takes 10-30 seconds to start.

TailwindCSS:
  WHY: Write styles directly in HTML. No separate CSS files.
  OLD: <div class="my-custom-button"> then in CSS: .my-custom-button { ... }
  NEW: <div className="bg-blue-500 text-white px-4 py-2 rounded-lg">
  → Faster to write, easier to read, consistent spacing.

shadcn/ui:
  WHY: Beautiful, accessible components out of the box.
  → Button, Card, Dialog, Table, Input, Badge, Sidebar, etc.
  → You don't design from scratch. You use pre-built pieces.
  → Looks professional immediately.

TanStack Query (React Query):
  WHY: Manages all API calls + caching + loading states.
  WITHOUT: Manually manage loading/error/data for every API call.
  WITH: const { data, isLoading, error } = useQuery(['employees'], fetchEmployees);
  → Auto-refetches when tab refocuses. Auto-retries on failure. Caches data.
```

---

## 3. How Frontend Talks to Backend

### The Request Flow

```
USER CLICKS "Create Employee"
         │
         ▼
┌──────────────────────────────┐
│  REACT FRONTEND (browser)    │
│                              │
│  1. Get JWT token from       │
│     Supabase session         │
│  2. Send HTTP request:       │
│     POST /api/employees      │
│     Headers: {               │
│       Authorization:         │
│       "Bearer eyJhbGci..."   │
│     }                        │
│     Body: {                  │
│       name: "Assistant Amy"  │
│     }                        │
└──────────┬───────────────────┘
           │ HTTPS request
           ▼
┌──────────────────────────────┐
│  BACKEND API (Node.js)       │
│  http://localhost:3000       │
│                              │
│  1. Verify JWT token         │
│  2. Check plan limits        │
│  3. Assign port              │
│  4. Create DB record         │
│  5. Provision container      │
│  6. Return response          │
└──────────┬───────────────────┘
           │ JSON response
           ▼
┌──────────────────────────────┐
│  REACT FRONTEND              │
│                              │
│  1. Receive response         │
│  2. Show success toast:      │
│     "Employee created!"      │
│  3. Redirect to dashboard    │
│  4. New employee appears     │
│     in the list              │
└──────────────────────────────┘
```

### API Helper Code (What the Frontend Uses)

```typescript
// File: frontend/src/lib/api.ts

import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper: make authenticated API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Get the current user's JWT from Supabase
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// Specific API functions used by screens:
export const api = {
  // Auth
  getProfile: () => apiCall('/api/auth/me'),

  // Employees
  listEmployees: () => apiCall('/api/employees'),
  getEmployee: (id: string) => apiCall(`/api/employees/${id}`),
  createEmployee: (data: any) => apiCall('/api/employees', {
    method: 'POST', body: JSON.stringify(data)
  }),
  updateEmployee: (id: string, data: any) => apiCall(`/api/employees/${id}`, {
    method: 'PUT', body: JSON.stringify(data)
  }),
  deleteEmployee: (id: string) => apiCall(`/api/employees/${id}`, {
    method: 'DELETE'
  }),

  // Channels
  connectWhatsApp: (empId: string) => apiCall(`/api/connect/whatsapp/${empId}`, {
    method: 'POST'
  }),
  connectTelegram: (empId: string, token: string) => apiCall(`/api/connect/telegram/${empId}`, {
    method: 'POST', body: JSON.stringify({ token })
  }),

  // Settings
  saveApiKey: (api_key: string, provider: string) => apiCall('/api/settings/api-key', {
    method: 'PUT', body: JSON.stringify({ api_key, provider })
  }),

  // Marketplace
  listSkills: () => apiCall('/api/marketplace/skills'),
  installSkill: (employee_id: string, skill_id: string) => apiCall('/api/marketplace/install', {
    method: 'POST', body: JSON.stringify({ employee_id, skill_id })
  }),

  // Billing
  createCheckout: (plan: string) => apiCall('/api/billing/checkout', {
    method: 'POST', body: JSON.stringify({ plan })
  }),
  getSubscription: () => apiCall('/api/billing/subscription'),

  // Logs
  getLogs: (employeeId?: string) => apiCall(
    employeeId ? `/api/logs/${employeeId}` : '/api/logs'
  ),
};
```

---

## 4. Authentication Flow

### How Login/Signup Works End-to-End

```
SIGN UP FLOW:
═══════════════════════════════════════════════════════

  1. User fills email + password on /signup page
  2. Frontend calls: supabase.auth.signUp({ email, password })
  3. Supabase creates user in auth.users table
  4. Our DB trigger auto-creates profile in public.profiles
  5. Supabase sends verification email
  6. User clicks link in email → account verified
  7. User redirected to /login

LOGIN FLOW:
═══════════════════════════════════════════════════════

  1. User fills email + password on /login page
  2. Frontend calls: supabase.auth.signInWithPassword({ email, password })
  3. Supabase verifies credentials
  4. Supabase returns: { session: { access_token, refresh_token } }
  5. Token auto-stored in browser (Supabase client handles this)
  6. User redirected to /dashboard
  7. Every API call includes: Authorization: Bearer <access_token>

PROTECTED PAGES:
═══════════════════════════════════════════════════════

  User navigates to /dashboard
    → React Router checks: is user logged in?
    → If YES: show dashboard
    → If NO: redirect to /login

  How we check:
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) navigate('/login');

TOKEN REFRESH (automatic):
═══════════════════════════════════════════════════════

  Access tokens expire after 1 hour.
  But the Supabase client auto-refreshes using the refresh_token.
  User stays logged in without re-entering password.
  Only expires if they don't visit for 7+ days.
```

---

# PART 2 — Every Screen Explained

## 5. Screen Map — All 13 Screens

```
PUBLIC SCREENS (no login required):
  /                    → Landing Page (marketing + pricing)
  /signup              → Sign Up form
  /login               → Login form

PROTECTED SCREENS (login required):
  /dashboard           → Home dashboard (overview of all employees)
  /employees/new       → Create new AI employee
  /employees/:id       → Employee detail (settings, channels, skills)
  /connect/whatsapp/:id → WhatsApp QR code pairing
  /connect/telegram/:id → Telegram token input
  /settings/api-keys   → LLM API key management
  /marketplace         → Browse and install skills
  /billing             → Plans, subscription, upgrade
  /logs                → Activity logs / chat history
  /settings            → Profile, password, integrations
```

### Screen Flow Diagram (User Journey)

```
                         clawcloud.com
                         LANDING PAGE
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
               /signup              /login
               SIGN UP              LOG IN
                    │                   │
                    └─────────┬─────────┘
                              ▼
                         /dashboard
                        DASHBOARD ◄──────────────────┐
                              │                       │
              ┌───────┬───────┼───────┬───────┐      │
              ▼       ▼       ▼       ▼       ▼      │
         /employees  /settings /marketplace /billing /logs
          /new       /api-keys   SKILLS     PLANS   LOGS
         CREATE      API KEY    BROWSE     UPGRADE
         EMPLOYEE    SETUP     INSTALL
              │
              ▼
         /employees/:id
         EMPLOYEE DETAIL
              │
         ┌────┴────┐
         ▼         ▼
    /connect/   /connect/
    whatsapp    telegram
    QR CODE     TOKEN
```

---

## Screen 1: Landing Page

### Route: `/`

### What the User Sees

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR:  Logo   Features   Pricing   [Login] [Get Started]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│         YOUR AI EMPLOYEES, RUNNING 24/7                  │
│   Connect WhatsApp & Telegram bots powered by AI.        │
│   No servers. No code. Just results.                     │
│                                                          │
│              [Get Started — Free]                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  HOW IT WORKS:                                           │
│  1. Create an AI Employee                                │
│  2. Connect WhatsApp or Telegram                         │
│  3. Your bot replies 24/7                                │
├──────────────────────────────────────────────────────────┤
│  PRICING:                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐          │
│  │  Basic   │  │   Pro    │  │  Business     │          │
│  │  $20/mo  │  │  $35/mo  │  │  $75/mo       │          │
│  │ 1 employee│  │3 employees│  │10 employees   │          │
│  │ WhatsApp │  │ + Skills │  │ + Priority    │          │
│  │[Get Started]│[Get Started]│[Get Started]   │          │
│  └──────────┘  └──────────┘  └──────────────┘          │
├──────────────────────────────────────────────────────────┤
│  FOOTER: About | Privacy | Terms | Contact               │
└──────────────────────────────────────────────────────────┘
```

### Backend Connection: **NONE** (static page, no API calls)

### Key Design Choices
- Hero section with clear value proposition
- 3-step "How it works" section
- Pricing cards with CTA buttons
- Social proof / testimonials (add later)
- **Purpose**: Convert visitors → signups

---

## Screen 2: Sign Up

### Route: `/signup`

### What the User Sees

```
┌──────────────────────────────────────────┐
│                                          │
│         Create Your Account              │
│                                          │
│  Full Name:    [________________]        │
│  Email:        [________________]        │
│  Password:     [________________]        │
│  Confirm:      [________________]        │
│                                          │
│  [  Create Account  ]                    │
│                                          │
│  Already have an account? Log in         │
│                                          │
└──────────────────────────────────────────┘
```

### Backend Connection

```
Button Click → supabase.auth.signUp({ email, password, options: { data: { full_name } } })

Success → Show: "Check your email for verification link"
Error   → Show: "Email already registered" or "Password too weak"
```

### Validation Rules
- Email: valid format, not empty
- Password: minimum 8 characters
- Full name: not empty
- Confirm password: must match

---

## Screen 3: Login

### Route: `/login`

### What the User Sees

```
┌──────────────────────────────────────────┐
│                                          │
│         Welcome Back                     │
│                                          │
│  Email:        [________________]        │
│  Password:     [________________]        │
│                                          │
│  [  Log In  ]                            │
│                                          │
│  Forgot password?                        │
│  Don't have an account? Sign up          │
│                                          │
└──────────────────────────────────────────┘
```

### Backend Connection

```
Button Click → supabase.auth.signInWithPassword({ email, password })

Success → Redirect to /dashboard
Error   → Show: "Invalid email or password"
```

---

## Screen 4: Dashboard

### Route: `/dashboard`

### What the User Sees

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR:                          MAIN CONTENT:            │
│  ┌──────────┐                                               │
│  │ 🏠 Home  │    Welcome back, Sarah!                       │
│  │ 🤖 Employees│                                            │
│  │ 🛒 Market │    ┌─ QUICK STATS ────────────────────────┐ │
│  │ 💳 Billing│    │ Employees: 2/3  Plan: Pro  API: ✅    │ │
│  │ 📋 Logs   │    └──────────────────────────────────────┘ │
│  │ ⚙️ Settings│                                             │
│  │           │    ┌─ YOUR EMPLOYEES ─────────────────────┐ │
│  │           │    │                                       │ │
│  │           │    │ ┌─────────────────────────────────┐  │ │
│  │           │    │ │ 🤖 Assistant Amy     Running ✅  │  │ │
│  │           │    │ │    WhatsApp: ✅  Telegram: ❌    │  │ │
│  │           │    │ │    [Settings] [Logs]             │  │ │
│  │           │    │ └─────────────────────────────────┘  │ │
│  │           │    │                                       │ │
│  │           │    │ ┌─────────────────────────────────┐  │ │
│  │           │    │ │ 🤖 Marketing Mary  Running ✅    │  │ │
│  │           │    │ │    WhatsApp: ✅  Telegram: ✅    │  │ │
│  │           │    │ │    [Settings] [Logs]             │  │ │
│  │           │    │ └─────────────────────────────────┘  │ │
│  │           │    │                                       │ │
│  │           │    │ [+ Create New Employee]               │ │
│  │           │    └───────────────────────────────────────┘ │
│  │           │                                               │
│  │ [Logout]  │    ┌─ ONBOARDING CHECKLIST ───────────────┐ │
│  └──────────┘    │ ✅ Account created                     │ │
│                   │ ✅ API key configured                  │ │
│                   │ ✅ First employee created              │ │
│                   │ ⬜ Connect WhatsApp or Telegram        │ │
│                   └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Backend Connections

```
On Page Load:
  1. GET /api/auth/me           → Get profile (plan, has_api_key)
  2. GET /api/employees         → List all employees with status

Auto-refresh: TanStack Query refetches every 30 seconds

"Create New Employee" button → navigate to /employees/new
Employee card click          → navigate to /employees/:id
```

### This is the MOST IMPORTANT screen
- First thing users see after login
- Shows health of all their AI employees at a glance
- Onboarding checklist guides new users through setup
- Quick actions accessible from here

---

## Screen 5: Create Employee

### Route: `/employees/new`

### What the User Sees

```
┌──────────────────────────────────────────┐
│                                          │
│    Create New AI Employee                │
│                                          │
│  Name:          [________________]       │
│  Role:          [General     ▼]          │
│  System Prompt:                          │
│  [                                   ]   │
│  [  You are a helpful AI assistant   ]   │
│  [  that...                          ]   │
│  [                                   ]   │
│                                          │
│  Trigger Prefix: [________________]      │
│  (optional — e.g., "Marketing:")         │
│                                          │
│  [ Cancel ]  [ Create Employee ]         │
│                                          │
└──────────────────────────────────────────┘
```

### Backend Connection

```
"Create Employee" click →
  POST /api/employees
  Body: { name, role, system_prompt, trigger_prefix }

Success → Toast: "Assistant Amy created!"
        → Redirect to /employees/:newId
        → Container provisioning starts (0-30 sec)

Error   → "Your plan allows 1 employee. Upgrade to add more."
```

---

## Screen 6: Employee Detail

### Route: `/employees/:id`

### What the User Sees

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ← Back    Assistant Amy    Status: Running ✅            │
│                                                          │
│  ┌─ CHANNELS ────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  WhatsApp:  Connected ✅   [Disconnect]            │  │
│  │  Telegram:  Not Connected  [Connect Telegram]      │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ SETTINGS ────────────────────────────────────────┐  │
│  │  Name:     [Assistant Amy_____]                    │  │
│  │  Role:     [General     ▼]                         │  │
│  │  Prompt:   [You are a helpful...]                  │  │
│  │  Trigger:  [________________]                      │  │
│  │                                                    │  │
│  │  [Save Changes]                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ INSTALLED SKILLS ────────────────────────────────┐  │
│  │  🧠 General AI Chat  (built-in)                   │  │
│  │  🌤️ Weather          [Remove]                     │  │
│  │  [+ Add Skills from Marketplace]                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ DANGER ZONE ─────────────────────────────────────┐  │
│  │  [🗑️ Delete Employee]  (stops container, removes data)│
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Backend Connections

```
On Load:
  GET /api/employees/:id               → Employee details + skills
  GET /api/marketplace/installed/:id   → Installed skills

Save Changes:
  PUT /api/employees/:id  → { name, role, system_prompt, trigger_prefix }

Connect WhatsApp:    → navigate to /connect/whatsapp/:id
Connect Telegram:    → navigate to /connect/telegram/:id
Delete Employee:     → DELETE /api/employees/:id (with confirm dialog)
```

---

## Screen 7: Connect WhatsApp

### Route: `/connect/whatsapp/:id`

### What the User Sees (3 stages)

```
STAGE 1 — Loading:
┌──────────────────────────────────────────┐
│                                          │
│    Connect WhatsApp                      │
│                                          │
│    ⏳ Connecting to your AI agent...     │
│    Please wait...                        │
│                                          │
└──────────────────────────────────────────┘

STAGE 2 — QR Code:
┌──────────────────────────────────────────┐
│                                          │
│    Scan QR Code with WhatsApp            │
│                                          │
│    1. Open WhatsApp on your phone        │
│    2. Tap ⋮ Menu → Linked Devices        │
│    3. Tap "Link a Device"                │
│    4. Scan this QR code:                 │
│                                          │
│         ┌────────────────┐               │
│         │  ██▀▀██▀▀██    │               │
│         │  ██  ██  ██    │  ← QR CODE    │
│         │  ██▄▄██▄▄██    │    (updates   │
│         │  ██▀▀██▀▀██    │     every     │
│         │  ██  ██  ██    │     ~60 sec)  │
│         └────────────────┘               │
│                                          │
│    QR expires in: 45 seconds             │
│    [↻ Refresh QR Code]                   │
│                                          │
└──────────────────────────────────────────┘

STAGE 3 — Success:
┌──────────────────────────────────────────┐
│                                          │
│    ✅ WhatsApp Connected!                │
│                                          │
│    Your AI employee is now live on       │
│    WhatsApp. Try sending a message!      │
│                                          │
│    [Go to Dashboard]                     │
│                                          │
└──────────────────────────────────────────┘
```

### Backend Connection (WebSocket!)

```
This is the ONLY screen that uses WebSocket instead of REST API.

Step 1: POST /api/connect/whatsapp/:id
  → Returns: { ws_url: "ws://localhost:3000/ws/whatsapp/emp_123" }

Step 2: Frontend opens WebSocket to ws_url with ?token=<jwt>
  → Backend connects to container's WebSocket
  → Container generates QR via Baileys

Step 3: Backend relays QR data to frontend
  → Frontend renders QR using qrcode.react library
  → QR updates every ~60 seconds

Step 4: User scans QR with phone
  → Container confirms connection
  → Backend sends { type: "connected" } to frontend
  → Frontend shows success screen

Code:
  const ws = new WebSocket(`${wsUrl}?token=${session.access_token}`);
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'qr') setQrData(msg.qrData);
    if (msg.type === 'connected') setStatus('connected');
  };
```

---

## Screen 8: Connect Telegram

### Route: `/connect/telegram/:id`

### What the User Sees

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    Connect Telegram Bot                                  │
│                                                          │
│    Step 1: Create a bot on Telegram                      │
│    ─────────────────────────────────                     │
│    1. Open Telegram on your phone                        │
│    2. Search for @BotFather                              │
│    3. Send: /newbot                                      │
│    4. Choose a name (e.g., "My AI Assistant")            │
│    5. Choose a username (must end in "bot")              │
│    6. Copy the bot token BotFather gives you             │
│                                                          │
│    Step 2: Paste the token here                          │
│    ─────────────────────────────                         │
│    Bot Token: [7123456789:AAH3k5Lz1PxR9mN______]        │
│                                                          │
│    [ Connect Telegram ]                                  │
│                                                          │
│    ℹ️ Your token is encrypted and stored securely.       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Backend Connection

```
"Connect Telegram" click →
  POST /api/connect/telegram/:id
  Body: { token: "7123456789:AAH3k5Lz..." }

Backend:
  1. Validates token format
  2. Encrypts with AES-256
  3. Writes to container config
  4. Restarts container
  5. Container connects to Telegram API

Success → Toast: "Telegram connected!"
        → Redirect to /employees/:id
```

---

## Screen 9: API Key Settings

### Route: `/settings/api-keys`

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    AI API Key Settings                                   │
│                                                          │
│    Your AI employees use YOUR API key to generate        │
│    responses. You pay the AI provider directly.          │
│                                                          │
│    Provider:  ( ) OpenAI  (•) Anthropic  ( ) Google      │
│                                                          │
│    API Key:   [sk-proj-abc123________________]           │
│               ⚠️ Current: sk-proj-...abc (saved)         │
│                                                          │
│    [ Save API Key ]                                      │
│                                                          │
│    ─────────────────────────────────────────────         │
│    Where to get your key:                                │
│    • OpenAI: platform.openai.com/api-keys                │
│    • Anthropic: console.anthropic.com/settings/keys      │
│    • Google: aistudio.google.com/apikey                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Backend Connection

```
"Save API Key" click →
  PUT /api/settings/api-key
  Body: { api_key: "sk-proj-...", provider: "openai" }

Backend: encrypts key → updates all running containers → restarts them
```

---

## Screen 10: Skill Marketplace

### Route: `/marketplace`

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    Skill Marketplace                                     │
│                                                          │
│    Add capabilities to your AI employees                 │
│                                                          │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│    │ 💻 Coding │  │ 🌐 Browser│  │ 📅 Calendar│           │
│    │ $5/mo    │  │ $5/mo    │  │ Free     │            │
│    │ [Install]│  │ [Install]│  │ [Install]│            │
│    └──────────┘  └──────────┘  └──────────┘            │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│    │ 📧 Gmail  │  │ 🌤️ Weather│  │ 📰 News  │           │
│    │ $3/mo    │  │ Free     │  │ Free     │            │
│    │ [Install]│  │ [Install]│  │ [Install]│            │
│    └──────────┘  └──────────┘  └──────────┘            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Backend Connection

```
On Load:  GET /api/marketplace/skills
Install:  POST /api/marketplace/install { employee_id, skill_id }
```

---

## Screen 11: Billing

### Route: `/billing`

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    Billing & Plans                                       │
│                                                          │
│    Current Plan: Pro ($35/mo)                            │
│    Next billing: March 7, 2026                           │
│    [Manage Subscription]  (opens Stripe portal)          │
│                                                          │
│    ┌──────────┐  ┌──────────┐  ┌──────────────┐        │
│    │  Basic   │  │  ★ Pro   │  │  Business     │        │
│    │  $20/mo  │  │  $35/mo  │  │  $75/mo       │        │
│    │ 1 empl.  │  │ 3 empl.  │  │ 10 empl.      │        │
│    │[Downgrade]│  │ Current  │  │ [Upgrade]     │        │
│    └──────────┘  └──────────┘  └──────────────┘        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Backend Connection

```
On Load:      GET /api/billing/subscription
Upgrade:      POST /api/billing/checkout { plan: "business" }
              → Returns Stripe URL → redirect user to Stripe payment page
Manage:       POST /api/billing/portal
              → Returns Stripe portal URL → user manages subscription there
```

---

## Screen 12: Activity Logs

### Route: `/logs`

```
┌──────────────────────────────────────────────────────────┐
│    Activity Logs                                         │
│    Filter: [All Employees ▼]  [All Actions ▼]            │
│                                                          │
│    ┌───────┬──────────────┬─────────────┬────────────┐  │
│    │ Time  │ Employee     │ Action      │ Status     │  │
│    ├───────┼──────────────┼─────────────┼────────────┤  │
│    │ 5m ago│ Assistant Amy│ whatsapp.msg│ ✅ success  │  │
│    │ 10m   │ Assistant Amy│ whatsapp.msg│ ✅ success  │  │
│    │ 1h    │ Marketing M. │ telegram.msg│ ✅ success  │  │
│    │ 2h    │ Assistant Amy│ skill.install│ ✅ success │  │
│    │ 3h    │ —            │ api_key.save│ ✅ success  │  │
│    └───────┴──────────────┴─────────────┴────────────┘  │
│    [Load More]                                           │
└──────────────────────────────────────────────────────────┘
```

### Backend Connection

```
On Load: GET /api/logs?limit=50
Filter:  GET /api/logs/:employeeId?limit=50
```

---

## Screen 13: Profile Settings

### Route: `/settings`

```
┌──────────────────────────────────────────────────────────┐
│    Profile Settings                                      │
│                                                          │
│    Full Name:  [Sarah Johnson_____]                      │
│    Email:      sarah@gmail.com (cannot change)           │
│                                                          │
│    [Save Profile]                                        │
│                                                          │
│    ── Change Password ──                                 │
│    [Send Password Reset Email]                           │
│                                                          │
│    ── Danger Zone ──                                     │
│    [Delete Account]  (deletes all data and containers)   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

# PART 3 — Best Practices

## 19. Best Practices for Reliability

### 1. Loading States — ALWAYS show feedback

```
BAD:  User clicks button → nothing happens for 3 seconds → "did it work?"
GOOD: User clicks button → button shows spinner → "Creating..." → "Created! ✅"

Code pattern:
  const [isLoading, setIsLoading] = useState(false);

  async function handleCreate() {
    setIsLoading(true);
    try {
      await api.createEmployee(data);
      toast.success('Employee created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  <Button disabled={isLoading}>
    {isLoading ? <Spinner /> : 'Create Employee'}
  </Button>
```

### 2. Error Handling — ALWAYS catch and display errors

```
BAD:  API fails → white screen, console error nobody sees
GOOD: API fails → red toast: "Failed to create employee. Try again."

Every API call should be wrapped in try/catch.
Every catch should show a user-friendly error message.
```

### 3. Optimistic Updates — Make the UI feel instant

```
When user toggles something:
  1. Update the UI IMMEDIATELY (assume success)
  2. Send API request in background
  3. If API fails → revert the UI change + show error

This makes the app feel 10x faster.
```

### 4. Auto-Refresh — Keep data fresh

```
TanStack Query handles this:
  const { data } = useQuery({
    queryKey: ['employees'],
    queryFn: api.listEmployees,
    refetchInterval: 30000,      // Refresh every 30 seconds
    refetchOnWindowFocus: true,   // Refresh when user tabs back
  });

Why: If the container finishes provisioning (status: provisioning → running),
     the dashboard auto-updates without the user refreshing the page.
```

### 5. Protected Routes — Never show protected pages to logged-out users

```typescript
// ProtectedRoute component
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;

  return children;
}

// Usage in Router:
<Route path="/dashboard" element={
  <ProtectedRoute><Dashboard /></ProtectedRoute>
} />
```

### 6. Form Validation — Validate BEFORE sending to server

```
Client-side validation (instant feedback):
  - Email format check
  - Password minimum length
  - Required fields not empty
  - Telegram token format check

Server-side validation (security):
  - Backend ALSO validates everything
  - Never trust the frontend alone
  - Frontend validation is for UX, backend is for security
```

### 7. Responsive Design — Works on mobile too

```
TailwindCSS makes this easy:
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    → 1 column on mobile
    → 2 columns on tablet
    → 3 columns on desktop
```

---

# PART 4 — Step-by-Step External Service Setup

> **UPDATED**: Using Hostinger (domain), DigitalOcean (VPS), and Razorpay (payments for India)

---

## 20. Hostinger — Domain + DNS Setup

### What Hostinger Does For Us
- Buy our domain (clawcloud.com)
- Manage DNS records (point domain → our server)
- Simple UI, affordable, Indian-friendly payment options

### Why Hostinger Over Others?
```
Hostinger:  Cheap domains, easy DNS management, supports UPI/Indian cards
Namecheap:  Also good but slightly more complex
GoDaddy:    Overpriced, pushy upsells
Cloudflare: Great but domain registration is limited in some regions
```

### Step-by-Step

```
STEP 1: CREATE HOSTINGER ACCOUNT
═══════════════════════════════════════
  Go to: hostinger.in
  Click "Sign Up" → create account
  You can pay with UPI, credit card, or PayPal

STEP 2: BUY YOUR DOMAIN
═══════════════════════════════════════
  Go to: hostinger.in/domain-name-search
  Search: clawcloud.com (or your chosen name)
  Price: ~₹800-1200/year for .com
  Add to cart → Checkout → Pay

  After purchase, the domain appears in your Hostinger dashboard.

STEP 3: GO TO DNS MANAGEMENT
═══════════════════════════════════════
  In Hostinger dashboard:
    → Domains → clawcloud.com → DNS / Nameservers

  You'll see the DNS Zone Editor with existing records.
  DELETE all existing A records (the defaults).

STEP 4: ADD DNS RECORDS
═══════════════════════════════════════
  Add these A records (replace 167.71.234.50 with YOUR DigitalOcean IP):

  Type: A    Name: @     Points to: 167.71.234.50    TTL: 3600
  Type: A    Name: app   Points to: 167.71.234.50    TTL: 3600
  Type: A    Name: api   Points to: 167.71.234.50    TTL: 3600
  Type: A    Name: *     Points to: 167.71.234.50    TTL: 3600

  Explanation:
    @    = clawcloud.com           (landing page)
    app  = app.clawcloud.com       (React dashboard)
    api  = api.clawcloud.com       (backend API)
    *    = *.clawcloud.com         (wildcard for employee subdomains)

  Click "Save" after adding each record.
  DNS propagation takes 5-30 minutes (sometimes up to 24 hours).

STEP 5: VERIFY DNS IS WORKING
═══════════════════════════════════════
  On your PC, open PowerShell and run:

  nslookup clawcloud.com
  nslookup app.clawcloud.com
  nslookup api.clawcloud.com

  Each should show your DigitalOcean server IP.
  If not, wait longer for propagation.

  You can also check at: dnschecker.org
```

---

## 21. DigitalOcean VPS Setup (Server)

### What DigitalOcean Does For Us
- Runs our backend API, Nginx, Docker containers
- The actual "computer in the cloud" that everything runs on

### Why DigitalOcean Over Hetzner?
```
DigitalOcean:
  ✅ MUCH simpler UI (designed for beginners)
  ✅ One-click Docker images (pre-installed!)
  ✅ Mumbai datacenter (low latency for India)
  ✅ Excellent tutorials (every step documented)
  ✅ Simple pricing: $24/mo for 4GB RAM droplet
  ✅ Accepts Indian cards and PayPal
  ✅ $200 free credits for new accounts!

Hetzner:
  ❌ More complex interface
  ❌ No Indian datacenter
  ❌ Documentation not as beginner-friendly
  ❌ Payment from India can be tricky
```

### Step-by-Step

```
STEP 1: CREATE DIGITALOCEAN ACCOUNT
═══════════════════════════════════════
  Go to: digitalocean.com
  Click "Sign Up"
  Use this referral for $200 free credits:
    → digitalocean.com/try (or search "DigitalOcean free credits")
  Add payment method (credit card or PayPal)

STEP 2: CREATE AN SSH KEY (on your Windows PC)
═══════════════════════════════════════
  Open PowerShell on your PC:

  ssh-keygen -t ed25519 -C "your-email@gmail.com"

  Press Enter 3 times (accept defaults, no passphrase).
  This creates two files:
    C:\Users\sai\.ssh\id_ed25519       (private key — NEVER share)
    C:\Users\sai\.ssh\id_ed25519.pub   (public key — share with server)

  Copy your public key:
  Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard

  In DigitalOcean → Settings → Security → SSH Keys → Add SSH Key
  Paste the public key → Name it "My PC" → Save

STEP 3: CREATE A DROPLET (= server)
═══════════════════════════════════════
  In DigitalOcean dashboard → "Create" → "Droplets"

  Choose:
    Region:           Bangalore (BLR1) — closest to India!
    Image:            Marketplace → "Docker on Ubuntu 24.04"
                      (Docker comes pre-installed!)
    Size:             Basic → Regular → $24/mo
                      (4 GB RAM, 2 vCPUs, 80 GB SSD)
    SSH Key:          Select "My PC" (the key you just added)
    Hostname:         clawcloud-prod

  Click "Create Droplet"

  Wait ~60 seconds. Your droplet gets an IP address.
  Example: 167.71.234.50

  ⚠️ GO BACK TO HOSTINGER → update DNS records with this IP!

STEP 4: CONNECT TO YOUR SERVER
═══════════════════════════════════════
  Open PowerShell on your PC:

  ssh root@167.71.234.50

  (Replace with your actual IP)
  First time: type "yes" to accept fingerprint
  You're now INSIDE your server! 🎉

  You'll see: root@clawcloud-prod:~#

STEP 5: INITIAL SERVER SETUP
═══════════════════════════════════════
  Docker is already installed (from the marketplace image).
  Run these commands one by one:

  # Update system
  apt update && apt upgrade -y

  # Install Nginx, Node.js, and other tools
  apt install -y nginx certbot python3-certbot-nginx curl git

  # Install Node.js 22 (latest LTS)
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs

  # Verify installations
  docker --version      # Should show Docker 27+
  node --version        # Should show v22+
  nginx -v              # Should show nginx/1.24+

  # Setup firewall
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable

  # Create platform directories
  mkdir -p /opt/claw-platform/users
  mkdir -p /opt/claw-platform/templates
  mkdir -p /opt/claw-backend

  # Setup swap (memory safety net — prevents crashes)
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab

STEP 6: SETUP SSL CERTIFICATE (HTTPS)
═══════════════════════════════════════
  # This uses Let's Encrypt + Nginx plugin (simpler than Cloudflare method!)
  # Make sure DNS is already pointing to your server IP first!

  # Create basic Nginx config so certbot can verify
  cat > /etc/nginx/sites-available/default << 'EOF'
  server {
      listen 80;
      server_name clawcloud.com *.clawcloud.com;
      location / { return 200 'ok'; }
  }
  EOF

  systemctl restart nginx

  # Generate wildcard certificate
  # (Wildcard requires DNS challenge — we'll use Hostinger's DNS for this)
  # Option A: If you only need app. and api. subdomains (simpler):
  certbot --nginx -d clawcloud.com -d app.clawcloud.com -d api.clawcloud.com \
    --agree-tos --email your-email@gmail.com --non-interactive

  # Option B: For wildcard (*.clawcloud.com) — requires manual DNS TXT record:
  certbot certonly --manual --preferred-challenges dns \
    -d "*.clawcloud.com" -d "clawcloud.com" \
    --agree-tos --email your-email@gmail.com

  # For Option B: certbot will ask you to add a TXT record in Hostinger DNS:
  #   Name: _acme-challenge    Value: <random string certbot shows>
  #   Add it in Hostinger → DNS → Add TXT Record → Save
  #   Wait 2-5 minutes → Press Enter in the terminal

  # Verify SSL certificate:
  ls /etc/letsencrypt/live/clawcloud.com/
  # Should show: fullchain.pem, privkey.pem, etc.

  # Auto-renew (already set up by certbot, but verify):
  certbot renew --dry-run

STEP 7: DEPLOY YOUR BACKEND
═══════════════════════════════════════
  # From your Windows PC, upload the backend:
  scp -r "C:\Users\sai\OneDrive\Desktop\sai claw\backend\*" root@167.71.234.50:/opt/claw-backend/

  # On the server (SSH in):
  cd /opt/claw-backend
  npm install --production

  # Create .env with real values
  nano .env
  # (paste your production values — see section 23)

  # Install PM2 (keeps your app running 24/7, restarts on crash)
  npm install -g pm2

  # Start the backend
  pm2 start src/server.js --name clawcloud-api
  pm2 startup    # Auto-start on server reboot
  pm2 save

  # Verify it's running:
  pm2 status     # Should show "online"
  curl http://localhost:3000/api/health   # Should return JSON

STEP 8: CONFIGURE NGINX (reverse proxy)
═══════════════════════════════════════
  # This makes:
  #   api.clawcloud.com → backend on port 3000
  #   app.clawcloud.com → React frontend static files
  #   *.clawcloud.com   → employee containers

  nano /etc/nginx/sites-available/clawcloud

  # Paste the Nginx config (see info.md for full config)
  # Save and exit (Ctrl+X, Y, Enter)

  # Enable and test
  ln -sf /etc/nginx/sites-available/clawcloud /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  touch /etc/nginx/customer_map.conf
  nginx -t                    # Should say "syntax is ok"
  systemctl restart nginx

  # Test from browser:
  # https://api.clawcloud.com/api/health → should return JSON
```

---

## 22. Razorpay Setup (Payments — India)

### Why Razorpay Instead of Stripe?

```
PROBLEM: Stripe is NOT available in India for accepting payments.
         Indian businesses cannot create Stripe accounts.

SOLUTION: Razorpay — India's #1 payment gateway

RAZORPAY vs STRIPE:
═══════════════════════════════════════
  Feature              Razorpay         Stripe
  ─────────────────────────────────────────────
  Available in India   ✅ YES            ❌ NO
  International $USD   ✅ YES            ✅ YES
  Subscription API     ✅ YES            ✅ YES
  Hosted Checkout      ✅ YES            ✅ YES
  Webhooks             ✅ YES            ✅ YES
  UPI Support          ✅ YES            ❌ NO
  Indian Cards         ✅ YES            ❌ NO
  Transaction Fee      2% (domestic)    2.9% + 30¢
                       3% (international)
  Settlement           T+2 days         T+2 days
  Payout in USD        ✅ YES (via intl) —

HOW RAZORPAY HANDLES USD PAYMENTS:
  Your customers pay in USD (credit card / PayPal)
  → Razorpay converts to INR at current rate
  → Money lands in your Indian bank account in INR
  → Or: Use Razorpay International to keep in USD

ALTERNATIVES CONSIDERED:
  PayPal:     Works but high fees (4.4% + ₹15 per transaction),
              poor subscription management, bad developer API
  Cashfree:   Good but less documentation than Razorpay
  PayU:       OK but API is outdated and clunky
  → Razorpay is the clear winner for India
```

### What is Razorpay?

```
Think of Razorpay as "Stripe for India":

  1. You create a subscription plan ($20/mo, $35/mo, $75/mo)
  2. User clicks "Upgrade" on your website
  3. Razorpay opens a beautiful payment popup
  4. User enters card / UPI / net banking details
  5. Razorpay charges the customer
  6. Razorpay sends a webhook to YOUR backend: "payment success!"
  7. Your backend upgrades the user's plan

  The flow is almost IDENTICAL to Stripe, just different API calls.
```

### Step-by-Step

```
STEP 1: CREATE RAZORPAY ACCOUNT
═══════════════════════════════════════
  Go to: razorpay.com
  Click "Sign Up" → create account with your email
  Verify email → Login

  You start in TEST MODE automatically.
  Test mode = fake payments, no real money involved.

STEP 2: COMPLETE KYC (Know Your Customer)
═══════════════════════════════════════
  For live payments later, you'll need:
    → PAN Card
    → GST Number (or personal PAN if no business)
    → Bank Account details
    → Address proof

  For NOW (testing): Skip this. Test mode works without KYC.

STEP 3: GET YOUR API KEYS
═══════════════════════════════════════
  In Razorpay Dashboard → Account & Settings → API Keys
  Click "Generate Key"

  You'll get:
    Key ID:     rzp_test_abc123...  (safe for frontend — like Stripe's publishable key)
    Key Secret: xyz789secret...     (ONLY for backend — like Stripe's secret key)

  ⚠️ SAVE THE SECRET! It's shown only ONCE.

  Put in your .env:
    RAZORPAY_KEY_ID=rzp_test_abc123...
    RAZORPAY_KEY_SECRET=xyz789secret...

STEP 4: CREATE SUBSCRIPTION PLANS
═══════════════════════════════════════
  In Razorpay Dashboard → Products → Subscriptions → Plans
  Click "Create Plan"

  Plan 1: "ClawCloud Basic"
    Period:    Monthly
    Amount:    $20 (or ₹1,700 equivalent — Razorpay handles conversion)
    Currency:  USD (if international) or INR
    → After creating, note the Plan ID: plan_ABC123...

  Plan 2: "ClawCloud Pro"
    Amount: $35/mo
    → Plan ID: plan_DEF456...

  Plan 3: "ClawCloud Business"
    Amount: $75/mo
    → Plan ID: plan_GHI789...

  Put in your .env:
    RAZORPAY_PLAN_BASIC=plan_ABC123...
    RAZORPAY_PLAN_PRO=plan_DEF456...
    RAZORPAY_PLAN_BUSINESS=plan_GHI789...

STEP 5: SET UP WEBHOOK
═══════════════════════════════════════
  In Razorpay Dashboard → Account & Settings → Webhooks
  Click "Add New Webhook"

  Webhook URL: https://api.clawcloud.com/api/billing/webhook
  Secret:      Generate a secret string → SAVE IT
               Put in .env: RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

  Events to listen for:
    ✅ subscription.activated
    ✅ subscription.charged
    ✅ subscription.completed
    ✅ subscription.cancelled
    ✅ subscription.halted        (payment failed)
    ✅ payment.captured

  Click "Create Webhook"

STEP 6: TEST A PAYMENT
═══════════════════════════════════════
  In test mode, Razorpay provides test credentials:

  Card:    4111 1111 1111 1111
  Expiry:  Any future date
  CVV:     Any 3 digits
  OTP:     1234 (for test mode)

  UPI:     success@razorpay  (test UPI ID)
  Net Banking: Select any bank, all succeed in test mode

  When ready for real payments → switch to Live mode
  → Complete KYC → Generate live API keys
```

### How Razorpay Works in Our App

```
PAYMENT FLOW:

  User clicks "Upgrade to Pro" in our React frontend
    │
    ▼
  Frontend calls: POST /api/billing/subscribe { plan: "pro" }
    │
    ▼
  Backend creates Razorpay Subscription:
    razorpay.subscriptions.create({
      plan_id: "plan_DEF456...",
      customer_notify: 1
    })
    → Returns: subscription_id + short_url
    │
    ▼
  Backend returns subscription_id to frontend
    │
    ▼
  Frontend opens Razorpay Checkout popup:
    const razorpay = new Razorpay({
      key: "rzp_test_abc123",
      subscription_id: "sub_ABC...",
      handler: (response) => {
        // Payment success!
        verifyOnBackend(response);
      }
    });
    razorpay.open();
    │
    ▼
  User pays in popup (card/UPI/net banking)
    │
    ▼
  Razorpay sends webhook to our backend:
    POST /api/billing/webhook
    { event: "subscription.activated", payload: { ... } }
    │
    ▼
  Backend updates user's plan in database:
    UPDATE profiles SET plan = 'pro' WHERE id = user_id
```

---

## 23. Connecting Everything Together

### The Complete Setup Checklist

```
PRE-REQUISITES:
  ✅ Domain purchased on Hostinger (clawcloud.com)
  ✅ DNS records configured in Hostinger (A records pointing to server)
  ✅ DigitalOcean Droplet running Ubuntu 24.04 + Docker
  ✅ SSL certificate generated (Let's Encrypt)
  ✅ Razorpay account + subscription plans created
  ✅ Google OAuth credentials (you already have these)
  ✅ Supabase project (cloudclaw — pbrfftorddhbsujcuclk)

BACKEND .env SHOULD HAVE:
═══════════════════════════════════════
  NODE_ENV=production
  PORT=3000
  DOMAIN=clawcloud.com

  SUPABASE_URL=https://pbrfftorddhbsujcuclk.supabase.co
  SUPABASE_ANON_KEY=eyJhbGci...
  SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Settings → API>
  SUPABASE_JWT_SECRET=<from Supabase Dashboard → Settings → API>

  RAZORPAY_KEY_ID=rzp_test_abc123...
  RAZORPAY_KEY_SECRET=xyz789secret...
  RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
  RAZORPAY_PLAN_BASIC=plan_...
  RAZORPAY_PLAN_PRO=plan_...
  RAZORPAY_PLAN_BUSINESS=plan_...

  TOKEN_ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
  OPENCLAW_BASE_PORT=19000
  OPENCLAW_IMAGE=openclaw:local
  OPENCLAW_PLATFORM_DIR=/opt/claw-platform

  GOOGLE_CLIENT_ID=<your google client id>
  GOOGLE_CLIENT_SECRET=<your google secret>
  GOOGLE_REDIRECT_URI=https://app.clawcloud.com/auth/google/callback

FRONTEND .env SHOULD HAVE:
═══════════════════════════════════════
  VITE_SUPABASE_URL=https://pbrfftorddhbsujcuclk.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGci...
  VITE_API_URL=https://api.clawcloud.com
  VITE_RAZORPAY_KEY_ID=rzp_test_abc123...

CONNECTION MAP:
═══════════════════════════════════════

  User's Browser
    → app.clawcloud.com (React frontend — served by Nginx)
    → Supabase Auth (signup/login directly from frontend)
    → api.clawcloud.com (all API calls through Nginx → port 3000)
    → Razorpay Checkout (payment popup opens from frontend)

  Backend API (port 3000)
    → Supabase (database queries via service role key)
    → Docker (manage containers via docker.sock)
    → Nginx (update customer_map.conf + reload)
    → Razorpay SDK (create subscriptions, verify payments)
    → OpenClaw containers (WebSocket for QR code relay)

  Razorpay
    → Calls POST api.clawcloud.com/api/billing/webhook
      (when payments succeed/fail/subscription changes)

  Hostinger DNS
    → Routes *.clawcloud.com → your DigitalOcean server IP

  Each OpenClaw Container
    → Connects to WhatsApp servers (via Baileys)
    → Connects to Telegram servers (via grammY)
    → Calls OpenAI/Anthropic API (via customer's key)

FULL ARCHITECTURE:
═══════════════════════════════════════

  Internet
    │
    ▼
  Hostinger DNS (*.clawcloud.com → 167.71.234.50)
    │
    ▼
  DigitalOcean Droplet (167.71.234.50)
    │
    ├── Nginx (port 80/443)
    │   ├── app.clawcloud.com  → /var/www/clawcloud (React static files)
    │   ├── api.clawcloud.com  → localhost:3000 (Node.js backend)
    │   └── c-*.clawcloud.com  → localhost:19001-19999 (OpenClaw containers)
    │
    ├── Backend API (PM2, port 3000)
    │   ├── Talks to Supabase (cloud database)
    │   ├── Manages Docker containers
    │   ├── Handles Razorpay webhooks
    │   └── WebSocket server for QR relay
    │
    ├── Docker Containers
    │   ├── claw-abc-123 (port 19001) — User A's employee
    │   ├── claw-def-456 (port 19002) — User B's employee
    │   └── ...more containers as users sign up
    │
    └── External Services (cloud)
        ├── Supabase (database + auth)
        ├── Razorpay (payments)
        └── OpenAI/Anthropic (AI — via customer's key)
```

### Get Supabase Service Role Key

```
You need this for the backend to bypass RLS (admin operations).

  1. Go to: https://supabase.com/dashboard/project/pbrfftorddhbsujcuclk/settings/api
  2. Under "Project API keys" find "service_role" key
  3. Copy it
  4. Put in backend .env: SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

  ⚠️ NEVER put this key in frontend code! It bypasses all security.
```

---

# PART 5 — Detailed UI Screen Flows

> This section explains EXACTLY what each screen shows, every button, every interaction,
> what data loads, what API calls fire, and how the user flows between screens.

## 24. Complete Screen-by-Screen Breakdown

### Navigation Structure

```
LAYOUT: Every protected page shares a common layout:

┌────────────────────────────────────────────────────────────────┐
│  TOPBAR: Logo  |  Search (optional)  |  🔔 Notifications  |  👤 │
├──────────┬─────────────────────────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT AREA                                  │
│          │                                                     │
│ 🏠 Home  │  (changes based on which page you're on)            │
│ 🤖 Employees│                                                  │
│ 🛒 Market │                                                    │
│ 💳 Billing│                                                    │
│ 📋 Logs   │                                                    │
│ 🔑 API Key│                                                    │
│ ⚙️ Settings│                                                   │
│          │                                                     │
│ ─────── │                                                      │
│ 🚪 Logout│                                                     │
└──────────┴─────────────────────────────────────────────────────┘

Mobile: Sidebar collapses to hamburger menu (☰)
```

---

### SCREEN: Landing Page (/)

```
PURPOSE: Convert visitors into signups. This is a MARKETING page.
AUTH: Not required (public)
```

**Sections on this page (top to bottom):**

```
1. HERO SECTION
   ┌──────────────────────────────────────────────────────────┐
   │  "Your AI Employees, Working 24/7"                       │
   │  Subtitle: "Create AI assistants that handle WhatsApp    │
   │  and Telegram conversations. No coding required."        │
   │                                                          │
   │  [Get Started Free]  [See Demo]                          │
   │                                                          │
   │  (Hero image/animation: dashboard preview screenshot)    │
   └──────────────────────────────────────────────────────────┘

   BACKEND: None — static content
   CLICK "Get Started": → navigate to /signup
   CLICK "See Demo": → scroll down to demo section

2. HOW IT WORKS (3 steps)
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Step 1   │  │ Step 2   │  │ Step 3   │
   │ Create   │  │ Connect  │  │ Done!    │
   │ Employee │  │ WhatsApp │  │ AI works │
   │ (icon)   │  │ (icon)   │  │ 24/7     │
   └──────────┘  └──────────┘  └──────────┘

   BACKEND: None — static content

3. FEATURES GRID
   - "Connect WhatsApp in 60 seconds"
   - "Add Telegram bots instantly"
   - "Skill Marketplace — code, browse, email"
   - "Your API key, your cost control"
   - "Encrypted & secure"
   - "Real-time activity logs"

   BACKEND: None — static content

4. PRICING SECTION
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │   Basic      │  │   ★ Pro     │  │  Business    │
   │   $20/mo     │  │   $35/mo    │  │  $75/mo      │
   │              │  │  (Popular)  │  │              │
   │ 1 employee   │  │ 3 employees │  │ 10 employees │
   │ WhatsApp     │  │ + Telegram  │  │ + All skills │
   │ 5 skills     │  │ All skills  │  │ + Priority   │
   │              │  │             │  │   support    │
   │ [Get Started]│  │[Get Started]│  │[Get Started] │
   └─────────────┘  └─────────────┘  └─────────────┘

   BACKEND: None — static content
   CLICK any "Get Started": → navigate to /signup?plan=basic (or pro/business)

5. FAQ SECTION
   Accordion with common questions:
   - "What AI models do you support?" → OpenAI, Anthropic, Google
   - "Do I need my own API key?" → Yes, you bring your own key
   - "Is my data secure?" → Yes, AES-256 encryption...
   - "Can I cancel anytime?" → Yes, no lock-in

6. FOOTER
   Links: About | Privacy | Terms | Contact | Twitter | Discord
```

---

### SCREEN: Sign Up (/signup)

```
PURPOSE: Create a new account
AUTH: Not required (redirect to /dashboard if already logged in)
```

**What the user sees:**

```
┌──────────────────────────────────────────────────────────────┐
│  Logo (top left)                        [Already have account? Login] │
│                                                              │
│         ┌────────────────────────────────┐                   │
│         │                                │                   │
│         │   Create Your Account          │                   │
│         │                                │                   │
│         │   Full Name                    │                   │
│         │   [________________________]   │                   │
│         │                                │                   │
│         │   Email                        │                   │
│         │   [________________________]   │                   │
│         │                                │                   │
│         │   Password (min 8 chars)       │                   │
│         │   [________________________] 👁│                   │
│         │                                │                   │
│         │   [  Create Account  ]         │                   │
│         │                                │                   │
│         │   ─── or continue with ───     │                   │
│         │   [G] Sign up with Google      │                   │
│         │                                │                   │
│         └────────────────────────────────┘                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Interactions:**

```
1. USER FILLS FORM:
   - Validation runs on each field as they type:
     • Name: required, min 2 chars
     • Email: valid email format
     • Password: min 8 chars, show strength meter

2. CLICK "Create Account":
   → Button changes to: [⏳ Creating...] (disabled)
   → Call: supabase.auth.signUp({ email, password, options: { data: { full_name } } })

   SUCCESS:
     → Our DB trigger auto-creates a row in `profiles` table
     → Show message: "Check your email for a verification link!"
     → After email verification → user is redirected to /login

   ERROR:
     → "User already registered" → Show: "This email is already in use. Login instead?"
     → "Password too weak" → Show: "Password must be at least 8 characters"

3. CLICK "Sign up with Google":
   → Call: supabase.auth.signInWithOAuth({ provider: 'google' })
   → Redirects to Google login page
   → After Google auth → auto-creates account → redirects to /dashboard
   → (Uses your Google OAuth credentials you already set up)
```

---

### SCREEN: Login (/login)

```
PURPOSE: Log into existing account
AUTH: Not required (redirect to /dashboard if already logged in)
```

**Interactions:**

```
1. CLICK "Log In":
   → Call: supabase.auth.signInWithPassword({ email, password })
   → SUCCESS: redirect to /dashboard
   → ERROR: "Invalid login credentials" → show error toast

2. CLICK "Forgot Password?":
   → Show inline email input: "Enter your email"
   → Call: supabase.auth.resetPasswordForEmail(email)
   → Show: "Password reset link sent to your email"

3. CLICK "Sign in with Google":
   → Same as signup — supabase.auth.signInWithOAuth({ provider: 'google' })
```

---

### SCREEN: Dashboard (/dashboard)

```
PURPOSE: Overview of everything — the HOME screen
AUTH: Required
THIS IS THE MOST IMPORTANT SCREEN — users see it every time they log in
```

**Data that loads on this page:**

```
API CALLS ON PAGE LOAD:
  1. GET /api/auth/me
     → Returns: { full_name, plan, has_api_key, employee_count, onboarding_completed }

  2. GET /api/employees
     → Returns: { employees: [{ id, name, role, status, whatsapp_connected, telegram_connected }] }

AUTO-REFRESH: Both queries refresh every 30 seconds (TanStack Query)
```

**What the user sees:**

```
SECTION 1: WELCOME BANNER
  "Welcome back, {full_name}!"
  Quick stats: Plan: Pro | Employees: 2/3 | API Key: ✅

SECTION 2: ONBOARDING CHECKLIST (only shown if NOT all completed)
  ┌──────────────────────────────────────────────────────────┐
  │ Complete your setup:                                      │
  │ ✅ Create account                                         │
  │ ✅ Set up API key                    [→ Go to Settings]  │
  │ ⬜ Create your first employee        [→ Create Employee] │
  │ ⬜ Connect WhatsApp or Telegram      [→ Coming soon]     │
  └──────────────────────────────────────────────────────────┘

  Logic:
    Step 1: Always ✅ (they're logged in)
    Step 2: ✅ if profile.has_api_key === true
    Step 3: ✅ if employees.length > 0
    Step 4: ✅ if any employee has whatsapp_connected or telegram_connected

  When all 4 are ✅ → hide the checklist entirely
  → Also: PATCH /api/auth/profile { onboarding_completed: true }

SECTION 3: EMPLOYEE CARDS
  For each employee:
  ┌─────────────────────────────────────────────────────────┐
  │ 🤖 Assistant Amy                    Status: Running ✅  │
  │    Role: General                                        │
  │    WhatsApp: ✅ Connected   Telegram: ❌ Not connected  │
  │                                                         │
  │    [View Details]  [Connect Channel]                    │
  └─────────────────────────────────────────────────────────┘

  STATUS BADGES (color-coded):
    "running"       → green  ✅
    "provisioning"  → yellow ⏳
    "stopped"       → gray   ⏸️
    "error"         → red    ❌

  CLICK "View Details" → navigate to /employees/:id
  CLICK "Connect Channel" → navigate to /employees/:id (channels section)

SECTION 4: CREATE EMPLOYEE BUTTON
  [+ Create New Employee]
  → navigate to /employees/new

  If employee_count >= plan_limit:
    → Button disabled, shows: "Upgrade plan to add more employees"
    → CLICK → navigate to /billing
```

---

### SCREEN: Create Employee (/employees/new)

```
PURPOSE: Create a new AI employee (triggers Docker container provisioning)
AUTH: Required
```

**Interactions:**

```
FORM FIELDS:
  Name:           [required, max 50 chars]
  Role:           [dropdown: General, Sales, Support, Marketing, Developer, Custom]
  System Prompt:  [textarea, default: "You are a helpful AI assistant."]
                  Placeholder: "Describe what this employee should do..."
  Trigger Prefix: [optional, e.g., "Marketing:" — only responds to messages with this prefix]

PRE-CHECKS (before showing form):
  1. GET /api/auth/me → check if has_api_key
     If NO API key: Show warning banner:
     "⚠️ You need to set up your AI API key first. [Go to Settings]"

  2. GET /api/billing/subscription → check employee limit
     If at limit: Show: "You've reached your plan's employee limit. [Upgrade]"

CLICK "Create Employee":
  → Button: [⏳ Creating...]
  → POST /api/employees { name, role, system_prompt, trigger_prefix }

  SUCCESS:
    → Toast: "🎉 Assistant Amy created! Container is starting..."
    → Redirect to /employees/:newId
    → Employee card shows status: "provisioning ⏳"
    → After 10-30 seconds: status changes to "running ✅" (auto-refresh)

  ERROR:
    → "Your plan allows 1 employee. Upgrade to add more."
    → "Employee name is required"
```

---

### SCREEN: Employee Detail (/employees/:id)

```
PURPOSE: View and manage a single AI employee
AUTH: Required
THIS IS THE SECOND MOST IMPORTANT SCREEN
```

**Data that loads:**

```
API CALLS:
  1. GET /api/employees/:id
     → { id, name, role, system_prompt, status, whatsapp_connected,
        telegram_connected, subdomain, trigger_prefix, skills }

  2. GET /api/marketplace/installed/:id
     → { installed_skills: [{ id, skill_name, slug, status }] }

  Auto-refresh: Every 10 seconds (for status updates during provisioning)
```

**Page sections:**

```
SECTION 1: HEADER
  ← Back to Dashboard    "Assistant Amy"    Status: Running ✅

SECTION 2: CHANNEL CONNECTIONS (most prominent!)
  ┌──────────────────────────────────────────────────────────┐
  │  📱 CHANNELS                                             │
  │                                                          │
  │  WhatsApp                                                │
  │  Status: ✅ Connected                                    │
  │  [Disconnect WhatsApp]                                   │
  │                                                          │
  │  ─────────────────────────────────────────                │
  │                                                          │
  │  Telegram                                                │
  │  Status: ❌ Not Connected                                │
  │  [Connect Telegram →]                                    │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  WhatsApp NOT connected:
    [Connect WhatsApp →] → navigate to /connect/whatsapp/:id
  WhatsApp CONNECTED:
    Shows "Connected ✅" + [Disconnect] button
    Disconnect: POST /api/connect/whatsapp/:id/disconnect + confirm dialog

  Telegram NOT connected:
    [Connect Telegram →] → navigate to /connect/telegram/:id
  Telegram CONNECTED:
    Shows "Connected ✅" + [Disconnect] button

SECTION 3: SETTINGS (editable form)
  Name:           [Assistant Amy_____]
  Role:           [General ▼]
  System Prompt:  [You are a helpful AI assistant that...]
  Trigger Prefix: [________________]

  [Save Changes]
  → PUT /api/employees/:id { name, role, system_prompt, trigger_prefix }
  → Toast: "Settings saved! Container will restart to apply changes."

SECTION 4: INSTALLED SKILLS
  ┌──────────────────────────────────────────────┐
  │ 🧠 General AI Chat  (built-in)              │
  │ 🌤️ Weather          [Remove]                │
  │ 📧 Gmail            [Remove] ⚠️ Needs OAuth │
  │                                              │
  │ [+ Add Skills from Marketplace]              │
  └──────────────────────────────────────────────┘

  [Remove]: POST /api/marketplace/uninstall { employee_id, skill_id }
  [+ Add Skills]: navigate to /marketplace?employee=:id

SECTION 5: ACTIVITY (recent logs for this employee)
  Last 5 activity entries from GET /api/logs/:id?limit=5
  [View All Logs →] → navigate to /logs?employee=:id

SECTION 6: DANGER ZONE
  ┌──────────────────────────────────────────────┐
  │ ⚠️ Danger Zone                               │
  │ [🗑️ Delete Employee]                         │
  │ This will stop the container and remove all  │
  │ data. This action cannot be undone.          │
  └──────────────────────────────────────────────┘

  Click [Delete]:
    → Confirmation dialog: "Are you sure? Type 'DELETE' to confirm"
    → DELETE /api/employees/:id
    → Toast: "Employee deleted"
    → Redirect to /dashboard
```

---

### SCREEN: Connect WhatsApp (/connect/whatsapp/:id)

```
PURPOSE: Show QR code for WhatsApp pairing
AUTH: Required
SPECIAL: Uses WebSocket (not REST API!)
```

**The 3-stage flow:**

```
STAGE 1 — CONNECTING (2-5 seconds)
  ┌──────────────────────────────────────┐
  │  Connecting to your AI agent...      │
  │  [spinning loader]                   │
  └──────────────────────────────────────┘

  What happens behind the scenes:
    1. POST /api/connect/whatsapp/:id
       → Returns: { ws_url: "ws://localhost:3000/ws/whatsapp/:id" }
    2. Frontend opens WebSocket: new WebSocket(ws_url + "?token=" + jwt)
    3. Backend connects to container WebSocket
    4. Container starts Baileys WhatsApp auth

STAGE 2 — QR CODE (user scans with phone)
  ┌──────────────────────────────────────────────────────────┐
  │  Scan QR Code with WhatsApp                              │
  │                                                          │
  │  Instructions:                                           │
  │  1. Open WhatsApp on your phone                          │
  │  2. Tap ⋮ (three dots) → Linked Devices                 │
  │  3. Tap "Link a Device"                                  │
  │  4. Point your camera at this QR code:                   │
  │                                                          │
  │         ┌────────────────┐                               │
  │         │                │                               │
  │         │   QR CODE      │  ← rendered using qrcode.react│
  │         │   (updates     │                               │
  │         │    every ~60s) │                               │
  │         │                │                               │
  │         └────────────────┘                               │
  │                                                          │
  │  QR refreshes automatically. Keep this page open.        │
  │                                                          │
  │  [Cancel]                                                │
  └──────────────────────────────────────────────────────────┘

  WebSocket messages from backend:
    { type: "qr", qrData: "base64..." } → render QR code
    QR updates every ~60 seconds (Baileys generates new one)

STAGE 3 — SUCCESS (after user scans)
  ┌──────────────────────────────────────────────────────────┐
  │  ✅ WhatsApp Connected Successfully!                     │
  │                                                          │
  │  Your AI employee "Assistant Amy" is now live on          │
  │  WhatsApp! Send a message to test it.                    │
  │                                                          │
  │  [Go to Dashboard]                                       │
  └──────────────────────────────────────────────────────────┘

  WebSocket message: { type: "connected" }
  → Close WebSocket connection
  → Update employee.whatsapp_connected = true in local state
```

---

### SCREEN: Connect Telegram (/connect/telegram/:id)

```
PURPOSE: User pastes their Telegram bot token
AUTH: Required
MUCH SIMPLER than WhatsApp (no QR code, just a text input)
```

**Interactions:**

```
  Step-by-step instructions shown on page:
    1. Open Telegram → search @BotFather
    2. Send /newbot → follow prompts
    3. Copy the bot token (looks like: 7123456789:AAH3k5Lz1PxR9mN...)
    4. Paste below

  Token Input: [_________________________________]
  [Connect Telegram]

  CLICK "Connect Telegram":
    → Validate format: /^\d+:[A-Za-z0-9_-]+$/
    → POST /api/connect/telegram/:id { token: "7123456789:AAH..." }
    → Backend encrypts token → writes to container config → restarts container
    → Toast: "✅ Telegram bot connected!"
    → Redirect to /employees/:id
```

---

### SCREEN: API Key Settings (/settings/api-keys)

```
PURPOSE: User enters their OpenAI/Anthropic/Google API key
AUTH: Required
CRITICAL: Without this, AI employees cannot generate responses
```

**Interactions:**

```
  Provider Selection: (•) OpenAI  ( ) Anthropic  ( ) Google AI

  API Key: [sk-proj-abc123__________________________]
  (Show/hide toggle 👁)

  If key already saved:
    "Current: sk-proj-...abc (OpenAI) ✅ Saved"
    [Update Key]  [Remove Key]

  CLICK "Save API Key":
    → PUT /api/settings/api-key { api_key: "sk-...", provider: "openai" }
    → Backend encrypts key → updates all running containers
    → Toast: "API key saved! All employees updated."

  HELP TEXT:
    "Where to get your key:"
    • OpenAI: platform.openai.com/api-keys → Create new secret key
    • Anthropic: console.anthropic.com → Settings → API Keys
    • Google: aistudio.google.com → Get API Key
```

---

### SCREEN: Skill Marketplace (/marketplace)

```
PURPOSE: Browse and install skills/capabilities on employees
AUTH: Required
```

**Data loaded:**

```
  GET /api/marketplace/skills → all available skills
  GET /api/employees → user's employees (for install dropdown)
```

**Layout:**

```
  Category filters: [All] [General] [Development] [Productivity] [Business] [Utilities]

  Grid of skill cards:
  ┌──────────────────┐  ┌──────────────────┐
  │ 💻 Coding Agent   │  │ 🌐 Web Browser    │
  │ Write & run code  │  │ Search & browse   │
  │ $5/mo            │  │ $5/mo            │
  │ [Install ▼]      │  │ [Install ▼]      │
  └──────────────────┘  └──────────────────┘

  CLICK "Install ▼":
    → Dropdown: "Install on which employee?"
      • Assistant Amy
      • Marketing Mary
    → Select employee → POST /api/marketplace/install { employee_id, skill_id }
    → Toast: "Coding Agent installed on Assistant Amy!"

  If skill needs credentials (e.g., Gmail):
    → After install, show: "⚠️ This skill requires Google OAuth. [Set up →]"
```

---

### SCREEN: Billing & Plans (/billing)

```
PURPOSE: View current plan, upgrade/downgrade, manage subscription
AUTH: Required
PAYMENT: Uses Razorpay (not Stripe!)
```

**Layout:**

```
  CURRENT PLAN section:
    "You're on the Pro plan ($35/mo)"
    "Next billing date: March 7, 2026"
    "Employees: 2 of 3 used"
    [Manage Subscription] (opens Razorpay customer portal or cancel flow)

  PLAN COMPARISON (3 cards):
    Basic $20/mo | Pro $35/mo (current) | Business $75/mo
    Each shows features + [Upgrade] or [Current] or [Downgrade]

  CLICK "Upgrade to Business":
    → POST /api/billing/subscribe { plan: "business" }
    → Backend creates Razorpay subscription
    → Frontend opens Razorpay Checkout popup:

    ┌─────────────────────────────────────┐
    │ ┌─────────────────────────────────┐ │
    │ │  Razorpay Checkout              │ │
    │ │                                 │ │
    │ │  ClawCloud Business - $75/mo    │ │
    │ │                                 │ │
    │ │  Card Number: [___________]     │ │
    │ │  Expiry:  [__/__]  CVV: [___]   │ │
    │ │                                 │ │
    │ │  ── or ──                       │ │
    │ │  [UPI]  [Net Banking]  [Wallet] │ │
    │ │                                 │ │
    │ │  [Pay $75.00]                   │ │
    │ └─────────────────────────────────┘ │
    └─────────────────────────────────────┘

    → Payment success → Razorpay sends webhook → backend upgrades plan
    → Frontend gets callback → Toast: "🎉 Upgraded to Business!"
    → Page refreshes to show new plan
```

---

### SCREEN: Activity Logs (/logs)

```
PURPOSE: See all actions (employee created, WhatsApp connected, etc.)
AUTH: Required
```

**Layout:**

```
  Filters:
    Employee: [All Employees ▼]
    Action:   [All Actions ▼]

  Table:
    Time        | Employee       | Action              | Status
    5 min ago   | Assistant Amy  | whatsapp.connected   | ✅ Success
    1 hour ago  | Marketing Mary | skill.installed      | ✅ Success
    2 hours ago | —              | settings.api_key_set | ✅ Success
    3 hours ago | Assistant Amy  | employee.created     | ✅ Success

  Pagination: [← Previous] Page 1 of 5 [Next →]

  DATA: GET /api/logs?limit=20&offset=0
  FILTER: GET /api/logs/:employeeId?limit=20
```

---

### SCREEN: Profile Settings (/settings)

```
PURPOSE: Edit name, change password, manage account
AUTH: Required
```

**Layout:**

```
  Full Name: [Sarah Johnson_____]
  Email:     sarah@gmail.com (read-only, shown grayed out)
  [Save Profile]
  → PUT /api/auth/profile { full_name }

  ── Change Password ──
  [Send Password Reset Email]
  → supabase.auth.resetPasswordForEmail(email)
  → Toast: "Reset link sent to your email"

  ── Danger Zone ──
  [Delete My Account]
  → Confirm dialog: "This will delete all your employees, data, and containers."
  → Type "DELETE" to confirm
  → Calls backend to tear down containers + delete Supabase account
```

---

## What To Build Next

```
ORDER OF IMPLEMENTATION:
  ✅ 1. Backend API (DONE — running on localhost:3000)
  ✅ 2. Database schema (DONE — 6 tables in Supabase)
  ✅ 3. RLS policies (DONE — security in place)
  ✅ 4. Documentation (info.md, simple.md, ui-guide.md)
  🔲 5. Update backend billing to Razorpay (NEXT)
  🔲 6. Build Frontend (React + Vite + TailwindCSS + shadcn/ui)
  🔲 7. Set up external services (Hostinger, DigitalOcean, Razorpay)
  🔲 8. Deploy backend to DigitalOcean
  🔲 9. Deploy frontend (DigitalOcean or Vercel)
  🔲 10. Build OpenClaw Docker image
  🔲 11. Test end-to-end flow
  🔲 12. Go live!
```
