# Google Calendar

You can manage calendar events using the composio tool in your workspace.

## How to Use

Run shell commands with the composio tool. Available Calendar actions:
- **GOOGLECALENDAR_FIND_EVENT** — Search/find events
- **GOOGLECALENDAR_CREATE_EVENT** — Create a new event
- **GOOGLECALENDAR_GET_EVENT** — Get event details by ID
- **GOOGLECALENDAR_UPDATE_EVENT** — Update an existing event
- **GOOGLECALENDAR_DELETE_EVENT** — Delete an event
- **GOOGLECALENDAR_QUICK_ADD** — Quick-add an event from text
- **GOOGLECALENDAR_LIST_CALENDARS** — List all calendars

### Example usage
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLECALENDAR_FIND_EVENT '{"calendar_id": "primary", "query": "meeting"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLECALENDAR_CREATE_EVENT '{"calendar_id": "primary", "title": "Team Standup", "start_datetime": "2025-01-15T10:00:00", "end_datetime": "2025-01-15T10:30:00"}'
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call GOOGLECALENDAR_QUICK_ADD '{"calendar_id": "primary", "text": "Lunch at 12pm tomorrow"}'
```

### List all available Calendar tools
```bash
node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js tools googlecalendar
```

## Rules
- Always use the FULL command: `node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js call <ACTION> '<json>'`
- NEVER run bare command names — always use the full node command above.
- Always check the calendar BEFORE reporting on schedule — never guess.
- When creating events, confirm the details (title, time, attendees) with the user first.
- Use ISO 8601 format for dates/times (YYYY-MM-DDTHH:MM:SS).
- If a tool returns an error, tell the user to reconnect Google Calendar via the Integrations page.
