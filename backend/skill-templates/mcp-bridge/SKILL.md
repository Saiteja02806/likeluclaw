# MCP Bridge

Connect to external MCP servers (Make.com, VAPI, Notion, etc.).

## Commands
- **Executor (preferred)**: `node ~/.openclaw/workspace/mcp-bridge-tools/mcp-executor.js "task in plain English"`
- **Target server**: `node ~/.openclaw/workspace/mcp-bridge-tools/mcp-executor.js --server "server-name" "task"`
- **Fallback — list servers**: `node ~/.openclaw/workspace/mcp-bridge-tools/mcp-client.js servers`
- **Fallback — list tools**: `node ~/.openclaw/workspace/mcp-bridge-tools/mcp-client.js <server> list`
- **Fallback — call tool**: `node ~/.openclaw/workspace/mcp-bridge-tools/mcp-client.js <server> call <tool> '{"param":"value"}'`

## Rules
- Always use mcp-executor.js first — it auto-discovers tools and retries
- Acknowledge what you're doing before running commands
- If 0 tools found: user needs to configure their platform (e.g., Make.com scenarios)
