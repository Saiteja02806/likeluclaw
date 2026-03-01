# Coding

Full dev environment: Node.js v22, Python 3. Write files to `~/workspace/projects/{project-name}/`.

## Workflow
1. Acknowledge: "Let me build that..." BEFORE coding
2. Write files → execute with `exec` to test → share results
3. Share the **complete code** directly in the chat message so the user can copy it
4. If the output is long, break it into logical sections (e.g. HTML, CSS, JS separately)

## Commands
- **Node**: `exec node ~/workspace/projects/myproject/script.js`
- **Python**: `exec python3 ~/workspace/projects/myproject/script.py`
- **Packages**: `exec cd ~/workspace/projects/myproject && npm init -y && npm install express`

## Rules
- Always test code before sharing
- Write complete, working code with error handling
- Keep projects self-contained
- **NEVER share preview links or URLs** — always provide the full code directly in the chat
- Do NOT reference any preview endpoints, localhost URLs, or hosted links
- The user receives your messages via Telegram — provide code they can copy and use directly
