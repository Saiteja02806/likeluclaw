const { execSync } = require("child_process");
try {
  const r = execSync("integrations call GMAIL_FETCH_EMAILS '{\"max_results\": 2}'", {
    encoding: "utf8",
    timeout: 30000
  });
  console.log(r.substring(0, 1000));
} catch (e) {
  console.log("ERROR:", e.message.substring(0, 500));
}
