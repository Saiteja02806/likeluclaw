// Update IDENTITY.md: replace composio section with short-path wrapper commands
const fs = require('fs');
const path = process.argv[2] || '/home/node/.openclaw/workspace/IDENTITY.md';

let content = fs.readFileSync(path, 'utf8');
console.log('BEFORE:', content.length, 'chars');

// Remove existing composio section
const regex = /\n*<!-- skill:composio-integrations -->[\s\S]*?<!-- \/skill:composio-integrations -->\n?/g;
content = content.replace(regex, '').trimEnd();

// New lean section using short wrapper path
const newSection = `

<!-- skill:composio-integrations -->
# App Integrations

Run connected apps (Gmail, Calendar, Sheets, Stripe, Slack, etc.) using the \`integrations\` command.

**Commands:**
\`\`\`bash
integrations apps                                    # See connected apps
integrations tools gmail                             # List Gmail tools
integrations tools googlecalendar                    # List Calendar tools
integrations tools <any_app>                         # Works with ANY app
integrations call GMAIL_FETCH_EMAILS '{"max_results":5}'
integrations call GMAIL_SEND_EMAIL '{"to":"a@b.com","subject":"Hi","body":"Hello"}'
integrations call GOOGLECALENDAR_FIND_EVENT '{"calendar_id":"primary"}'
integrations search "send email"                     # Find tools by keyword
\`\`\`

**Process:** \`integrations apps\` → \`integrations tools <app>\` → \`integrations call <TOOL> '{...}'\`

**Rules:**
- ONLY use the \`integrations\` command — no other scripts exist for this
- Works with any connected app (gmail, googlecalendar, stripe, slack, notion, etc.)
- Args must be valid JSON in single quotes
- If app not connected → tell user to connect via Integrations page
<!-- /skill:composio-integrations -->
`;

content = content + newSection;
fs.writeFileSync(path, content, 'utf8');
console.log('AFTER:', content.length, 'chars');
