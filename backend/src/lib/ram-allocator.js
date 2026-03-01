/**
 * ram-allocator.js — Dynamic per-user RAM allocation for Docker containers
 *
 * Each user gets a RAM budget. When a user has multiple employees:
 * - The ACTIVE employee (receiving messages) gets more RAM
 * - IDLE employees get reduced RAM (just enough to stay alive)
 * - When only 1 employee exists, it gets the full user budget
 *
 * Uses `docker update --memory` to change limits LIVE (zero downtime).
 */

const Docker = require('dockerode');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const logger = require('../config/logger');
const { supabaseAdmin } = require('../config/supabase');

const execPromise = util.promisify(exec);
const PLATFORM_DIR = process.env.OPENCLAW_PLATFORM_DIR || '/opt/claw-platform';
const NODE_HEAP_CAP = parseInt(process.env.CONTAINER_NODE_HEAP || '1536');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// RAM allocation constants (in bytes)
const MB = 1024 * 1024;

// Auto-detect server RAM or use env override
const DETECTED_RAM_MB = Math.floor(os.totalmem() / MB);
const SERVER_TOTAL_RAM = parseInt(process.env.SERVER_TOTAL_RAM_MB || String(DETECTED_RAM_MB)) * MB;
const SYSTEM_RESERVED_RAM = parseInt(process.env.SYSTEM_RESERVED_RAM_MB || '1200') * MB; // OS + backend + PM2 + Docker + nginx + Redis + headroom
const MAX_USERS = parseInt(process.env.MAX_USERS || '3');

// Per-user budget = (Total - System) / MaxUsers
const PER_USER_RAM_BUDGET = Math.floor((SERVER_TOTAL_RAM - SYSTEM_RESERVED_RAM) / MAX_USERS);

// Minimum RAM for an idle container (must survive without OOM)
const MIN_CONTAINER_RAM = parseInt(process.env.MIN_CONTAINER_RAM_MB || '350') * MB;  // Idle ~280MB + headroom

// Swap overhead per container (memswap = mem + this value)
// Must be large enough to cover startup spikes (~600-800MB) when mem_limit is low
const SWAP_OVERHEAD = 500 * MB;

// Debounce: don't rebalance more than once per 10 seconds per user
const REBALANCE_COOLDOWN_MS = 10000;
const _lastRebalance = new Map(); // userId -> timestamp

/**
 * Rebalance RAM for all employees of a specific user.
 * @param {string} userId - The user whose employees to rebalance
 * @param {string} [activeEmployeeId] - The employee that just received activity (gets priority)
 */
async function rebalanceUserRAM(userId, activeEmployeeId = null) {
  // Debounce
  const now = Date.now();
  const lastTime = _lastRebalance.get(userId) || 0;
  if (now - lastTime < REBALANCE_COOLDOWN_MS) {
    return; // Skip, too soon
  }
  _lastRebalance.set(userId, now);

  try {
    // Get all running employees for this user
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, container_id, status, user_id')
      .eq('user_id', userId)
      .eq('status', 'running');

    if (!employees || employees.length === 0) return;

    const runningCount = employees.length;
    const budget = PER_USER_RAM_BUDGET;

    // Calculate allocation
    let allocations;

    if (runningCount === 1) {
      // Single employee: gets the full budget
      allocations = [{ employee: employees[0], mem: budget }];
    } else if (activeEmployeeId) {
      // Multiple employees with an active one: active gets priority
      const activeShare = Math.floor(budget * 0.65); // 65% to active
      const idleShare = Math.floor((budget - activeShare) / (runningCount - 1)); // Split rest equally
      const safeIdleShare = Math.max(idleShare, MIN_CONTAINER_RAM);
      // Recalculate active share after ensuring idle minimums
      const actualIdleTotal = safeIdleShare * (runningCount - 1);
      const actualActiveShare = Math.max(budget - actualIdleTotal, MIN_CONTAINER_RAM);

      allocations = employees.map(emp => ({
        employee: emp,
        mem: emp.id === activeEmployeeId ? actualActiveShare : safeIdleShare
      }));
    } else {
      // Multiple employees, no specific active one: split equally
      const equalShare = Math.floor(budget / runningCount);
      const safeShare = Math.max(equalShare, MIN_CONTAINER_RAM);
      allocations = employees.map(emp => ({ employee: emp, mem: safeShare }));
    }

    // Apply allocations via docker update (zero downtime)
    for (const { employee, mem } of allocations) {
      if (!employee.container_id) continue;

      try {
        const container = docker.getContainer(employee.container_id);
        const memSwap = mem + SWAP_OVERHEAD;
        const memMB = Math.round(mem / MB);
        const newHeap = Math.min(Math.max(Math.floor(memMB * 0.70), 256), NODE_HEAP_CAP);

        // Check if the container's current nodeHeap exceeds the new safe value
        // If so, we must update docker-compose.yml and restart (env vars can't change live)
        let needsRestart = false;
        try {
          const info = await container.inspect();
          const envs = info.Config?.Env || [];
          const heapEnv = envs.find(e => e.startsWith('NODE_OPTIONS='));
          const currentHeap = heapEnv ? parseInt(heapEnv.match(/--max-old-space-size=(\d+)/)?.[1] || '0') : 0;
          if (currentHeap > 0 && currentHeap > newHeap + 50) {
            // Current heap is significantly larger than what's safe for the new mem_limit
            needsRestart = true;
            logger.warn('nodeHeap exceeds new mem_limit — container needs restart', {
              employeeId: employee.id.slice(0, 8),
              currentHeap,
              newHeap,
              newMemMB: memMB
            });
          }
        } catch (_inspectErr) {
          // If inspect fails, just do the live update
        }

        if (needsRestart) {
          // Update docker-compose.yml with new mem_limit and nodeHeap, then restart
          const userDir = _findUserDir(employee.user_id, employee.id);
          if (userDir) {
            await _updateComposeAndRestart(userDir, memMB, Math.round(memSwap / MB), newHeap, employee.id);
          }
        } else {
          // Live update (no restart needed)
          await container.update({
            Memory: mem,
            MemorySwap: memSwap
          });
        }

        const isActive = employee.id === activeEmployeeId;
        logger.info('RAM rebalanced', {
          userId: userId.slice(0, 8),
          employeeId: employee.id.slice(0, 8),
          memMB,
          nodeHeap: newHeap,
          role: isActive ? 'active' : 'idle',
          totalEmployees: runningCount,
          restarted: needsRestart
        });
      } catch (dockerErr) {
        // Container might not exist or be in a transitional state
        logger.warn('RAM rebalance failed for container', {
          employeeId: employee.id.slice(0, 8),
          error: dockerErr.message
        });
      }
    }
  } catch (err) {
    logger.error('RAM rebalance error', { userId: userId.slice(0, 8), error: err.message });
  }
}

