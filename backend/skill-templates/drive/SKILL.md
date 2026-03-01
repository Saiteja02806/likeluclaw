---
name: Google Drive
slug: drive
description: Browse and search Google Drive files
---

# Google Drive

You can manage Google Drive using the composio tool in your workspace.

## How to Use

Run shell commands with the composio tool. Available Drive actions:
- **GOOGLEDRIVE_LIST_FILES** — List files in Drive
- **GOOGLEDRIVE_FIND_FILE** — Search for files
- **GOOGLEDRIVE_GET_FILE_CONTENT** — Read file content
- **GOOGLEDRIVE_CREATE_FILE** — Create a new file
- **GOOGLEDRIVE_UPLOAD_FILE** — Upload a file

### Example usage
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googledrive
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLEDRIVE_FIND_FILE '{"query": "budget"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLEDRIVE_LIST_FILES '{"page_size": 10}'
```

## Rules
- Always use the FULL command: `node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call <ACTION> '<json>'`
- NEVER run bare command names — always use the full node command above.
- Always search or list first to find file IDs — never guess.
- Present results as a clean summary with name, type, and link.
- If a tool returns an error, tell the user to reconnect Google Drive via the Integrations page.
