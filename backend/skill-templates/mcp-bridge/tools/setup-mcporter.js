/**
 * setup-mcporter.js
 * 
 * Installs mcporter globally (if not installed) and writes the MCP server config.
 * Called by the backend when a user configures an MCP integration.
 * 
 * Usage: node setup-mcporter.js <config-json-path>
 * The config JSON file should contain: { servers: { "name": { url, auth? } } }
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configPath = process.argv[2];

if (!configPath) {
  console.error('Usage: node setup-mcporter.js <config-json-path>');
  process.exit(1);
}

// Step 1: Check if mcporter is installed, install if not
try {
  execSync('which mcporter', { stdio: 'pipe' });
  console.log('mcporter already installed');
} catch {
  console.log('Installing mcporter...');
  try {
    execSync('npm install -g mcporter', { stdio: 'inherit', timeout: 60000 });
    console.log('mcporter installed successfully');
  } catch (err) {
    console.error('Failed to install mcporter:', err.message);
    process.exit(1);
  }
}

// Step 2: Read the config and write mcporter.json
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const mcporterDir = path.join(process.env.HOME || '/home/node', '.openclaw', 'workspace', 'mcp-bridge-tools');
  fs.mkdirSync(mcporterDir, { recursive: true });

  const mcporterConfigPath = path.join(mcporterDir, 'mcporter.json');
  fs.writeFileSync(mcporterConfigPath, JSON.stringify(config, null, 2));
  console.log('mcporter config written to', mcporterConfigPath);
} catch (err) {
  console.error('Failed to write mcporter config:', err.message);
  process.exit(1);
}