/**
 * Get the initial memory limit for a new container based on how many
 * the user already has running.
 * @returns {{ mem: number, memSwap: number }} in bytes
 */
async function getInitialContainerRAM(userId) {
  try {
    const { count } = await supabaseAdmin
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'running');

    const existingCount = count || 0;
    const totalAfter = existingCount + 1;
    const perContainer = Math.floor(PER_USER_RAM_BUDGET / totalAfter);
    const safeMem = Math.max(perContainer, MIN_CONTAINER_RAM);

    return {
      mem: safeMem,
      memSwap: safeMem + SWAP_OVERHEAD
    };
  } catch (err) {
    // Fallback to equal split for 2 containers
    const fallback = Math.floor(PER_USER_RAM_BUDGET / 2);
    return { mem: fallback, memSwap: fallback + SWAP_OVERHEAD };
  }
}

/**
 * Convert bytes to docker-compose friendly string (e.g., "850m", "1200m")
 */
function bytesToDockerMem(bytes) {
  return Math.round(bytes / MB) + 'm';
}

/**
 * Get current allocation stats for monitoring/debugging
 */
function getConfig() {
  return {
    serverTotalRAM_MB: Math.round(SERVER_TOTAL_RAM / MB),
    systemReserved_MB: Math.round(SYSTEM_RESERVED_RAM / MB),
    perUserBudget_MB: Math.round(PER_USER_RAM_BUDGET / MB),
    minContainerRAM_MB: Math.round(MIN_CONTAINER_RAM / MB),
    maxUsers: MAX_USERS
  };
}

/**
 * Find the user directory for a given employee (userId + employeeId prefix).
 */
function _findUserDir(userId, employeeId) {
  const dirName = `${userId.slice(0, 8)}-${employeeId.slice(0, 8)}`;
  const userDir = path.join(PLATFORM_DIR, 'users', dirName);
  if (fs.existsSync(path.join(userDir, 'docker-compose.yml'))) {
    return userDir;
  }
  return null;
}

/**
 * Update docker-compose.yml with new mem_limit, memswap_limit, and nodeHeap,
 * then restart the container. Used when nodeHeap needs to decrease (can't change env live).
 */
async function _updateComposeAndRestart(userDir, memMB, memswapMB, newHeap, employeeId) {
  const composePath = path.join(userDir, 'docker-compose.yml');
  try {
    let content = fs.readFileSync(composePath, 'utf8');
    // Update NODE_OPTIONS heap
    content = content.replace(/--max-old-space-size=\d+/, `--max-old-space-size=${newHeap}`);
    // Update mem_limit
    content = content.replace(/mem_limit:\s*\d+m/, `mem_limit: ${memMB}m`);
    // Update memswap_limit
    content = content.replace(/memswap_limit:\s*\d+m/, `memswap_limit: ${memswapMB}m`);
    fs.writeFileSync(composePath, content);

    // Restart container with new config
    await execPromise('docker compose up -d', { cwd: userDir });
    logger.info('Container restarted with updated nodeHeap', {
      employeeId: employeeId.slice(0, 8),
      newHeap,
      memMB,
      memswapMB
    });
  } catch (err) {
    logger.error('Failed to update compose and restart', {
      employeeId: employeeId.slice(0, 8),
      error: err.message
    });
  }
}

module.exports = {
  rebalanceUserRAM,
  getInitialContainerRAM,
  bytesToDockerMem,
  getConfig,
  PER_USER_RAM_BUDGET,
  MIN_CONTAINER_RAM,
  SWAP_OVERHEAD
};
