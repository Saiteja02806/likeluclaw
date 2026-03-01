/**
 * mcp-executor.js — MCP Sub-Agent (Command Specialist)
 *
 * A lightweight AI sub-agent that lives inside the container.
 * The main agent delegates MCP tasks to this script instead of
 * trying to construct commands itself.
 *
 * What it does:
 *   1. Reads all configured MCP servers
 *   2. Discovers available tools on each server
 *   3. Sends the tool catalog + user task to GPT
 *   4. GPT picks the right tool and generates correct arguments
 *   5. Calls the tool via MCP
 *   6. If it fails, feeds the error back to GPT for retry (up to 3 attempts)
 *   7. Returns the final result
 *
 * Usage:
 *   node mcp-executor.js "your task in plain English"
 *   node mcp-executor.js --server "make automation" "create a scenario that sends emails"
 *
 * Examples:
 *   node mcp-executor.js "list all my Make.com scenarios"
 *   node mcp-executor.js "trigger scenario 12345 with input data hello world"
 *   node mcp-executor.js --server vapi "create a phone call to +1555000 saying hello"
 */

const fs = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────
const HOME = process.env.HOME || '/home/node';
const MCP_DIR = path.join(HOME, '.openclaw', 'workspace', 'mcp-bridge-tools');
const SERVERS_PATH = path.join(MCP_DIR, 'mcp-servers.json');
const CONFIG_PATH = path.join(HOME, '.openclaw', 'openclaw.json');

const MAX_RETRIES = 3;
const MAX_NETWORK_RETRIES = 1;

// Budget models per provider (cheap, fast, good for tool selection)
const BUDGET_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  google: 'gemini-2.0-flash',
};

const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

// ── Load LLM API key from container config (supports all providers) ──
function getApiKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const providers = cfg?.models?.providers || {};
    for (const [name, prov] of Object.entries(providers)) {
      if (prov?.apiKey) {
        return {
          apiKey: prov.apiKey,
          baseUrl: prov.baseUrl || DEFAULT_BASE_URLS[name] || DEFAULT_BASE_URLS.openai,
          provider: name,
          model: BUDGET_MODELS[name] || BUDGET_MODELS.openai,
        };
      }
    }
  } catch {}

  // Fallback: check auth-profiles for any provider
  const agentsDir = path.join(HOME, '.openclaw', 'agents');
  if (fs.existsSync(agentsDir)) {
    const dirs = fs.readdirSync(agentsDir);
    for (const d of dirs) {
      const authFile = path.join(agentsDir, d, 'agent', 'auth-profiles.json');
      if (fs.existsSync(authFile)) {
        try {
          const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
          const profiles = auth?.profiles || {};
          for (const [profileKey, profile] of Object.entries(profiles)) {
            if (profile?.key) {
              const provName = profileKey.split(':')[0] || 'openai';
              return {
                apiKey: profile.key,
                baseUrl: DEFAULT_BASE_URLS[provName] || DEFAULT_BASE_URLS.openai,
                provider: provName,
                model: BUDGET_MODELS[provName] || BUDGET_MODELS.openai,
              };
            }
          }
        } catch {}
      }
    }
  }

  console.error('ERROR: No LLM API key found in container config. Checked: openai, anthropic, google.');
  process.exit(1);
}

// ── MCP HTTP Client ─────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 20000;
let reqId = 1;

async function mcpRequest(url, method, params, sessionId, authToken) {
  const headers = {
    'Accept': 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const body = JSON.stringify({ jsonrpc: '2.0', id: reqId++, method, params: params || {} });

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

  const ct = res.headers.get('content-type') || '';

  if (ct.includes('text/event-stream')) {
    const text = await res.text();
    let lastData = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) lastData = line.slice(6);
    }
    if (lastData) return JSON.parse(lastData);
    throw new Error('SSE response contained no data events');
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

async function mcpInit(url, authToken) {
  try {
    const resp = await mcpRequest(url, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'claw-mcp-executor', version: '1.0.0' },
    }, null, authToken);
    return resp?.result?.sessionId || null;
  } catch {
    // Stateless servers may not need initialize — continue without session
    return null;
  }
}

async function mcpListTools(url, sessionId, authToken) {
  const resp = await mcpRequest(url, 'tools/list', {}, sessionId, authToken);
  return resp?.result?.tools || [];
}

async function mcpCallTool(url, sessionId, authToken, toolName, args) {
  const resp = await mcpRequest(url, 'tools/call', { name: toolName, arguments: args }, sessionId, authToken);
  if (resp?.error) throw new Error(resp.error.message || JSON.stringify(resp.error));

  const content = resp?.result?.content;
  if (Array.isArray(content)) {
    return content.map(item => item.type === 'text' ? item.text : JSON.stringify(item)).join('\n');
  }
  return JSON.stringify(resp?.result || resp, null, 2);
}

