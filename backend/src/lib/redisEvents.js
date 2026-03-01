/**
 * redisEvents.js — Redis Streams-backed event buffer for SSE streaming
 *
 * Replaces the in-memory Map/EventEmitter with Redis Streams.
 * Events survive PM2 restarts and support replay for late-connecting SSE clients.
 *
 * Stream key: chat:{chatId}
 * Each entry: { state, detail, ts }
 * Auto-expires after 5 minutes.
 */

const Redis = require('ioredis');
const logger = require('../config/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const STREAM_TTL_SECONDS = 300; // 5 min TTL per chat stream
const HEARTBEAT_MS = 15000;     // SSE heartbeat interval
const BLOCK_MS = 5000;          // How long to block waiting for new events

let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
    redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
    redis.on('connect', () => logger.info('Redis connected (main)'));
    redis.connect().catch((err) => logger.error('Redis connect failed', { error: err.message }));
  }
  return redis;
}

/** Create a dedicated Redis connection for blocking XREAD (one per SSE client). */
function createBlockingClient() {
  const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
  client.on('error', (err) => logger.error('Redis blocking client error', { error: err.message }));
  return client;
}

/**
 * Publish an event to a chat stream.
 * @param {string} chatId
 * @param {{state: string, detail: string, ts: number}} event
 */
async function publishEvent(chatId, event) {
  const r = getRedis();
  const streamKey = `chat:${chatId}`;
  try {
    await r.xadd(streamKey, '*', 'state', event.state, 'detail', event.detail || '', 'ts', String(event.ts || Date.now()));
    // Set TTL on first write (EXPIRE is idempotent, cheap to call each time)
    await r.expire(streamKey, STREAM_TTL_SECONDS);
  } catch (err) {
    logger.error('Redis publishEvent error', { chatId, error: err.message });
  }
}

/**
 * Replay all buffered events for a chat, then tail for new ones.
 * Writes SSE format to the response.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} chatId
 */
async function streamSSE(req, res, chatId) {
  const streamKey = `chat:${chatId}`;
  const r = getRedis();
  let closed = false;
  let lastId = '0'; // Start from beginning for replay

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ state: 'connected', detail: 'Listening...' })}\n\n`);

  // Cleanup on client disconnect
  req.on('close', () => {
    closed = true;
  });

  // Safety: close after 6 minutes max
  const safetyTimeout = setTimeout(() => {
    if (!closed) {
      closed = true;
      try {
        res.write(`data: ${JSON.stringify({ state: 'error', detail: 'Stream timeout' })}\n\n`);
        res.end();
      } catch (_) {}
    }
  }, 360000);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    if (closed) return;
    try { res.write(': heartbeat\n\n'); } catch (_) { closed = true; }
  }, HEARTBEAT_MS);

  let blockClient = null;

  try {
    // Phase 1: Replay all existing events
    const existing = await r.xrange(streamKey, '-', '+');
    let terminated = false;

    for (const [id, fields] of existing) {
      if (closed) break;
      const event = fieldsToEvent(fields);
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (_) { closed = true; break; }
      lastId = id;
      if (event.state === 'done' || event.state === 'error') {
        terminated = true;
      }
    }

    if (terminated || closed) {
      cleanup();
      if (!closed) setTimeout(() => res.end(), 500);
      return;
    }

    // Phase 2: Tail for new events using blocking XREAD
    // CRITICAL: each SSE client needs its OWN Redis connection for XREAD BLOCK
    blockClient = createBlockingClient();

    while (!closed) {
      try {
        const result = await blockClient.xread('BLOCK', BLOCK_MS, 'COUNT', 50, 'STREAMS', streamKey, lastId);

        if (!result || closed) continue;

        for (const [, entries] of result) {
          for (const [id, fields] of entries) {
            if (closed) break;
            const event = fieldsToEvent(fields);
            try {
              res.write(`data: ${JSON.stringify(event)}\n\n`);
            } catch (_) { closed = true; break; }
            lastId = id;
            if (event.state === 'done' || event.state === 'error') {
              cleanup();
              if (!closed) setTimeout(() => res.end(), 500);
              return;
            }
          }
        }
      } catch (err) {
        if (closed) break;
        logger.error('Redis XREAD error', { chatId, error: err.message });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (err) {
    logger.error('streamSSE error', { chatId, error: err.message });
  }

  cleanup();

  function cleanup() {
    clearInterval(heartbeat);
    clearTimeout(safetyTimeout);
    // Disconnect this client's dedicated blocking connection
    if (blockClient) try { blockClient.disconnect(); } catch (_) {}
  }
}

/**
 * Convert Redis XRANGE/XREAD field array to event object.
 * Fields come as [key1, val1, key2, val2, ...]
 */
function fieldsToEvent(fields) {
  const obj = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return {
    state: obj.state || 'unknown',
    detail: obj.detail || '',
    ts: Number(obj.ts) || Date.now(),
  };
}

/**
 * Health check — test Redis connection.
 */
async function healthCheck() {
  try {
    const r = getRedis();
    const pong = await r.ping();
    return pong === 'PONG';
  } catch (_) {
    return false;
  }
}

module.exports = { publishEvent, streamSSE, healthCheck };
