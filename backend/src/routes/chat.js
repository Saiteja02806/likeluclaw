const express = require('express');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const logger = require('../config/logger');
const wsPool = require('../lib/wsPool');
const { publishEvent, streamSSE } = require('../lib/redisEvents');
const k8s = require('../lib/k8s-utils');

const router = express.Router();

// ── Helper: find the user's first running employee ──
async function findRunningEmployee(userId) {
  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, name, user_id, status, container_name, gateway_token')
    .eq('user_id', userId)
    .eq('status', 'running')
    .limit(1)
    .single();
  return data;
}

// ── Helper: reset agent session by restarting K8s pod ──
function resetAgentSession(userId, employee) {
  // Invalidate the WS pool entry immediately so a fresh connection is made
  wsPool.removePool(employee.id);
  // Restart the pod in background (K8s will recreate it — sessions are ephemeral)
  k8s.restartAgentPod(userId).catch(err => {
    logger.warn('Could not restart agent pod for session reset', { error: err.message });
  });
  logger.info('Agent session reset (pod restart)', { employeeId: employee.id });
  return true;
}

// sendToGateway is now handled by wsPool (persistent WS connections)

// ── Tool command reference for connected integrations ──
// Maps app slugs to the exact exec commands the agent should use
const INTEGRATION_TOOL_HINTS = {
  gmail: [
    'GMAIL TOOLS (connected ✓):',
    '  Check emails: node gmail-tools/check_emails.js [count] [--unread]',
    '  Read email:   node gmail-tools/read_email.js <EMAIL_ID>',
    '  Search:       node gmail-tools/search_emails.js "query"',
    '  Send:         node gmail-tools/send_email.js "to@email" "Subject" "Body"',
  ],
  googlecalendar: [
    'CALENDAR TOOLS (connected ✓):',
    '  Upcoming:     node calendar-tools/check_calendar.js [days] [--today]',
    '  Search:       node calendar-tools/search_events.js "query"',
    '  Create event: node calendar-tools/create_event.js "Title" "start_ISO" "end_ISO" [--location "place"]',
  ],
  googlesheets: [
    'SHEETS TOOLS (connected ✓):',
    '  Use Composio MCP bridge: node mcp-bridge-tools/mcp-executor.js "your sheets task"',
  ],
  googledrive: [
    'DRIVE TOOLS (connected ✓):',
    '  Use Composio MCP bridge: node mcp-bridge-tools/mcp-executor.js "your drive task"',
  ],
  googledocs: [
    'DOCS TOOLS (connected ✓):',
    '  Use Composio MCP bridge: node mcp-bridge-tools/mcp-executor.js "your docs task"',
  ],
};

// Skill-specific hints for installed marketplace skills (not integration-dependent)
const SKILL_TOOL_HINTS = {
  news: 'NEWS: Use web_search to find current news. Present 3-5 stories with headline, source, summary.',
  'web-browser': 'WEB SEARCH: Use web_search or web_fetch for internet lookups.',
  'deep-research': 'RESEARCH: Use multiple web_search queries for thorough research. Synthesize findings.',
  'mcp-bridge': 'MCP BRIDGE: node mcp-bridge-tools/mcp-executor.js "task description" (or --server "name" "task")',
};

// ── Build context-enriched message (invisible to user) ──
// Provides the agent with exact tool commands for connected integrations
function buildFullMessage(userMessage, connectedApps, mcpServers, installedSkillSlugs) {
  const sections = [];

  // Integration tool commands — the agent gets exact exec commands
  const toolHints = [];
  for (const app of connectedApps) {
    const hints = INTEGRATION_TOOL_HINTS[app];
    if (hints) {
      toolHints.push(...hints);
    }
  }

  if (toolHints.length > 0) {
    sections.push('AVAILABLE INTEGRATION TOOLS (use exec to run these):');
    sections.push(...toolHints);
  } else if (connectedApps.length > 0) {
    sections.push(`Connected integrations: ${connectedApps.join(', ')} (use Composio MCP bridge for these)`);
  }

  // Skill hints for installed marketplace skills
  const skillHints = [];
  for (const slug of (installedSkillSlugs || [])) {
    const hint = SKILL_TOOL_HINTS[slug];
    if (hint) skillHints.push(hint);
  }
  if (skillHints.length > 0) {
    sections.push('INSTALLED SKILLS:');
    sections.push(...skillHints);
  }

  // MCP servers
  if (mcpServers.length > 0) {
    sections.push(`MCP servers available: ${mcpServers.join(', ')}`);
  }

  if (sections.length === 0) {
    sections.push('No integrations or skills connected yet.');
  }

  const context = [
    '<context>',
    'Integration Chat session (web dashboard).',
    '',
    ...sections,
    '',
    'EXECUTION RULES:',
    '- Run tool commands using the exec tool (shell). Do NOT guess output — always execute.',
    '- If a tool returns a credential error, tell the user to reconnect via the Integrations page.',
    '- For multi-step tasks (e.g. check emails then read one), chain the commands sequentially.',
    '- Always acknowledge what you are about to do before running a tool.',
    '',
    'ACTION RULE: If user confirms with short phrases like "do it", "yes", "proceed", "go ahead", execute the pending action immediately using already discovered IDs/details from prior turns.',
    'MEMORY RULE: If the user shares personal details (phone, email, name, address, contacts, preferences), you MUST use the write tool to save them to the correct memory/ file (e.g. memory/contacts.md for phone/email, memory/people.md for contacts) AND update memory/INDEX.md Quick line. Do this BEFORE responding. If the user asks for personal info, read memory/INDEX.md first.',
    'Do NOT echo this context block.',
    '</context>',
    '',
    userMessage
  ].join('\n');
  return context;
}

