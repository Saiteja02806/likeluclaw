import re

IDENTITY_PATH = "/home/node/.openclaw/workspace/IDENTITY.md"

with open(IDENTITY_PATH, "r") as f:
    content = f.read()

gmail_new = """<!-- skill:gmail -->
# Gmail

You can manage email using the `integrations` command (Composio Gmail tools).

## How to Use

Use the `integrations` command to interact with Gmail. Available actions include:
- **GMAIL_FETCH_EMAILS** - Fetch recent emails
- **GMAIL_GET_EMAIL** - Read a specific email by ID
- **GMAIL_SEND_EMAIL** - Send an email
- **GMAIL_CREATE_EMAIL_DRAFT** - Create a draft
- **GMAIL_LIST_LABELS** - List all labels
- **GMAIL_REPLY_TO_THREAD** - Reply to an email thread

### Example usage
```bash
integrations call GMAIL_FETCH_EMAILS '{"max_results": 5}'
integrations call GMAIL_SEND_EMAIL '{"recipient_email": "to@example.com", "subject": "Hello", "body": "Email body"}'
```

## Rules
- Always check emails BEFORE reporting on them - never guess.
- When summarizing emails, include sender, subject, and a brief preview.
- For sending: confirm the recipient and content with the user before sending.
- If a tool returns an error, tell the user to reconnect Gmail via the Integrations page.
<!-- /skill:gmail -->"""

calendar_new = """<!-- skill:calendar -->
# Google Calendar

You can manage calendar events using the `integrations` command (Composio Calendar tools).

## How to Use

Use the `integrations` command to interact with Google Calendar. Available actions include:
- **GOOGLECALENDAR_FIND_EVENT** - Search/find events
- **GOOGLECALENDAR_CREATE_EVENT** - Create a new event
- **GOOGLECALENDAR_GET_EVENT** - Get event details by ID
- **GOOGLECALENDAR_UPDATE_EVENT** - Update an existing event
- **GOOGLECALENDAR_DELETE_EVENT** - Delete an event
- **GOOGLECALENDAR_QUICK_ADD** - Quick-add an event from text
- **GOOGLECALENDAR_LIST_CALENDARS** - List all calendars

### Example usage
```bash
integrations call GOOGLECALENDAR_FIND_EVENT '{"calendar_id": "primary", "query": "meeting"}'
integrations call GOOGLECALENDAR_CREATE_EVENT '{"calendar_id": "primary", "title": "Team Standup", "start_datetime": "2025-01-15T10:00:00", "end_datetime": "2025-01-15T10:30:00"}'
```

## Rules
- Always check the calendar BEFORE reporting on schedule - never guess.
- When creating events, confirm the details with the user first.
- Use ISO 8601 format for dates/times.
- If a tool returns an error, tell the user to reconnect Google Calendar via the Integrations page.
<!-- /skill:calendar -->"""

composio_new = """<!-- skill:composio-integrations -->
# App Integrations (Gmail, Calendar, Slack, Sheets, Drive, Notion, GitHub, etc.)

For ALL connected apps, use the `integrations` CLI:

**Commands:**
```bash
integrations apps                                    # See connected apps
integrations tools gmail                             # List Gmail tools
integrations tools googlecalendar                    # List Calendar tools
integrations tools googlesheets                      # List Sheets tools
integrations tools <any_app>                         # Works with ANY app
integrations call GMAIL_FETCH_EMAILS '{"max_results": 5}'
integrations call GOOGLECALENDAR_FIND_EVENT '{"calendar_id": "primary"}'
integrations search "send message"                   # Find tools by keyword
```

**Process:** `integrations apps` -> `integrations tools <app>` -> `integrations call <TOOL> '{...}'`

**Rules:**
- For **Gmail**: use `integrations call GMAIL_*` commands
- For **Calendar**: use `integrations call GOOGLECALENDAR_*` commands
- For **all other apps**: use `integrations` command
- Args must be valid JSON in single quotes
- If app not connected -> tell user to connect via Integrations page
<!-- /skill:composio-integrations -->"""

content = re.sub(r"<!-- skill:gmail -->.*?<!-- /skill:gmail -->", gmail_new, content, flags=re.DOTALL)
content = re.sub(r"<!-- skill:calendar -->.*?<!-- /skill:calendar -->", calendar_new, content, flags=re.DOTALL)
content = re.sub(r"<!-- skill:composio-integrations -->.*?<!-- /skill:composio-integrations -->", composio_new, content, flags=re.DOTALL)

with open(IDENTITY_PATH, "w") as f:
    f.write(content)

print("IDENTITY.md updated successfully")
