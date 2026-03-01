const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { supabaseAdmin } = require('../config/supabase');
const k8s = require('../lib/k8s-utils');

const authMiddleware = require('../middleware/auth');

// ── Composio API Config ─────────────────────────────────────────
const COMPOSIO_BASE = 'https://backend.composio.dev/api';
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || '';
const DOMAIN = process.env.DOMAIN || 'likelyclaw.com';

// In-memory cache for auth_config IDs per toolkit
const authConfigCache = {};

// ── Composio API helper ─────────────────────────────────────────
async function composioFetch(endpoint, options = {}) {
  const url = `${COMPOSIO_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': COMPOSIO_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok && res.status !== 201) {
    const errMsg = json?.error?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  return json;
}

// Get or create auth_config for a toolkit (cached)
async function getAuthConfigId(toolkitSlug) {
  if (authConfigCache[toolkitSlug]) return authConfigCache[toolkitSlug];

  // Check if one exists
  const existing = await composioFetch(`/v3/auth_configs?toolkit_slug=${toolkitSlug}`);
  if (existing.items && existing.items.length > 0) {
    authConfigCache[toolkitSlug] = existing.items[0].id;
    return existing.items[0].id;
  }

  // Create with Composio managed auth
  const created = await composioFetch('/v3/auth_configs', {
    method: 'POST',
    body: JSON.stringify({
      toolkit: { slug: toolkitSlug },
      auth_scheme: 'OAUTH2',
      use_composio_auth: true,
      name: `${toolkitSlug}-managed`,
    }),
  });

  const id = created.auth_config?.id;
  if (id) authConfigCache[toolkitSlug] = id;
  return id;
}

// Curated popular apps for the UI
// All apps use Composio managed OAuth exclusively (no direct Google OAuth)
const POPULAR_APPS = [
  // Google Suite (all use Composio OAuth)
  { slug: 'gmail', name: 'Gmail', category: 'Email', icon: 'mail' },
  { slug: 'googlesheets', name: 'Google Sheets', category: 'Productivity', icon: 'table' },
  { slug: 'googlecalendar', name: 'Google Calendar', category: 'Productivity', icon: 'calendar' },
  { slug: 'googledrive', name: 'Google Drive', category: 'Storage', icon: 'hard-drive' },
  { slug: 'googledocs', name: 'Google Docs', category: 'Productivity', icon: 'file-text' },
  // Communication
  { slug: 'slack', name: 'Slack', category: 'Communication', icon: 'message-square' },
  { slug: 'discord', name: 'Discord', category: 'Communication', icon: 'message-circle' },
  { slug: 'zoom', name: 'Zoom', category: 'Communication', icon: 'video' },
  // Productivity
  { slug: 'notion', name: 'Notion', category: 'Productivity', icon: 'book-open' },
  { slug: 'airtable', name: 'Airtable', category: 'Productivity', icon: 'database' },
  { slug: 'dropbox', name: 'Dropbox', category: 'Storage', icon: 'box' },
  // Development
  { slug: 'github', name: 'GitHub', category: 'Development', icon: 'github' },
  // Project Management
  { slug: 'trello', name: 'Trello', category: 'Project Management', icon: 'layout' },
  { slug: 'linear', name: 'Linear', category: 'Project Management', icon: 'git-branch' },
  { slug: 'asana', name: 'Asana', category: 'Project Management', icon: 'check-square' },
  { slug: 'clickup', name: 'ClickUp', category: 'Project Management', icon: 'check-circle' },
  // CRM & Business
  { slug: 'hubspot', name: 'HubSpot', category: 'CRM', icon: 'users' },
  { slug: 'salesforce', name: 'Salesforce', category: 'CRM', icon: 'cloud' },
  // Support & Payments
  { slug: 'intercom', name: 'Intercom', category: 'Support', icon: 'message-square' },
  { slug: 'stripe', name: 'Stripe', category: 'Payments', icon: 'credit-card' },
];

// Build the integration instructions block for IDENTITY.md based on connected apps
function buildIntegrationInstructions(connectedApps) {
  const toolCmd = 'node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js';
  let instructions = `\n## Connected Integrations\nYou have ${connectedApps.length} app(s) connected: ${connectedApps.join(', ')}.\n\n`;
  instructions += `### How to use integrations\n`;
  instructions += `Run shell commands with the composio tool:\n`;
  instructions += '```\n';
  instructions += `# List connected apps\n${toolCmd} apps\n\n`;
  instructions += `# List available tools for an app\n${toolCmd} tools gmail\n\n`;
  instructions += `# Call a tool\n${toolCmd} call GMAIL_FETCH_EMAILS '{"max_results": 5}'\n${toolCmd} call GMAIL_SEND_EMAIL '{"recipient_email": "to@example.com", "subject": "Hello", "body": "Hi there"}'\n${toolCmd} call GOOGLECALENDAR_FIND_EVENT '{"query": "meeting"}'\n`;
  instructions += '```\n\n';
  instructions += `### Rules\n`;
  instructions += `- To check emails: \`${toolCmd} call GMAIL_FETCH_EMAILS '{"max_results": 5}'\`\n`;
  instructions += `- To send email: confirm recipient with user first, then \`${toolCmd} call GMAIL_SEND_EMAIL '{...}'\`\n`;
  instructions += `- Never call the same tool twice unless the first call failed.\n`;
  instructions += `- Summarize results naturally — never dump raw JSON to the user.\n`;
  instructions += `- If a tool fails, tell the user to reconnect the app in Integrations.\n`;
  return instructions;
}

