// Optimize IDENTITY.md: trim verbose sections, keep all functionality
const fs = require('fs');
const path = process.argv[2] || '/home/node/.openclaw/workspace/IDENTITY.md';

let content = fs.readFileSync(path, 'utf8');
console.log('BEFORE:', content.length, 'chars,', content.split('\n').length, 'lines');

// Remove ALL skill blocks — we'll rewrite them lean
const skillRegex = /\n*<!-- skill:\S+ -->[\s\S]*?<!-- \/skill:\S+ -->\n?/g;
const matches = content.match(skillRegex);
console.log('Removing', matches ? matches.length : 0, 'skill blocks');
content = content.replace(skillRegex, '').trimEnd();

// Lean skill sections
const leanSkills = `

<!-- skill:news -->
# News Skill
Look up real-time news using \`web_search\`. Acknowledge first ("Let me find..."), search with focused queries, then present 3-5 stories with headline, source, and 1-2 sentence summary. Use multiple searches for broad coverage. Extract from snippets — avoid \`web_fetch\` unless needed.
<!-- /skill:news -->

<!-- skill:mcp-bridge -->
# MCP Bridge
Connect to external MCP servers. Scripts: \`~/.openclaw/workspace/mcp-bridge-tools/\`

**Use the executor (preferred):**
\`\`\`bash
node ~/.openclaw/workspace/mcp-bridge-tools/mcp-executor.js "your task in plain English"
node ~/.openclaw/workspace/mcp-bridge-tools/mcp-executor.js --server "server name" "task"
\`\`\`

**Manual fallback (only if executor fails):**
\`\`\`bash
node ~/.openclaw/workspace/mcp-bridge-tools/mcp-client.js servers
node ~/.openclaw/workspace/mcp-bridge-tools/mcp-client.js <server> list
node ~/.openclaw/workspace/mcp-bridge-tools/mcp-client.js <server> call <tool> '{"param":"value"}'
\`\`\`
Always use executor first. Acknowledge before running. Config: \`mcp-servers.json\`
<!-- /skill:mcp-bridge -->

<!-- skill:deep-research -->
# Deep Research
When asked to research deeply, analyze thoroughly, or "think hard":
1. Acknowledge: "Starting deep research on [topic]..."
2. Plan 3-5 angles to investigate
3. Run 5+ \`web_search\` queries across different angles, sending progress updates
4. Use \`web_fetch\` on 2-3 best URLs for full content
5. Cross-validate across sources
6. Present: Key Findings, Detailed Analysis, Sources, Confidence Level

Do NOT use for quick questions or simple tasks.
<!-- /skill:deep-research -->

<!-- skill:composio-integrations -->
# App Integrations (Composio)
Interact with connected apps (Gmail, Calendar, Sheets, Slack, Stripe, etc.) using ONE script:

\`\`\`bash
CT=~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js
node $CT apps                              # List connected apps
node $CT tools <app_slug>                  # List tools for any app
node $CT call <TOOL_NAME> '{"key":"val"}'  # Execute a tool
node $CT search "keyword"                  # Find tools by keyword
\`\`\`

**Process:** Run \`apps\` → pick app → run \`tools <app>\` → run \`call <TOOL> '{...}'\`

Examples:
\`\`\`bash
node $CT call GMAIL_FETCH_EMAILS '{"max_results":5}'
node $CT call GOOGLECALENDAR_FIND_EVENT '{"calendar_id":"primary"}'
node $CT call GMAIL_SEND_EMAIL '{"to":"a@b.com","subject":"Hi","body":"Hello"}'
\`\`\`

Works with ANY connected app — gmail, googlecalendar, googlesheets, slack, stripe, notion, github, googledrive, discord, hubspot, etc. Just use \`tools <app_slug>\` to discover available actions.

**RULES:**
- The ONLY script is \`composio-tool.js\` — NEVER invent filenames like check_mail.js
- ALWAYS use full path: \`node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js\`
- Args must be valid JSON in single quotes
- If app not connected → tell user to connect via Integrations page
<!-- /skill:composio-integrations -->
`;

content = content + leanSkills;

fs.writeFileSync(path, content, 'utf8');
console.log('AFTER:', content.length, 'chars,', content.split('\n').length, 'lines');
console.log('Saved', (9487 - content.length), 'chars (~', Math.round((9487 - content.length) / 4), 'tokens)');
