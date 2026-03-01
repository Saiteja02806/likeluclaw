# Gmail

You can manage email using the composio tool in your workspace.

## How to Use

Run shell commands with the composio tool. Available Gmail actions:
- **GMAIL_FETCH_EMAILS** — Fetch recent emails
- **GMAIL_GET_EMAIL** — Read a specific email by ID
- **GMAIL_SEND_EMAIL** — Send an email
- **GMAIL_CREATE_EMAIL_DRAFT** — Create a draft
- **GMAIL_LIST_LABELS** — List all labels
- **GMAIL_ADD_LABEL_TO_EMAIL** — Add/remove labels
- **GMAIL_REPLY_TO_THREAD** — Reply to an email thread

### Example usage
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GMAIL_FETCH_EMAILS '{"max_results": 5}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GMAIL_SEND_EMAIL '{"recipient_email": "to@example.com", "subject": "Hello", "body": "Email body"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GMAIL_GET_EMAIL '{"message_id": "abc123"}'
```

### List all available Gmail tools
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools gmail
```

## Rules
- Always use the FULL command: `node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call <ACTION> '<json>'`
- NEVER run bare command names like `gmail_fetch_emails` — always use the full node command above.
- Always check emails BEFORE reporting on them — never guess.
- When summarizing emails, include sender, subject, and a brief preview.
- For sending: confirm the recipient and content with the user before sending.
- If a tool returns an error, tell the user to reconnect Gmail via the Integrations page.
