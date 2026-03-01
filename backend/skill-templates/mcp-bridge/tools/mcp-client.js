/**
 * mcp-client.js — Universal MCP (Model Context Protocol) HTTP Client
 *
 * Lets the agent interact with ANY remote MCP server via Streamable HTTP transport.
 * Servers are configured in ~/.openclaw/workspace/mcp-bridge-tools/mcp-servers.json
 *
 * Supports transport types: stateless (default), stream, sse
 * Make.com URL format: https://<ZONE>.make.com/mcp/stateless (with Bearer token)
 *   or: https://<ZONE>.make.com/mcp/u/<TOKEN>/stateless (token in URL)
 *
 * Usage:
 *   node mcp-client.js servers                          — List configured MCP servers
 *   node mcp-client.js <server> list                    — List tools on a server
 *   node mcp-client.js <server> call <tool> [argsJSON]  — Call a tool
 *   node mcp-client.js <server> test                    — Test connection to a server
 *
 * Examples:
 *   node mcp-client.js servers
 *   node mcp-client.js make list
 *   node mcp-client.js make call execute_scenario '{"scenario_id":"12345"}'
 *   node mcp-client.js vapi call list_assistants '{}'
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(
  process.env.HOME || '/home/node',
  '.openclaw', 'workspace', 'mcp-bridge-tools', 'mcp-servers.json'
);

const REQUEST_TIMEOUT_MS = 30000;

// ── JSON-RPC helper ──────────────────────────────────────────────
let reqId = 1;

async function mcpRequest(url, method, params, sessionId, authToken) {
  const headers = {
    'Accept': 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: reqId++,
    method,
    params: params || {},
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw err;
  }
  clearTimeout(timeout);

  const contentType = res.headers.get('content-type') || '';

  // Handle SSE responses — collect last JSON-RPC message
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const lines = text.split('\n');
    let lastData = null;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        lastData = line.slice(6);
      }
    }
    if (lastData) return JSON.parse(lastData);
    throw new Error('SSE response contained no data events');
  }

  // Normal JSON response
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

// ── Initialize session (stateless servers may not need this) ─────
async function initSession(url, authToken) {
  try {
    const resp = await mcpRequest(url, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'claw-mcp-client', version: '1.0.0' },
    }, null, authToken);
    return resp?.result?.sessionId || null;
  } catch (err) {
    // Stateless servers might not require initialize — continue without session
    console.log(`Note: Initialize returned error (${err.message}), continuing without session.`);
    return null;
  }
}

// ── Load config ──────────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('No MCP servers configured.');
    console.error('Config file not found:', CONFIG_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function getServer(config, name) {
  const srv = config.servers?.[name];
  if (!srv) {
    console.error(`Server "${name}" not found. Available servers:`);
    for (const k of Object.keys(config.servers || {})) {
      console.error(`  - ${k}: ${config.servers[k].url}`);
    }
    process.exit(1);
  }
  return srv;
}

// ── Commands ─────────────────────────────────────────────────────
async function cmdServers() {
  const config = loadConfig();
  const servers = config.servers || {};
  const names = Object.keys(servers);
  if (names.length === 0) {
    console.log('No MCP servers configured.');
    return;
  }
  console.log(`Configured MCP servers (${names.length}):\n`);
  for (const name of names) {
    const s = servers[name];
    console.log(`  ${name}`);
    console.log(`    URL: ${s.url}`);
    if (s.auth) console.log(`    Auth: ${s.auth.type} (configured)`);
    console.log();
  }
}

async function cmdList(serverName) {
  const config = loadConfig();
  const srv = getServer(config, serverName);
  const authToken = srv.auth?.token;

  console.log(`Connecting to "${serverName}" at ${srv.url}...`);
  const sessionId = await initSession(srv.url, authToken);

  const resp = await mcpRequest(srv.url, 'tools/list', {}, sessionId, authToken);
  const tools = resp?.result?.tools || [];

  if (tools.length === 0) {
    console.log('No tools available on this server.');
    return;
  }

  console.log(`\nAvailable tools on "${serverName}" (${tools.length}):\n`);
  for (const tool of tools) {
    console.log(`  ${tool.name}`);
    if (tool.description) console.log(`    ${tool.description}`);
    if (tool.inputSchema?.properties) {
      const props = Object.keys(tool.inputSchema.properties);
      const required = tool.inputSchema.required || [];
      console.log(`    Parameters: ${props.map(p => required.includes(p) ? p + '*' : p).join(', ')}`);
    }
    console.log();
  }
}

async function cmdCall(serverName, toolName, argsStr) {
  const config = loadConfig();
  const srv = getServer(config, serverName);
  const authToken = srv.auth?.token;

  let args = {};
  if (argsStr) {
    try {
      args = JSON.parse(argsStr);
    } catch {
      console.error('Invalid JSON arguments. Use format: \'{"key": "value"}\'');
      process.exit(1);
    }
  }

  const sessionId = await initSession(srv.url, authToken);

  console.log(`Calling ${serverName}.${toolName}...`);
  const resp = await mcpRequest(srv.url, 'tools/call', {
    name: toolName,
    arguments: args,
  }, sessionId, authToken);

  if (resp?.error) {
    console.error('Error:', resp.error.message || JSON.stringify(resp.error));
    process.exit(1);
  }

  const content = resp?.result?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text') {
        console.log(item.text);
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    }
  } else {
    console.log(JSON.stringify(resp?.result || resp, null, 2));
  }
}

// ── Test connection ──────────────────────────────────────────────
async function cmdTest(serverName) {
  const config = loadConfig();
  const srv = getServer(config, serverName);
  const authToken = srv.auth?.token;

  console.log(`Testing connection to "${serverName}"...`);
  console.log(`  URL: ${srv.url}`);
  console.log(`  Auth: ${authToken ? 'Bearer token configured' : 'NONE'}`);
  console.log();

  // Step 1: Test HTTP connectivity
  console.log('1. Testing HTTP connectivity...');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(srv.url, { method: 'POST', headers, body: '{}', signal: controller.signal });
    clearTimeout(timeout);
    console.log(`   ✅ Server responded: HTTP ${res.status} (${res.headers.get('content-type') || 'no content-type'})`);
  } catch (err) {
    console.log(`   ❌ Connection failed: ${err.message}`);
    console.log('\n   Possible issues:');
    console.log('   - URL might be wrong (check transport suffix: /stateless, /stream, or /sse)');
    console.log('   - Server might be down');
    return;
  }

  // Step 2: Test MCP initialize
  console.log('2. Testing MCP initialize...');
  const sessionId = await initSession(srv.url, authToken);
  console.log(`   Session: ${sessionId || '(stateless/none)'}`);

  // Step 3: List tools
  console.log('3. Listing tools...');
  try {
    const resp = await mcpRequest(srv.url, 'tools/list', {}, sessionId, authToken);
    const tools = resp?.result?.tools || [];
    if (tools.length === 0) {
      console.log('   ⚠️  0 tools returned.');
      console.log('\n   If this is Make.com:');
      console.log('   - Ensure your MCP token has "mcp:use" scope');
      console.log('   - Ensure scenarios are active AND set to "On-demand" scheduling');
      console.log('   - URL must end with /stateless, /stream, or /sse');
      console.log('   - Correct format: https://<ZONE>.make.com/mcp/stateless');
    } else {
      console.log(`   ✅ Found ${tools.length} tool(s):`);
      for (const t of tools) {
        console.log(`      - ${t.name}: ${t.description || '(no description)'}`);
      }
    }
  } catch (err) {
    console.log(`   ❌ Tools list failed: ${err.message}`);
  }

  // Step 4: Check raw response for debugging
  console.log('\n4. Raw tools/list response:');
  try {
    const headers = {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const body = JSON.stringify({ jsonrpc: '2.0', id: 999, method: 'tools/list', params: {} });
    const res = await fetch(srv.url, { method: 'POST', headers, body });
    const rawText = await res.text();
    console.log(`   Status: ${res.status}`);
    console.log(`   Content-Type: ${res.headers.get('content-type')}`);
    console.log(`   Body (first 500 chars): ${rawText.substring(0, 500)}`);
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const [,, cmd, arg1, arg2] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`Usage:
  node mcp-client.js servers                          — List configured servers
  node mcp-client.js <server> list                    — List tools on a server
  node mcp-client.js <server> call <tool> [argsJSON]  — Call a tool
  node mcp-client.js <server> test                    — Test connection & debug

Examples:
  node mcp-client.js make list
  node mcp-client.js make call execute_scenario '{"scenario_id":"12345"}'
  node mcp-client.js make test`);
    return;
  }

  if (cmd === 'servers') {
    await cmdServers();
    return;
  }

  // cmd = server name
  if (!arg1) {
    console.error('Missing sub-command. Use: list | call <tool> [args] | test');
    process.exit(1);
  }

  if (arg1 === 'list') {
    await cmdList(cmd);
  } else if (arg1 === 'test') {
    await cmdTest(cmd);
  } else if (arg1 === 'call') {
    if (!arg2) {
      console.error('Missing tool name. Use: <server> call <tool> [argsJSON]');
      process.exit(1);
    }
    await cmdCall(cmd, arg2, process.argv[5]);
  } else {
    console.error(`Unknown command "${arg1}". Use: list | call | test`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('MCP Client Error:', err.message);
  process.exit(1);
});