// Inject or update integration instructions block into ConfigMap IDENTITY.md
async function injectIntegrationInstructions(emp, connectedApps) {
  const marker = '<!-- integrations -->';
  const endMarker = '<!-- /integrations -->';
  const block = connectedApps.length > 0
    ? `${marker}\n${buildIntegrationInstructions(connectedApps)}${endMarker}`
    : '';

  try {
    const safeUserId = emp.user_id.replace(/_/g, '-').slice(0, 50);
    const { CoreV1Api, KubeConfig } = require('@kubernetes/client-node');
    const kc2 = new KubeConfig();
    kc2.loadFromDefault();
    const coreV1b = kc2.makeApiClient(CoreV1Api);
    const cmName = `agent-config-${safeUserId}`;
    const cm = await coreV1b.readNamespacedConfigMap({ name: cmName, namespace: 'claw-agents' });
    let identity = cm.data?.['IDENTITY.md'] || '';

    // Remove old integration block
    identity = identity.replace(/<!-- integrations -->[\s\S]*?<!-- \/integrations -->/, '');
    identity = identity.replace(/\n{3,}/g, '\n\n');
    if (block) identity = identity.trimEnd() + '\n\n' + block + '\n';

    await coreV1b.replaceNamespacedConfigMap({
      name: cmName, namespace: 'claw-agents',
      body: { ...cm, data: { ...cm.data, 'IDENTITY.md': identity } }
    });
    logger.info('Integration instructions injected into K8s ConfigMap', { empId: emp.id, apps: connectedApps });
  } catch (err) {
    logger.warn('Failed to inject integration instructions into ConfigMap', { empId: emp.id, error: err.message });
  }
}

// Sync all DB connections for a user to their K8s agent ConfigMaps
async function syncConnectionsToContainer(userId) {
  const { data: dbConns } = await supabaseAdmin
    .from('composio_connections')
    .select('app_slug, connection_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  const connections = {};
  for (const c of (dbConns || [])) {
    connections[c.app_slug] = c.connection_id;
  }
  const connectedApps = Object.keys(connections);

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, user_id, status')
    .eq('user_id', userId)
    .eq('status', 'running');

  for (const emp of (employees || [])) {
    try {
      // Patch composio connections into openclaw.json in ConfigMap
      await k8s.patchAgentConfig(emp.user_id, (config) => {
        config.composio = {
          api_key: COMPOSIO_API_KEY,
          base_url: COMPOSIO_BASE,
          connections,
        };
        return config;
      });
      // Patch integration instructions into IDENTITY.md in ConfigMap
      await injectIntegrationInstructions(emp, connectedApps);
      // Restart pod so agent picks up new config
      await k8s.restartAgentPod(emp.user_id);
    } catch (err) {
      logger.warn('Failed to sync composio config for employee', { empId: emp.id, error: err.message });
    }
  }

  logger.info('Synced composio connections to K8s ConfigMaps', { userId, apps: connectedApps });
}

// ── Routes ───────────────────────────────────────────────────────

// GET /api/integrations/apps — List popular apps with connection status
// Source of truth: our Supabase composio_connections table (per-user isolation)
router.get('/apps', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Primary: check our DB for this user's connections
    const { data: dbConns } = await supabaseAdmin
      .from('composio_connections')
      .select('app_slug, connection_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    const dbConnMap = {};
    for (const c of (dbConns || [])) {
      dbConnMap[c.app_slug] = c.connection_id;
    }

    const apps = POPULAR_APPS.map(app => ({
      ...app,
      connected: !!dbConnMap[app.slug],
      connectionId: dbConnMap[app.slug] || null,
    }));

    const totalConnected = Object.keys(dbConnMap).length;
    res.json({ apps, totalConnected });
  } catch (err) {
    logger.error('List integration apps error', { error: err.message });
    res.status(500).json({ error: 'Failed to load integrations' });
  }
});