// ── LLM Chat Completion (works with any provider via proxy) ─────
async function chatCompletion(apiKey, baseUrl, messages, model) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Discover all tools across all servers ────────────────────────
async function discoverTools(serverFilter) {
  const config = JSON.parse(fs.readFileSync(SERVERS_PATH, 'utf8'));
  const servers = config.servers || {};
  const catalog = [];

  for (const [name, srv] of Object.entries(servers)) {
    if (serverFilter && name !== serverFilter) continue;

    try {
      const authToken = srv.auth?.token;
      const sessionId = await mcpInit(srv.url, authToken);
      const tools = await mcpListTools(srv.url, sessionId, authToken);

      catalog.push({
        serverName: name,
        serverUrl: srv.url,
        authToken: srv.auth?.token,
        sessionId,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description || '',
          parameters: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
          required: t.inputSchema?.required || [],
          schema: t.inputSchema || {},
        })),
      });
    } catch (err) {
      catalog.push({
        serverName: name,
        serverUrl: srv.url,
        error: err.message,
        tools: [],
        hint: srv.url.includes('make.com') ? 'Make.com URL must end with /stateless, /stream, or /sse. Format: https://<ZONE>.make.com/mcp/stateless' : null,
      });
    }
  }

  return catalog;
}

// ── Build tool catalog string for the LLM ────────────────────────
function buildToolCatalog(catalog) {
  const lines = [];
  let totalTools = 0;

  for (const srv of catalog) {
    lines.push(`\n## Server: "${srv.serverName}"`);
    if (srv.error) {
      lines.push(`  Connection error: ${srv.error}`);
      continue;
    }
    if (srv.tools.length === 0) {
      lines.push('  No tools available on this server.');
      lines.push('  NOTE: This server has no tools exposed. The user may need to configure scenarios in the platform (e.g. Make.com: set scenarios to "on-demand" scheduling and activate them).');
      continue;
    }

    for (const tool of srv.tools) {
      totalTools++;
      lines.push(`\n  Tool: ${tool.name}`);
      if (tool.description) lines.push(`    Description: ${tool.description}`);
      if (tool.parameters.length > 0) {
        lines.push(`    Parameters: ${tool.parameters.map(p => tool.required.includes(p) ? p + ' (required)' : p).join(', ')}`);
      }
      if (tool.schema.properties) {
        lines.push(`    Schema: ${JSON.stringify(tool.schema.properties, null, 2).substring(0, 500)}`);
      }
    }
  }

  return { text: lines.join('\n'), totalTools };
}

