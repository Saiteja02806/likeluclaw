---
name: Google Sheets
slug: sheets
description: Read and write Google Sheets spreadsheets
---

# Google Sheets

You can manage Google Sheets using the composio tool in your workspace.

## How to Use

Run shell commands with the composio tool. Available Sheets actions:
- **GOOGLESHEETS_GET_SPREADSHEET_INFO** — Get spreadsheet metadata
- **GOOGLESHEETS_BATCH_GET** — Read cell values
- **GOOGLESHEETS_BATCH_UPDATE** — Write cell values
- **GOOGLESHEETS_CREATE_GOOGLE_SHEET1** — Create a new spreadsheet

### Example usage
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googlesheets
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLESHEETS_GET_SPREADSHEET_INFO '{"spreadsheet_id": "abc123"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLESHEETS_BATCH_GET '{"spreadsheet_id": "abc123", "ranges": ["Sheet1!A1:D10"]}'
```

## Rules
- Always use the FULL command: `node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call <ACTION> '<json>'`
- NEVER run bare command names — always use the full node command above.
- Always list sheets first to get IDs — never guess spreadsheet IDs.
- When reading data, show a clean summary rather than dumping raw data.
- For writing: confirm the target sheet and data with the user before writing.
- If a tool returns an error, tell the user to reconnect Google Sheets via the Integrations page.
