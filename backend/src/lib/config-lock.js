const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');
const logger = require('../config/logger');

const LOCK_OPTIONS = {
  stale: 10000,    // Consider lock stale after 10s (crash recovery)
  retries: {
    retries: 5,
    factor: 2,
    minTimeout: 200,
    maxTimeout: 2000
  }
};

/**
 * Atomically read-modify-write a JSON config file with file locking.
 * @param {string} configPath - Absolute path to the JSON file
 * @param {function} mutatorFn - async (config) => mutatedConfig
 * @returns {Promise<object>} The mutated config
 */
async function withConfigLock(configPath, mutatorFn) {
  // Ensure file exists before locking
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file does not exist: ${configPath}`);
  }

  let release;
  try {
    release = await lockfile.lock(configPath, LOCK_OPTIONS);

    // Read current config
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (parseErr) {
      logger.error('Corrupt JSON config, using empty object', { configPath, error: parseErr.message });
      config = {};
    }

    // Apply mutation
    const result = await mutatorFn(config);
    const updated = result !== undefined ? result : config;

    // Atomic write: write to .tmp then rename
    const tmpPath = configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2));
    fs.renameSync(tmpPath, configPath);

    return updated;
  } finally {
    if (release) {
      await release().catch((err) => {
        logger.warn('Failed to release config lock', { configPath, error: err.message });
      });
    }
  }
}

/**
 * Read a JSON config file (no locking — use for read-only access).
 */
function readConfig(configPath) {
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Merge a key into auth-profiles.json without destroying runtime fields.
 * @param {string} authPath - Path to auth-profiles.json
 * @param {string} profileKey - e.g. "openai:default"
 * @param {object} profileValue - e.g. { type: 'api_key', provider: 'openai', key: '...' }
 */
function mergeAuthProfile(authPath, profileKey, profileValue) {
  let authProfiles = { version: 1, profiles: {} };
  if (fs.existsSync(authPath)) {
    try {
      authProfiles = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    } catch {
      // Corrupt file — start fresh but preserve version
    }
  }
  authProfiles.profiles = authProfiles.profiles || {};
  authProfiles.profiles[profileKey] = profileValue;

  const tmpPath = authPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(authProfiles, null, 2));
  fs.renameSync(tmpPath, authPath);
}

/**
 * Write auth-profiles.json to BOTH the employee agent dir AND the main agent dir.
 */
function writeAuthProfilesToAllAgents(configDir, employeeId, profileKey, profileValue) {
  for (const agentId of [employeeId, 'main']) {
    const agentDir = path.join(configDir, 'agents', agentId, 'agent');
    fs.mkdirSync(agentDir, { recursive: true });
    const authPath = path.join(agentDir, 'auth-profiles.json');
    mergeAuthProfile(authPath, profileKey, profileValue);
  }
}

/**
 * Atomically write a text file with file locking.
 * Creates the file if it doesn't exist.
 * @param {string} filePath - Absolute path to the text file
 * @param {string} content - Content to write
 */
async function withTextFileLock(filePath, content) {
  // Ensure file exists before locking (proper-lockfile requires it)
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '');
  }

  let release;
  try {
    release = await lockfile.lock(filePath, LOCK_OPTIONS);
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  } finally {
    if (release) {
      await release().catch((err) => {
        logger.warn('Failed to release text file lock', { filePath, error: err.message });
      });
    }
  }
}

module.exports = { withConfigLock, withTextFileLock, readConfig, mergeAuthProfile, writeAuthProfilesToAllAgents };
