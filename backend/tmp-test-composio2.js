const { execSync } = require("child_process");

// Get the composio-tool.js path and check the actual error response
console.log("=== Verbose Gmail Fetch ===");
try {
  const r = execSync("node /home/node/.openclaw/workspace/composio-tool.js call GMAIL_FETCH_EMAILS '{}'", { 
    encoding: "utf8", 
    timeout: 30000,
    env: { ...process.env, NODE_DEBUG: "http" }
  });
  console.log(r);
} catch (e) {
  console.log("STDOUT:", (e.stdout || "").substring(0, 1000));
  console.log("STDERR:", (e.stderr || "").substring(0, 1000));
  console.log("STATUS:", e.status);
}
