/**
 * composio-tool.js — Composio Integration Tool for OpenClaw Agent
 *
 * Lets the agent discover and call tools from connected apps (Gmail, Google Sheets, Slack, etc.)
 * Config is read from ~/.openclaw/workspace/mcp-bridge-tools/composio-config.json
 *
 * Usage:
 *   node composio-tool.js apps                         — List connected apps
 *   node composio-tool.js tools <app>                  — List tools for an app
 *   node composio-tool.js call <tool_slug> [argsJSON]  — Call a tool
 *   node composio-tool.js search <query>               — Search tools by keyword
 *
 * Examples:
 *   node composio-tool.js apps
 *   node composio-tool.js tools gmail
 *   node composio-tool.js call GMAIL_SEND_EMAIL '{"to":"user@example.com","subject":"Hello","body":"Hi there"}'
 *   node composio-tool.js search "send email"
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(
  process.env.HOME || '/home/node',
  '.openclaw', 'workspace', 'mcp-bridge-tools', 'composio-config.json'
);

const REQUEST_TIMEOUT_MS = 30000;
const MAX_OUTPUT_CHARS = 8000;  // Prevent context overflow in LLM
const MAX_FIELD_CHARS = 500;    // Max chars per string field in results
const MAX_ARRAY_ITEMS = 5;      // Max items in result arrays

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Composio not configured. No connected integrations found.');
    console.error('Config file not found:', CONFIG_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

async function composioFetch(baseUrl, endpoint, apiKey, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw err;
  }
  clearTimeout(timeout);

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok && res.status !== 201) {
    const errDetail = json?.message || json?.error?.message || json?.error || json?.detail || '';
    throw new Error(errDetail ? `${errDetail} (HTTP ${res.status})` : `HTTP ${res.status}`);
  }
  return json;
}

// ── Commands ─────────────────────────────────────────────────────

async function cmdApps() {
  const cfg = loadConfig();
  console.log('Checking connected apps...\n');

  // New mode: use connections map from config (deterministic, no API query)
  if (cfg.connections && Object.keys(cfg.connections).length > 0) {
    const apps = Object.keys(cfg.connections);
    console.log(`Connected apps (${apps.length}):\n`);
    for (const app of apps) {
      console.log(`  - ${app}`);
    }
    console.log('\nUse: node composio-tool.js tools <app_name>  to see available tools');
    return;
  }

  // Legacy fallback: query Composio by user_id
  const userFilter = cfg.user_id || 'default';
  const resp = await composioFetch(cfg.base_url, `/v1/connectedAccounts?user_uuid=${userFilter}&showActiveOnly=true`, cfg.api_key);
  const connections = (resp.items || []).filter(c => c.status === 'ACTIVE');

  if (connections.length === 0) {
    console.log('No apps connected yet.');
    console.log('Ask the user to connect (or reconnect) apps in the Integrations page at https://likelyclaw.com/integrations');
    return;
  }

  console.log(`Connected apps (${connections.length}):\n`);
  for (const c of connections) {
    const app = (c.appName || c.appUniqueId || 'unknown').toLowerCase();
    console.log(`  - ${app} (connected: ${c.createdAt || 'unknown'})`);
  }
  console.log('\nUse: node composio-tool.js tools <app_name>  to see available tools');
}

async function cmdTools(toolkit) {
  const cfg = loadConfig();
  console.log(`Loading tools for "${toolkit}"...\n`);

  const resp = await composioFetch(cfg.base_url, `/v2/actions?apps=${toolkit}&limit=50`, cfg.api_key);
  const tools = resp.items || [];

  if (tools.length === 0) {
    console.log(`No tools found for "${toolkit}". Make sure the app name is correct.`);
    return;
  }

  console.log(`Available tools for "${toolkit}" (${tools.length}):\n`);
  for (const t of tools) {
    console.log(`  ${t.slug}`);
    if (t.name) console.log(`    Name: ${t.name}`);
    if (t.description) console.log(`    Desc: ${t.description.substring(0, 120)}`);
    if (t.input_parameters?.properties) {
      const params = Object.keys(t.input_parameters.properties);
      const required = t.input_parameters?.required || [];
      console.log(`    Params: ${params.map(p => required.includes(p) ? p + '*' : p).join(', ')}`);
    }
    console.log();
  }
}

async function cmdCall(toolSlug, argsStr) {
  const cfg = loadConfig();

  let input = {};
  if (argsStr) {
    try {
      input = JSON.parse(argsStr);
    } catch {
      console.error('Invalid JSON arguments. Use format: \'{"key": "value"}\'');
      process.exit(1);
    }
  }

  console.log(`Executing ${toolSlug}...`);

  // Determine the toolkit from the tool slug (e.g. GMAIL_SEND_EMAIL -> gmail)
  const toolkitGuess = toolSlug.split('_')[0].toLowerCase();

  // Look up connected_account_id — prefer config connections map (new mode)
  let connectedAccountId = null;

  if (cfg.connections) {
    // New mode: direct lookup from connections map (exact match first)
    connectedAccountId = cfg.connections[toolkitGuess];
    if (!connectedAccountId) {
      // Prefix match: tool slug prefix must exactly match a connection key
      // e.g. GOOGLECALENDAR_CREATE_EVENT → toolkitGuess='googlecalendar' → matches key 'googlecalendar'
      const matchKey = Object.keys(cfg.connections).find(k => k === toolkitGuess || toolkitGuess.startsWith(k));
      if (matchKey) connectedAccountId = cfg.connections[matchKey];
    }
  }

  // Legacy fallback: query Composio API
  if (!connectedAccountId) {
    try {
      const userFilter = cfg.user_id || 'default';
      const connResp = await composioFetch(cfg.base_url, `/v1/connectedAccounts?user_uuid=${userFilter}&showActiveOnly=true`, cfg.api_key);
      const connections = (connResp.items || []).filter(c => c.status === 'ACTIVE');
      const match = connections.find(c => {
        const app = (c.appName || c.appUniqueId || '').toLowerCase();
        return app === toolkitGuess || app.includes(toolkitGuess);
      });
      if (match) connectedAccountId = match.id;
    } catch (err) {
      console.error(`Warning: Could not look up connected account: ${err.message}`);
    }
  }

  if (!connectedAccountId) {
    console.error(`No active connection found for "${toolkitGuess}". Ask the user to connect the app in Integrations.`);
    process.exit(1);
  }

  // Use v2 execute endpoint
  const result = await composioFetch(cfg.base_url, `/v2/actions/${toolSlug}/execute`, cfg.api_key, {
    method: 'POST',
    body: JSON.stringify({
      connectedAccountId,
      input,
    }),
  });

  if (result.error) {
    console.error('Error:', result.error.message || JSON.stringify(result.error));
    process.exit(1);
  }

  // Try smart formatting for known Google tools first
  var formatted = formatGoogleResponse(toolSlug, result);
  if (formatted) {
    console.log(formatted);
    return;
  }

  // Generic: format output with truncation to prevent context overflow
  if (typeof result === 'object') {
    const truncated = truncateResult(result);
    const output = JSON.stringify(truncated, null, 2);
    if (output.length > MAX_OUTPUT_CHARS) {
      console.log(output.substring(0, MAX_OUTPUT_CHARS));
      console.log('\n... [output truncated to ' + MAX_OUTPUT_CHARS + ' chars. Ask user for specifics if needed.]');
    } else {
      console.log(output);
    }
  } else {
    const s = String(result);
    if (s.length > MAX_OUTPUT_CHARS) {
      console.log(s.substring(0, MAX_OUTPUT_CHARS) + '\n... [truncated]');
    } else {
      console.log(s);
    }
  }
}

// Recursively find the first array of objects in a nested Composio response
// Composio wraps data unpredictably: data.event_data.event_data, data.messages, etc.
function findDataArray(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 6 || !obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') return obj;
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var val = obj[keys[i]];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val;
  }
  // Go deeper
  for (var i = 0; i < keys.length; i++) {
    var val = obj[keys[i]];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      var found = findDataArray(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// Extract a flat string value from an object, handling nested structures
function flatVal(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if (v.dateTime) return v.dateTime;
    if (v.date) return v.date;
    if (v.email) return v.email;
    if (v.name) return v.name;
    if (v.title) return v.title;
    if (v.text) return v.text;
    if (v.content) return String(v.content).substring(0, 300);
    return JSON.stringify(v).substring(0, 200);
  }
  return String(v);
}

// Smart response formatting for Google/known apps — extracts only essential fields
function formatGoogleResponse(toolSlug, result) {
  var slug = (toolSlug || '').toUpperCase();
  // Unwrap Composio's response envelope
  var payload = result.response_data || result.data || result;

  // --- Google Calendar: events ---
  if (slug.includes('GOOGLECALENDAR') && (slug.includes('FIND') || slug.includes('LIST') || slug.includes('GET'))) {
    var items = findDataArray(payload);
    if (!items) return 'No events found.';
    if (items.length === 0) return 'No events found.';
    var lines = ['=== Calendar Events (' + items.length + ') ===\n'];
    items.slice(0, 10).forEach(function(ev, i) {
      lines.push('--- Event ' + (i+1) + ' ---');
      if (ev.summary) lines.push('Title: ' + ev.summary);
      if (ev.start) lines.push('Start: ' + flatVal(ev.start));
      if (ev.end) lines.push('End: ' + flatVal(ev.end));
      if (ev.location) lines.push('Location: ' + ev.location);
      if (ev.status) lines.push('Status: ' + ev.status);
      if (ev.htmlLink) lines.push('Link: ' + ev.htmlLink);
      if (ev.eventType) lines.push('Type: ' + ev.eventType);
      lines.push('');
    });
    return lines.join('\n');
  }

  // --- Google Calendar: create event ---
  if (slug.includes('GOOGLECALENDAR') && slug.includes('CREATE')) {
    // Try to find the event object in response
    var ev = payload;
    if (payload.event_data) ev = payload.event_data;
    if (ev.id || ev.summary || ev.htmlLink) {
      var lines = ['Event created successfully!'];
      if (ev.summary) lines.push('Title: ' + ev.summary);
      if (ev.id) lines.push('ID: ' + ev.id);
      if (ev.start) lines.push('Start: ' + flatVal(ev.start));
      if (ev.end) lines.push('End: ' + flatVal(ev.end));
      if (ev.htmlLink) lines.push('Link: ' + ev.htmlLink);
      return lines.join('\n');
    }
    return null;
  }

  // --- Gmail: fetch/list emails ---
  if (slug.includes('GMAIL') && (slug.includes('FETCH') || slug.includes('LIST') || slug.includes('GET'))) {
    var messages = findDataArray(payload);
    if (!messages) return null;
    var lines = ['=== Emails (' + messages.length + ') ===\n'];
    messages.slice(0, 10).forEach(function(m, i) {
      lines.push('--- Email ' + (i+1) + ' ---');
      // Composio may put headers in different fields
      var from = m.from || m.sender || (m.payload && m.payload.headers && m.payload.headers.find && m.payload.headers.find(function(h){return h.name==='From'}) || {}).value || '';
      var subject = m.subject || (m.payload && m.payload.headers && m.payload.headers.find && m.payload.headers.find(function(h){return h.name==='Subject'}) || {}).value || '';
      if (from) lines.push('From: ' + flatVal(from));
      if (subject) lines.push('Subject: ' + flatVal(subject));
      if (m.date || m.internalDate) lines.push('Date: ' + (m.date || new Date(parseInt(m.internalDate)).toLocaleString()));
      if (m.snippet) lines.push('Preview: ' + String(m.snippet).substring(0, 200));
      if (m.threadId) lines.push('ThreadID: ' + m.threadId);
      lines.push('');
    });
    return lines.join('\n');
  }

  // --- Gmail: send email ---
  if (slug.includes('GMAIL') && slug.includes('SEND')) {
    if (payload.id || payload.threadId || payload.labelIds) {
      var lines = ['Email sent successfully!'];
      if (payload.id) lines.push('Message ID: ' + payload.id);
      if (payload.threadId) lines.push('Thread ID: ' + payload.threadId);
      return lines.join('\n');
    }
    // Check nested
    var inner = payload.response || payload.result || payload;
    if (inner && inner.id) {
      return 'Email sent successfully!\nMessage ID: ' + inner.id;
    }
    return null;
  }

  // --- Google Sheets ---
  if (slug.includes('GOOGLESHEETS')) {
    // Read/get data — look for values array
    var values = null;
    if (payload.values) values = payload.values;
    else {
      // Deep search for 'values' key
      var q = [payload];
      for (var d = 0; d < 5 && !values; d++) {
        var next = [];
        for (var j = 0; j < q.length; j++) {
          if (!q[j] || typeof q[j] !== 'object') continue;
          if (q[j].values && Array.isArray(q[j].values)) { values = q[j].values; break; }
          var ks = Object.keys(q[j]);
          for (var k = 0; k < ks.length; k++) {
            if (q[j][ks[k]] && typeof q[j][ks[k]] === 'object') next.push(q[j][ks[k]]);
          }
        }
        q = next;
      }
    }
    if (values && Array.isArray(values) && values.length > 0 && Array.isArray(values[0])) {
      var lines = ['=== Sheet Data (' + values.length + ' rows) ===\n'];
      // Use first row as header
      if (values.length > 0) lines.push(values[0].join(' | '));
      if (values.length > 1) lines.push(values[0].map(function(){return '---';}).join(' | '));
      values.slice(1, 30).forEach(function(row) {
        if (Array.isArray(row)) lines.push(row.join(' | '));
      });
      if (values.length > 30) lines.push('... (' + (values.length - 30) + ' more rows)');
      return lines.join('\n');
    }
    // List spreadsheets — look for files array
    var files = findDataArray(payload);
    if (files && files.length > 0 && (files[0].spreadsheetId || files[0].id || files[0].name)) {
      var lines = ['=== Spreadsheets (' + files.length + ') ===\n'];
      files.slice(0, 10).forEach(function(f, i) {
        lines.push((i+1) + '. ' + (f.name || (f.properties && f.properties.title) || 'Untitled'));
        if (f.spreadsheetId || f.id) lines.push('   ID: ' + (f.spreadsheetId || f.id));
        if (f.spreadsheetUrl || f.webViewLink) lines.push('   Link: ' + (f.spreadsheetUrl || f.webViewLink));
      });
      return lines.join('\n');
    }
    return null;
  }

  // --- Google Docs ---
  if (slug.includes('GOOGLEDOCS')) {
    // Find doc data - might be nested
    var doc = payload;
    if (!doc.title && !doc.documentId) {
      var keys = Object.keys(payload);
      for (var i = 0; i < keys.length; i++) {
        var v = payload[keys[i]];
        if (v && typeof v === 'object' && (v.title || v.documentId)) { doc = v; break; }
      }
    }
    if (doc.title || doc.documentId) {
      var lines = [];
      if (doc.title) lines.push('Title: ' + doc.title);
      if (doc.documentId) lines.push('ID: ' + doc.documentId);
      if (doc.documentId) lines.push('Link: https://docs.google.com/document/d/' + doc.documentId + '/edit');
      // Extract body text
      if (doc.body && doc.body.content) {
        var text = '';
        doc.body.content.forEach(function(el) {
          if (el.paragraph && el.paragraph.elements) {
            el.paragraph.elements.forEach(function(e) {
              if (e.textRun && e.textRun.content) text += e.textRun.content;
            });
          }
        });
        if (text.trim()) {
          lines.push('\n--- Content ---');
          lines.push(text.substring(0, 4000));
          if (text.length > 4000) lines.push('... (' + (text.length - 4000) + ' more chars)');
        }
      }
      if (lines.length > 0) return lines.join('\n');
    }
    // List docs
    var files = findDataArray(payload);
    if (files && files.length > 0) {
      var lines = ['=== Documents (' + files.length + ') ===\n'];
      files.slice(0, 10).forEach(function(f, i) {
        lines.push((i+1) + '. ' + (f.name || f.title || 'Untitled'));
        if (f.id || f.documentId) lines.push('   ID: ' + (f.id || f.documentId));
      });
      return lines.join('\n');
    }
    return null;
  }

  // --- Google Drive ---
  if (slug.includes('GOOGLEDRIVE') || slug.includes('GOOGLE_DRIVE')) {
    var files = findDataArray(payload);
    if (files && files.length > 0) {
      var lines = ['=== Drive Files (' + files.length + ') ===\n'];
      files.slice(0, 15).forEach(function(f, i) {
        var type = (f.mimeType || '').includes('folder') ? 'Folder' :
                   (f.mimeType || '').includes('spreadsheet') ? 'Sheet' :
                   (f.mimeType || '').includes('document') ? 'Doc' :
                   (f.mimeType || '').includes('presentation') ? 'Slides' :
                   (f.mimeType || '').includes('pdf') ? 'PDF' :
                   (f.mimeType || '').includes('image') ? 'Image' : 'File';
        lines.push((i+1) + '. [' + type + '] ' + (f.name || 'Untitled'));
        if (f.id) lines.push('   ID: ' + f.id);
        if (f.webViewLink) lines.push('   Link: ' + f.webViewLink);
        if (f.modifiedTime) lines.push('   Modified: ' + f.modifiedTime);
      });
      return lines.join('\n');
    }
    return null;
  }

  // --- Slack ---
  if (slug.includes('SLACK')) {
    if (slug.includes('SEND') && (payload.ok || payload.ts || payload.channel)) {
      return 'Message sent successfully!' + (payload.channel ? '\nChannel: ' + payload.channel : '') + (payload.ts ? '\nTimestamp: ' + payload.ts : '');
    }
    var items = findDataArray(payload);
    if (items && items.length > 0) {
      var lines = ['=== Slack Results (' + items.length + ') ===\n'];
      items.slice(0, 10).forEach(function(m, i) {
        lines.push('--- ' + (i+1) + ' ---');
        if (m.name) lines.push('Name: ' + m.name);
        if (m.text) lines.push('Text: ' + String(m.text).substring(0, 300));
        if (m.user) lines.push('User: ' + m.user);
        if (m.ts) lines.push('Time: ' + m.ts);
        lines.push('');
      });
      return lines.join('\n');
    }
    return null;
  }

  return null; // no smart formatting available — fall through to generic truncation
}

// Deep-truncate large objects to fit within LLM context limits
function truncateResult(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 4) return '[nested object]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.length > MAX_FIELD_CHARS) {
      return obj.substring(0, MAX_FIELD_CHARS) + '... [' + obj.length + ' chars total]';
    }
    return obj;
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    var truncArr = obj.slice(0, MAX_ARRAY_ITEMS).map(function(item) { return truncateResult(item, depth + 1); });
    if (obj.length > MAX_ARRAY_ITEMS) {
      truncArr.push('... [' + (obj.length - MAX_ARRAY_ITEMS) + ' more items]');
    }
    return truncArr;
  }
  var out = {};
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    out[keys[i]] = truncateResult(obj[keys[i]], depth + 1);
  }
  return out;
}

async function cmdSearch(query) {
  const cfg = loadConfig();
  console.log(`Searching tools for "${query}"...\n`);

  // Get connected apps — prefer config connections map (new mode)
  let connectedApps = [];
  if (cfg.connections && Object.keys(cfg.connections).length > 0) {
    connectedApps = Object.keys(cfg.connections);
  } else {
    // Legacy fallback: query Composio
    const userFilter = cfg.user_id || 'default';
    const connResp = await composioFetch(cfg.base_url, `/v1/connectedAccounts?user_uuid=${userFilter}&showActiveOnly=true`, cfg.api_key);
    const connections = (connResp.items || []).filter(c => c.status === 'ACTIVE');
    connectedApps = connections.map(c => (c.appName || c.appUniqueId || '').toLowerCase());
  }

  if (connectedApps.length === 0) {
    console.log('No apps connected. Ask user to connect apps first.');
    return;
  }

  // Search across connected apps
  const allTools = [];
  for (const app of connectedApps) {
    try {
      const resp = await composioFetch(cfg.base_url, `/v2/actions?apps=${app}&limit=30`, cfg.api_key);
      for (const t of (resp.items || [])) {
        allTools.push({ ...t, app });
      }
    } catch {}
  }

  // Filter by query
  const q = query.toLowerCase();
  const matches = allTools.filter(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    (t.slug || '').toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    console.log(`No tools found matching "${query}".`);
    console.log(`Connected apps: ${connectedApps.join(', ')}`);
    return;
  }

  console.log(`Found ${matches.length} tool(s) matching "${query}":\n`);
  for (const t of matches.slice(0, 15)) {
    console.log(`  ${t.slug} (${t.app})`);
    if (t.name) console.log(`    ${t.name}`);
    if (t.description) console.log(`    ${t.description.substring(0, 100)}`);
    console.log();
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const [,, cmd, arg1, arg2] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`Composio Integration Tool

Usage:
  node composio-tool.js apps                         — List connected apps
  node composio-tool.js tools <app>                  — List tools for an app
  node composio-tool.js call <tool_slug> [argsJSON]  — Call a tool
  node composio-tool.js search <query>               — Search tools by keyword

Examples:
  node composio-tool.js apps
  node composio-tool.js tools gmail
  node composio-tool.js call GMAIL_SEND_EMAIL '{"to":"user@example.com","subject":"Hi","body":"Hello"}'
  node composio-tool.js search "spreadsheet"`);
    return;
  }

  if (cmd === 'apps') {
    await cmdApps();
  } else if (cmd === 'tools') {
    if (!arg1) { console.error('Missing app name. Use: tools <app>'); process.exit(1); }
    await cmdTools(arg1);
  } else if (cmd === 'call') {
    if (!arg1) { console.error('Missing tool slug. Use: call <tool_slug> [argsJSON]'); process.exit(1); }
    await cmdCall(arg1, arg2);
  } else if (cmd === 'search') {
    if (!arg1) { console.error('Missing query. Use: search <query>'); process.exit(1); }
    await cmdSearch(process.argv.slice(3).join(' '));
  } else {
    console.error(`Unknown command "${cmd}". Use: apps | tools | call | search`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Composio Tool Error:', err.message);
  process.exit(1);
});
