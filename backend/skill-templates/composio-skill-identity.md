<!-- skill:composio-integrations -->
# App Integrations (Gmail, Calendar, Sheets, Drive, Slack, GitHub, etc.)

For ALL connected apps, use the composio tool:

**Commands:**
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js apps
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools gmail
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googlecalendar
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools <any_app>
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GMAIL_FETCH_EMAILS '{"max_results": 5}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLECALENDAR_FIND_EVENT '{"query": "meeting"}'
```

**Process:** `composio-tool.js apps` → `composio-tool.js tools <app>` → `composio-tool.js call <TOOL> '{...}'`

**Rules:**
- Always use the FULL command: `node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js`
- NEVER run bare tool names like `gmail_fetch_emails` or `integrations` — always use the full node command
- Args must be valid JSON in single quotes
- If app not connected → tell user to connect via Integrations page
<!-- /skill:composio-integrations -->
