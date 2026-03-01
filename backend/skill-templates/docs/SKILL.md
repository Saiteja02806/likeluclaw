---
name: Google Docs
slug: docs
description: Read and create Google Docs documents
---

# Google Docs

You can manage Google Docs using the composio tool in your workspace.

## How to Use

Run shell commands with the composio tool. Available Docs actions:
- **GOOGLEDOCS_GET_DOCUMENT** — Get a document by ID
- **GOOGLEDOCS_CREATE_DOCUMENT** — Create a new document
- **GOOGLEDOCS_BATCH_UPDATE** — Update document content

### Example usage
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googledocs
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLEDOCS_CREATE_DOCUMENT '{"title": "Meeting Notes"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLEDOCS_GET_DOCUMENT '{"document_id": "abc123"}'
```

## Rules
- Always use the FULL command: `node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call <ACTION> '<json>'`
- NEVER run bare command names — always use the full node command above.
- When reading docs, summarize the content rather than dumping everything.
- For creating: confirm the title and content with the user before creating.
- If a tool returns an error, tell the user to reconnect Google Docs via the Integrations page.