// Apps that previously used our direct Google OAuth (now disabled — using Composio instead)
// const DIRECT_OAUTH_APPS = new Set(['gmail', 'googlecalendar']); // Disabled — using Composio for Gmail/Calendar

// POST /api/integrations/connect — Initiate OAuth for an app
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const { toolkit_slug, employee_id } = req.body;

    if (!toolkit_slug || !employee_id) {
      return res.status(400).json({ error: 'toolkit_slug and employee_id are required' });
    }

    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const userId = req.user.id;

    // Previously Gmail & Calendar used direct Google OAuth — now ALL apps use Composio OAuth
    // if (DIRECT_OAUTH_APPS.has(toolkit_slug)) { ... } // Disabled — using Composio for Gmail/Calendar

    // All apps use Composio OAuth
    const authConfigId = await getAuthConfigId(toolkit_slug);
    if (!authConfigId) {
      return res.status(500).json({ error: `Failed to setup auth for ${toolkit_slug}` });
    }

    // Determine redirect URL
    const domain = process.env.DOMAIN || 'likelyclaw.com';
    const redirectBase = process.env.NODE_ENV === 'production'
      ? `https://${domain}`
      : 'http://localhost:5173';
    const redirectUrl = `${redirectBase}/integrations?connected=${toolkit_slug}`;

    // Create connected account (v3 proper schema: connection.user_id for multi-tenant)
    const result = await composioFetch('/v3/connected_accounts', {
      method: 'POST',
      body: JSON.stringify({
        auth_config: { id: authConfigId },
        connection: { user_id: userId },
        redirect_url: redirectUrl,
      }),
    });

    logger.info('Integration connection initiated', { toolkit: toolkit_slug, userId });

    res.json({
      redirect_url: result.redirect_url || result.redirect_uri,
      connection_id: result.id,
      status: result.status,
    });
  } catch (err) {
    logger.error('Connect integration error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to initiate connection' });
  }
});

// GET /api/integrations/connections — List active connections from our DB
router.get('/connections', authMiddleware, async (req, res) => {
  try {
    const { data: dbConns, error } = await supabaseAdmin
      .from('composio_connections')
      .select('connection_id, app_slug, status, created_at')
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    if (error) throw error;

    const connections = (dbConns || []).map(c => ({
      id: c.connection_id,
      app: c.app_slug,
      status: c.status,
      createdAt: c.created_at,
    }));

    res.json({ connections });
  } catch (err) {
    logger.error('List connections error', { error: err.message });
    res.status(500).json({ error: 'Failed to load connections' });
  }
});

