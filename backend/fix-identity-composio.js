// Fix IDENTITY.md: remove duplicate composio-integrations sections, replace with clean version
const fs = require('fs');
const path = process.argv[2] || '/home/node/.openclaw/workspace/IDENTITY.md';

let content = fs.readFileSync(path, 'utf8');
console.log('Original length:', content.length, 'chars');

// Remove ALL existing composio-integrations skill blocks (including duplicates)
const regex = /<!-- skill:composio-integrations -->[\s\S]*?<!-- \/skill:composio-integrations -->\n?/g;
const matches = content.match(regex);
console.log('Found', matches ? matches.length : 0, 'composio-integrations blocks to remove');

content = content.replace(regex, '');

// New clean composio skill section
const newSection = `<!-- skill:composio-integrations -->
# Connected App Integrations (Gmail, Calendar, Sheets, etc.)

You have connected third-party apps via Composio. To interact with ANY connected app, you MUST use this ONE script:

**THE ONLY SCRIPT: \`node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js\`**

DO NOT create, invent, or guess any other script names. There is NO check_mail.js, NO send_email.js, NO calendar.js — ONLY composio-tool.js exists.

## Commands (copy these EXACTLY)

### Check connected apps
\`\`\`bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js apps
\`\`\`

### List tools for an app
\`\`\`bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools gmail
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googlecalendar
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googlesheets
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools slack
\`\`\`

### Call a tool (JSON args required)
\`\`\`bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GMAIL_FETCH_EMAILS '{"max_results":5}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GMAIL_SEND_EMAIL '{"to":"user@example.com","subject":"Hello","body":"Hi there"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLECALENDAR_FIND_EVENT '{"calendar_id":"primary"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLECALENDAR_CREATE_EVENT '{"calendar_id":"primary","title":"Meeting","start_datetime":"2026-02-13T10:00:00","end_datetime":"2026-02-13T11:00:00"}'
\`\`\`

### Search for a tool by keyword
\`\`\`bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js search "send email"
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js search "create event"
\`\`\`

## Step-by-Step Process (ALWAYS follow this)

1. FIRST run \`composio-tool.js apps\` to see which apps are connected
2. THEN run \`composio-tool.js tools <app>\` to see available tool names
3. THEN run \`composio-tool.js call <TOOL_NAME> '<json_args>'\` to execute
4. If you don't know the exact tool name, use \`composio-tool.js search "keyword"\`

## CRITICAL RULES

- NEVER invent script filenames. The ONLY file is composio-tool.js
- NEVER run \`node check_mail.js\` or \`node send_email.js\` or any made-up filename — these DO NOT exist
- ALWAYS use the full path: \`node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js\`
- Arguments MUST be valid JSON strings wrapped in single quotes
- If an app is not connected, tell the user to connect it from the Integrations page on the LikelyClaw dashboard
- If a tool call fails, show the error and suggest re-connecting the app
<!-- /skill:composio-integrations -->
`;

// Append the new section at the end
content = content.trimEnd() + '\n\n' + newSection;

fs.writeFileSync(path, content, 'utf8');
console.log('New length:', content.length, 'chars');
console.log('IDENTITY.md updated successfully with clean composio-integrations section');
