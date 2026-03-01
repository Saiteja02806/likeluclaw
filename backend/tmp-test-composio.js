const { execSync } = require("child_process");

// Test 1: List connected apps
console.log("=== Connected Apps ===");
try {
  const apps = execSync("integrations apps", { encoding: "utf8", timeout: 15000 });
  console.log(apps);
} catch (e) {
  console.log("ERROR:", e.stderr || e.message);
}

// Test 2: List Gmail tools
console.log("\n=== Gmail Tools (first 5) ===");
try {
  const tools = execSync("integrations tools gmail", { encoding: "utf8", timeout: 15000 });
  console.log(tools.substring(0, 500));
} catch (e) {
  console.log("ERROR:", e.stderr || e.message);
}

// Test 3: Try fetching emails with different params
console.log("\n=== Gmail Fetch (no params) ===");
try {
  const r = execSync("integrations call GMAIL_FETCH_EMAILS '{}'", { encoding: "utf8", timeout: 30000 });
  console.log(r.substring(0, 800));
} catch (e) {
  console.log("ERROR:", (e.stderr || e.stdout || e.message).substring(0, 500));
}

// Test 4: Try listing labels (simpler call)
console.log("\n=== Gmail List Labels ===");
try {
  const r = execSync("integrations call GMAIL_LIST_LABELS '{}'", { encoding: "utf8", timeout: 30000 });
  console.log(r.substring(0, 800));
} catch (e) {
  console.log("ERROR:", (e.stderr || e.stdout || e.message).substring(0, 500));
}

// Test 5: Calendar - find events
console.log("\n=== Calendar Find Event ===");
try {
  const r = execSync('integrations call GOOGLECALENDAR_FIND_EVENT \'{"calendar_id": "primary"}\'', { encoding: "utf8", timeout: 30000 });
  console.log(r.substring(0, 800));
} catch (e) {
  console.log("ERROR:", (e.stderr || e.stdout || e.message).substring(0, 500));
}