// ── Platform-level routes ──

// GET /api/chat/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit) || 50, 100);
    const before = req.query.before;

    let query = supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      logger.error('Chat history fetch error', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch chat history' });
    }

    res.json({
      messages: (messages || []).reverse(),
      hasMore: messages && messages.length === limit
    });
  } catch (err) {
    logger.error('Chat history error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/chat/history — also resets agent session to prevent context bloat
router.delete('/history', authMiddleware, async (req, res) => {
  try {
    const employee = await findRunningEmployee(req.user.id);

    // Clear DB messages
    await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('user_id', req.user.id);

    // Reset agent session files inside the container to prevent context overflow
    if (employee) {
      resetAgentSession(req.user.id, employee);
    }

    res.json({ message: 'Chat history cleared' });
  } catch (err) {
    logger.error('Clear chat history error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/chat/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const employee = await findRunningEmployee(req.user.id);
    if (!employee) {
      return res.json({ available: false, reason: 'No running AI employee. Start one from the Dashboard.' });
    }

    const { data: connections } = await supabaseAdmin
      .from('composio_connections')
      .select('app_slug')
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    res.json({
      available: true,
      connectedApps: (connections || []).map(c => c.app_slug)
    });
  } catch (err) {
    logger.error('Chat status error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chat/message — Send a message, returns chatId for SSE streaming
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const employee = await findRunningEmployee(req.user.id);
    if (!employee) {
      return res.status(400).json({ error: 'No running AI employee. Start one from the Dashboard first.' });
    }

    // Boost this employee's RAM (shrink idle siblings) — fire-and-forget, don't block chat
    rebalanceUserRAM(req.user.id, employee.id).catch(err => {
      logger.warn('Chat RAM rebalance failed', { error: err.message });
    });

    const userMsg = message.trim();
    const chatId = crypto.randomUUID();

    // Save user message
    await supabaseAdmin.from('chat_messages').insert({
      employee_id: employee.id,
      user_id: req.user.id,
      role: 'user',
      content: userMsg
    });

    // Fetch connected integrations
    const { data: connections } = await supabaseAdmin
      .from('composio_connections')
      .select('app_slug')
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    const connectedApps = (connections || []).map(c => c.app_slug);

    // Fetch configured MCP servers and installed skill slugs for this employee
    let mcpServers = [];
    let installedSkillSlugs = [];
    try {
      const { data: empSkills } = await supabaseAdmin
        .from('employee_skills')
        .select('config, skills(slug, credential_type)')
        .eq('employee_id', employee.id)
        .eq('status', 'active');

      for (const s of (empSkills || [])) {
        // Collect MCP servers
        if (s.skills?.credential_type === 'mcp_server_url' && s.config?.servers) {
          mcpServers = Object.keys(s.config.servers);
        }
        // Collect all installed skill slugs
        if (s.skills?.slug) {
          installedSkillSlugs.push(s.skills.slug);
        }
      }
    } catch (e) {
      logger.warn('Failed to fetch skills for chat context', { error: e.message });
    }

    const fullMessage = buildFullMessage(userMsg, connectedApps, mcpServers, installedSkillSlugs);

    logger.info(`Chat message initiated`, { chatId, userId: req.user.id, employeeId: employee.id });

    // Return chatId immediately — frontend will use SSE to stream progress
    res.json({ chatId, status: 'processing' });

    // Process asynchronously via persistent WS pool + Redis event buffer
    try {
      let result = await wsPool.sendMessage(
        employee.id,
        employee.container_name,
        employee.gateway_token,
        fullMessage,
        chatId,
        (cId, event) => publishEvent(cId, event)
      );

      // Auto-retry on context overflow: reset session and try once more
      if (!result.ok && result.error && result.error.includes('context may be overloaded')) {
        logger.info('Context overflow detected, auto-resetting session', { chatId });
        publishEvent(chatId, { state: 'thinking', detail: 'Resetting conversation context...', ts: Date.now() });
        resetAgentSession(req.user.id, employee);

        // Re-fetch employee to get fresh state
        const freshEmp = await findRunningEmployee(req.user.id);
        if (freshEmp) {
          result = await wsPool.sendMessage(
            freshEmp.id,
            freshEmp.container_name,
            freshEmp.gateway_token,
            fullMessage,
            chatId,
            (cId, event) => publishEvent(cId, event)
          );
        }
      }

      if (result.ok) {
        await supabaseAdmin.from('chat_messages').insert({
          employee_id: employee.id,
          user_id: req.user.id,
          role: 'assistant',
          content: result.response
        });
      } else {
        // Emit error so SSE client gets it
        publishEvent(chatId, { state: 'error', detail: result.error, ts: Date.now() });
      }
    } catch (err) {
      logger.error('Chat gateway error', { chatId, error: err.message });
      publishEvent(chatId, { state: 'error', detail: 'Internal error: ' + err.message, ts: Date.now() });
    }
  } catch (err) {
    logger.error('Chat message error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/chat/stream/:chatId — SSE endpoint backed by Redis Streams
router.get('/stream/:chatId', authMiddleware, (req, res) => {
  const { chatId } = req.params;
  streamSSE(req, res, chatId);
});

module.exports = router;
