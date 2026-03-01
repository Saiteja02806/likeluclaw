const { exec } = require('node:child_process');
const util = require('node:util');
const logger = require('../config/logger');

const execPromise = util.promisify(exec);

const HEALTH_POLL_INTERVAL = 5000; // 5 seconds
const DEFAULT_TIMEOUT = 60000;     // 60 seconds

/**
 * Restart a container and poll until it reports healthy (or times out).
 * @param {string} containerName
 * @param {number} timeoutMs
 * @returns {Promise<{healthy: boolean, status: string}>}
 */
async function restartAndWaitHealthy(containerName, timeoutMs = DEFAULT_TIMEOUT) {
  try {
    await execPromise(`docker restart ${containerName}`);
  } catch (err) {
    logger.error('Docker restart failed', { containerName, error: err.message });
    return { healthy: false, status: 'restart_failed' };
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(HEALTH_POLL_INTERVAL);
    try {
      const { stdout } = await execPromise(
        `docker inspect --format='{{.State.Health.Status}}' ${containerName}`
      );
      const status = stdout.trim().replaceAll("'", '');
      if (status === 'healthy') {
        logger.info('Container healthy after restart', { containerName });
        return { healthy: true, status: 'healthy' };
      }
      if (status === 'unhealthy') {
        logger.warn('Container unhealthy after restart', { containerName });
        return { healthy: false, status: 'unhealthy' };
      }
      // 'starting' — keep polling
    } catch {
      // Container might not have health check defined — check if running
      try {
        const { stdout } = await execPromise(
          `docker inspect --format='{{.State.Status}}' ${containerName}`
        );
        if (stdout.trim().replaceAll("'", '') === 'running') {
          logger.info('Container running (no healthcheck defined)', { containerName });
          return { healthy: true, status: 'running' };
        }
      } catch {
        // Container doesn't exist or inspect failed
      }
    }
  }

  logger.warn('Container health check timed out', { containerName, timeoutMs });
  return { healthy: false, status: 'timeout' };
}

/**
 * Fix file ownership for the node user inside OpenClaw containers.
 */
async function fixOwnership(configDir) {
  try {
    await execPromise(`chown -R 1000:1000 ${configDir}`);
  } catch (err) {
    logger.warn('Failed to fix ownership', { configDir, error: err.message });
  }
}

// --- Restart Debounce ---
const pendingRestarts = new Map(); // containerName → { timeoutId, resolve, reject }

/**
 * Debounced container restart. If called again within delayMs for the same container,
 * the previous restart is cancelled and rescheduled.
 * Returns a promise that resolves when the restart actually happens.
 */
function debouncedRestart(containerName, delayMs = 3000) {
  // Cancel any pending restart for this container
  if (pendingRestarts.has(containerName)) {
    const pending = pendingRestarts.get(containerName);
    clearTimeout(pending.timeoutId);
    // Resolve the old promise so callers aren't left hanging
    pending.resolve({ healthy: false, status: 'debounced' });
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(async () => {
      pendingRestarts.delete(containerName);
      const result = await restartAndWaitHealthy(containerName);
      resolve(result);
    }, delayMs);

    pendingRestarts.set(containerName, { timeoutId, resolve, reject: () => {} });
  });
}

/**
 * Fire-and-forget debounced restart. Logs result but doesn't block the caller.
 */
function scheduleDebouncedRestart(containerName, delayMs = 3000) {
  debouncedRestart(containerName, delayMs)
    .then((result) => {
      if (result.status !== 'debounced') {
        logger.info('Debounced restart completed', { containerName, ...result });
      }
    })
    .catch((err) => {
      logger.error('Debounced restart error', { containerName, error: err.message });
    });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stop a Docker container by name (without removing it or its data).
 * Used when subscription is cancelled — preserves data for potential re-subscription.
 * @param {string} containerName
 * @returns {Promise<{stopped: boolean, error?: string}>}
 */
async function stopContainer(containerName) {
  try {
    await execPromise(`docker stop ${containerName}`);
    logger.info('Container stopped', { containerName });
    return { stopped: true };
  } catch (err) {
    // Container might already be stopped or not exist
    if (err.message.includes('No such container') || err.message.includes('is not running')) {
      logger.info('Container already stopped or not found', { containerName });
      return { stopped: true };
    }
    logger.error('Failed to stop container', { containerName, error: err.message });
    return { stopped: false, error: err.message };
  }
}

module.exports = {
  restartAndWaitHealthy,
  fixOwnership,
  debouncedRestart,
  scheduleDebouncedRestart,
  stopContainer
};