// ── Main execution loop ──────────────────────────────────────────
async function execute(task, serverFilter) {
  const { apiKey, baseUrl, model } = getApiKey();

  // Step 1: Discover all available tools
  console.log('🔍 Discovering MCP tools...');
  const catalog = await discoverTools(serverFilter);
  const { text: catalogText, totalTools } = buildToolCatalog(catalog);

  if (totalTools === 0) {
    console.log('\n⚠️  No tools found on any MCP server.');
    console.log('\nServer status:');
    for (const srv of catalog) {
      if (srv.error) {
        console.log(`  ❌ ${srv.serverName}: ${srv.error}`);
      } else {
        console.log(`  ✅ ${srv.serverName}: Connected but 0 tools available`);
        console.log(`     → If this is Make.com: Go to Make.com dashboard, create a scenario,`);
        console.log(`       set scheduling to "On-demand", and activate it.`);
        console.log(`       Then the scenario will appear as a tool here.`);
      }
    }
    return;
  }

  console.log(`✅ Found ${totalTools} tool(s) across ${catalog.length} server(s)\n`);

  // Step 2: Ask GPT to pick the right tool and generate arguments
  const systemPrompt = `You are an MCP tool execution specialist. Your ONLY job is to:
1. Look at the available tools catalog below
2. Pick the BEST matching tool for the user's task
3. Generate the CORRECT arguments as valid JSON

AVAILABLE TOOLS:
${catalogText}

RULES:
- You MUST pick a tool that actually exists in the catalog above. NEVER invent tool names.
- If no tool matches the task, respond with: {"action": "no_match", "reason": "explanation"}
- If a tool matches, respond with:
  {
    "action": "call",
    "server": "server name exactly as shown",
    "tool": "tool name exactly as shown",
    "arguments": { ... valid JSON arguments matching the tool schema ... },
    "explanation": "brief explanation of what this will do"
  }
- Arguments MUST match the tool's parameter schema. Use required parameters at minimum.
- Respond ONLY with JSON. No markdown, no extra text.`;

  let lastError = null;
  let networkRetries = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`🤖 Attempt ${attempt}/${MAX_RETRIES}: Asking AI to pick the right tool...`);

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    if (attempt === 1) {
      messages.push({ role: 'user', content: `Task: ${task}` });
    } else {
      messages.push({ role: 'user', content: `Task: ${task}\n\nPREVIOUS ATTEMPT FAILED with error:\n${lastError}\n\nPlease try a different approach or fix the arguments.` });
    }

    let decision;
    try {
      const response = await chatCompletion(apiKey, baseUrl, messages, model);
      decision = JSON.parse(response);
    } catch (err) {
      console.error(`❌ AI response error: ${err.message}`);
      lastError = err.message;
      continue;
    }

    if (decision.action === 'no_match') {
      console.log(`\n⚠️  No matching tool found.`);
      console.log(`Reason: ${decision.reason}`);
      console.log(`\nAvailable tools:`);
      for (const srv of catalog) {
        for (const t of srv.tools) {
          console.log(`  - ${srv.serverName} → ${t.name}: ${t.description}`);
        }
      }
      return;
    }

    if (decision.action !== 'call') {
      console.error('❌ Unexpected AI response:', JSON.stringify(decision));
      lastError = 'Unexpected response format';
      continue;
    }

    // Find the server in our catalog
    const targetSrv = catalog.find(s => s.serverName === decision.server);
    if (!targetSrv) {
      console.error(`❌ Server "${decision.server}" not found in catalog`);
      lastError = `Server "${decision.server}" not in catalog`;
      continue;
    }

    // Verify tool exists
    const targetTool = targetSrv.tools.find(t => t.name === decision.tool);
    if (!targetTool) {
      console.error(`❌ Tool "${decision.tool}" not found on server "${decision.server}"`);
      lastError = `Tool "${decision.tool}" doesn't exist. Available tools: ${targetSrv.tools.map(t => t.name).join(', ')}`;
      continue;
    }

    console.log(`📋 Selected: ${decision.server} → ${decision.tool}`);
    console.log(`   Args: ${JSON.stringify(decision.arguments)}`);
    if (decision.explanation) console.log(`   Why: ${decision.explanation}`);

    // Step 3: Call the tool
    try {
      console.log(`\n⚡ Executing ${decision.tool}...`);
      const result = await mcpCallTool(
        targetSrv.serverUrl,
        targetSrv.sessionId,
        targetSrv.authToken,
        decision.tool,
        decision.arguments || {}
      );

      console.log(`\n✅ Success!\n`);
      console.log(result);
      return;
    } catch (err) {
      console.error(`\n❌ Tool call failed: ${err.message}`);
      lastError = `Tool "${decision.tool}" returned error: ${err.message}`;
      const lowerErr = String(err.message || '').toLowerCase();
      const isNetworkTransportError =
        lowerErr.includes('network connection lost') ||
        lowerErr.includes('request timed out') ||
        lowerErr.includes('socket hang up') ||
        lowerErr.includes('econnreset') ||
        lowerErr.includes('etimedout') ||
        lowerErr.includes('aborterror');

      // Fast-fail on transport/network errors so chat doesn't burn minutes retrying the same call.
      if (isNetworkTransportError) {
        if (networkRetries < MAX_NETWORK_RETRIES && attempt < MAX_RETRIES) {
          networkRetries += 1;
          console.log('   Transient transport/network failure detected. Retrying once quickly...');
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.log('   Not retrying further: transport/network failure persisted.');
        break;
      }

      if (attempt < MAX_RETRIES) {
        console.log(`   Retrying with error feedback...`);
      }
    }
  }

  console.error(`\n❌ All ${MAX_RETRIES} attempts failed. Last error: ${lastError}`);
}

// ── CLI ──────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === 'help') {
    console.log(`MCP Executor — AI-powered sub-agent for MCP tool execution

Usage:
  node mcp-executor.js "your task in plain English"
  node mcp-executor.js --server <name> "your task"

Examples:
  node mcp-executor.js "list all my scenarios"
  node mcp-executor.js "trigger scenario 12345"
  node mcp-executor.js --server "make automation" "send an email via automation"

How it works:
  1. Discovers all available MCP tools
  2. AI picks the right tool + generates correct arguments
  3. Calls the tool via MCP
  4. If it fails, AI retries with error context (up to 3 attempts)`);
    return;
  }

  let serverFilter = null;
  let task = '';

  if (args[0] === '--server' && args.length >= 3) {
    serverFilter = args[1];
    task = args.slice(2).join(' ');
  } else {
    task = args.join(' ');
  }

  if (!task) {
    console.error('Please provide a task description.');
    process.exit(1);
  }

  execute(task, serverFilter).catch(err => {
    console.error('MCP Executor Error:', err.message);
    process.exit(1);
  });
}

main();