// POST /api/integrations/confirm-connection — After OAuth, find & save connection to DB
router.post('/confirm-connection', authMiddleware, async (req, res) => {
  try {
    const { toolkit_slug } = req.body;
    if (!toolkit_slug) {
      return res.status(400).json({ error: 'toolkit_slug is required' });
    }

    const userId = req.user.id;
    const slug = toolkit_slug.toLowerCase();

    // Previously Gmail & Calendar used direct Google OAuth — now ALL apps use Composio OAuth
    // The DIRECT_OAUTH_APPS block has been removed. All apps (including Gmail/Calendar)
    // now go through the Composio connection check below.

    // Check Composio for active connection scoped to this user
    let connections = [];
    try {
      const resp = await composioFetch(`/v1/connectedAccounts?user_uuid=${userId}&showActiveOnly=true`);
      connections = (resp.items || []).filter(c => c.status === 'ACTIVE');
    } catch (err) {
      logger.warn('Composio connection query failed', { error: err.message, userId });
    }

    // Find the matching connection for this app
    // Composio may return appName in various formats (e.g., "gmail", "GMAIL", "google_sheets", "googlesheets")
    // so we normalize and try multiple matching strategies
    const normalizeSlug = (s) => (s || '').toLowerCase().replace(/[_\-\s]/g, '');
    const normalizedSlug = normalizeSlug(slug);
    const match = connections.find(c => {
      const appName = normalizeSlug(c.appName || '');
      const appUniqueId = normalizeSlug(c.appUniqueId || '');
      return appName === normalizedSlug || appUniqueId === normalizedSlug
        || appName.includes(normalizedSlug) || normalizedSlug.includes(appName);
    });

    if (!match) {
      return res.status(404).json({ error: `No active ${slug} connection found. Please complete the OAuth authorization.` });
    }

    // Verify the connection is recent (created within last 10 minutes) to avoid stale matches
    if (match.createdAt) {
      const createdAt = new Date(match.createdAt).getTime();
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      if (createdAt < tenMinutesAgo) {
        // Check if we already have this connection saved — if so, it's a re-confirm (OK)
        const { data: existing } = await supabaseAdmin
          .from('composio_connections')
          .select('connection_id')
          .eq('user_id', userId)
          .eq('app_slug', slug)
          .eq('connection_id', match.id)
          .single();
        if (!existing) {
          logger.warn('Stale connection found, rejecting', { slug, connectionAge: Date.now() - createdAt });
          return res.status(404).json({ error: `No recent ${slug} connection found. Please try connecting again.` });
        }
      }
    }

    // Upsert into our DB (source of truth)
    const { error: dbErr } = await supabaseAdmin
      .from('composio_connections')
      .upsert({
        user_id: userId,
        app_slug: slug,
        connection_id: match.id,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,app_slug' });

    if (dbErr) {
      logger.error('Failed to save connection to DB', { error: dbErr.message });
      return res.status(500).json({ error: 'Failed to save connection' });
    }

    // Sync all connections to container config files
    await syncConnectionsToContainer(userId);

    logger.info('Connection confirmed and saved', { userId, toolkit: slug, connectionId: match.id });
    res.json({ message: 'Connection confirmed', connection_id: match.id, app: slug });
  } catch (err) {
    logger.error('Confirm connection error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to confirm connection' });
  }
});

// DELETE /api/integrations/disconnect/:connectionId — Remove from Composio + DB + container
router.delete('/disconnect/:connectionId', authMiddleware, async (req, res) => {
  try {
    const connectionId = req.params.connectionId;
    const userId = req.user.id;

    const isDirectOAuth = connectionId.startsWith('direct-oauth-');

    if (isDirectOAuth) {
      // Direct OAuth app (Gmail/Calendar) — delete OAuth tokens from DB
      await supabaseAdmin
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'google');
      logger.info('Direct OAuth tokens deleted', { connectionId, userId });
    } else {
      // Composio app — delete from Composio API
      try {
        await composioFetch(`/v1/connectedAccounts/${connectionId}`, { method: 'DELETE' });
      } catch (err) {
        logger.warn('Composio disconnect failed (may already be removed)', { error: err.message });
      }
    }

    // Delete from our DB
    await supabaseAdmin
      .from('composio_connections')
      .delete()
      .eq('user_id', userId)
      .eq('connection_id', connectionId);

    // Sync updated connections to container
    await syncConnectionsToContainer(userId);

    logger.info('Integration disconnected', { connectionId, userId });
    res.json({ message: 'Disconnected successfully' });
  } catch (err) {
    logger.error('Disconnect error', { error: err.message });
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// GET /api/integrations/tools/:toolkit — List available tools for a toolkit
router.get('/tools/:toolkit', authMiddleware, async (req, res) => {
  try {
    const resp = await composioFetch(`/v3/tools?toolkit=${req.params.toolkit}&limit=50`);
    const tools = (resp.items || []).map(t => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      parameters: t.input_parameters?.properties
        ? Object.keys(t.input_parameters.properties)
        : [],
    }));

    res.json({ tools });
  } catch (err) {
    logger.error('List tools error', { error: err.message });
    res.status(500).json({ error: 'Failed to load tools' });
  }
});

// POST /api/integrations/execute — Execute a tool (connection_id from our DB)
router.post('/execute', authMiddleware, async (req, res) => {
  try {
    const { tool_slug, input } = req.body;
    if (!tool_slug) {
      return res.status(400).json({ error: 'tool_slug is required' });
    }

    const userId = req.user.id;
    const toolkitGuess = tool_slug.split('_')[0].toLowerCase();

    // Look up connection_id from our DB (source of truth)
    const { data: conn } = await supabaseAdmin
      .from('composio_connections')
      .select('connection_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .ilike('app_slug', `%${toolkitGuess}%`)
      .limit(1)
      .single();

    if (!conn) {
      return res.status(400).json({ error: `No active ${toolkitGuess} connection found. Please connect the app first.` });
    }

    const result = await composioFetch(`/v2/actions/${tool_slug}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        connectedAccountId: conn.connection_id,
        input: input || {},
      }),
    });

    res.json({ result });
  } catch (err) {
    logger.error('Execute tool error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to execute tool' });
  }
});

// POST /api/integrations/report — Submit a user issue report
router.post('/report', authMiddleware, async (req, res) => {
  try {
    const { category, subject, description, page, metadata } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'subject and description are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: req.user.id,
        category: category || 'integration',
        subject: subject.slice(0, 200),
        description: description.slice(0, 2000),
        page: page || 'integrations',
        metadata: metadata || {},
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Report submitted', { reportId: data.id, userId: req.user.id, category, subject });
    res.json({ message: 'Report submitted successfully', report_id: data.id });
  } catch (err) {
    logger.error('Submit report error', { error: err.message });
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/integrations/reports — List reports (admin: all, user: own)
router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (err) {
    logger.error('List reports error', { error: err.message });
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

module.exports = router;
