/**
 * wsPool.js — Persistent WebSocket Pool for OpenClaw Gateway connections
 *
 * Maintains ONE persistent WS per running employee K8s pod (via internal service DNS).
 * First message triggers handshake (connect.challenge → authenticate → sessions.list).
 * Subsequent messages reuse the authenticated WS and skip straight to chat.send.
 */

const crypto = require('crypto');
const WebSocket = require('ws');
const logger = require('../config/logger');

const KEEPALIVE_MS = 15000;
const HANDSHAKE_TIMEOUT_MS = 15000;
const CHAT_TIMEOUT_MS = 330000; // 330s — slightly longer than agent's 300s timeout to avoid race
const EARLY_TIMEOUT_MS = 60000; // 60s — integration tasks (Gmail, Calendar) need more time for tool chains
const STALE_MS = 300000; // Remove idle connections after 5 min

const STATE = {
  CONNECTING: 'connecting',
  READY: 'ready',
  BUSY: 'busy',
  CLOSING: 'closing',
};

class WSPool {
  constructor() {
    this.pools = new Map();
    this._cleanupTimer = setInterval(() => this._cleanupStale(), 60000);
  }

  /**
   * Send a chat message through a pooled connection.
   * @returns {Promise<{ok: boolean, response?: string, error?: string}>}
   */
  async sendMessage(employeeId, serviceDns, gatewayToken, fullMessage, chatId, onEvent) {
    const tag = `[pool:${employeeId.slice(0, 8)}:${chatId.slice(0, 8)}]`;
    let entry = this.pools.get(employeeId);

    // If we have a healthy READY connection, reuse it
    if (entry && entry.ws?.readyState === WebSocket.OPEN && entry.state === STATE.READY) {
      logger.info(`${tag} Reusing pooled WS (session: ${entry.sessionKey})`);
      return this._sendChat(entry, fullMessage, chatId, onEvent, tag);
    }

    // If busy, queue the message
    if (entry && entry.ws?.readyState === WebSocket.OPEN && entry.state === STATE.BUSY) {
      logger.info(`${tag} WS busy, queuing message`);
      return new Promise((resolve) => {
        entry.pendingMessages.push({ fullMessage, chatId, onEvent, resolve, tag });
      });
    }

    // Need a fresh connection
    this._destroyEntry(entry);
    onEvent(chatId, { state: 'connecting', detail: 'Connecting to agent...', ts: Date.now() });
    try {
      entry = await this._createConnection(employeeId, serviceDns, gatewayToken, tag);
    } catch (err) {
      logger.error(`${tag} Connection failed`, { error: err.message });
      onEvent(chatId, { state: 'error', detail: 'Failed to connect to agent: ' + err.message, ts: Date.now() });
      return { ok: false, error: err.message };
    }
    return this._sendChat(entry, fullMessage, chatId, onEvent, tag);
  }

  /**
   * Create a new WS, perform handshake, return when READY.
   */
  _createConnection(employeeId, serviceDns, gatewayToken, tag) {
    return new Promise((resolve, reject) => {
      const entry = {
        ws: null, state: STATE.CONNECTING, serviceDns, gatewayToken,
        sessionKey: null, pingInterval: null, pendingMessages: [],
        lastActivity: Date.now(), _currentChat: null,
      };
      this.pools.set(employeeId, entry);

      const ws = new WebSocket(`ws://${serviceDns}:18789`);
      entry.ws = ws;

      const hsTimeout = setTimeout(() => {
        logger.warn(`${tag} Handshake timeout`);
        try { ws.close(); } catch (_) {}
        reject(new Error('Handshake timed out'));
      }, HANDSHAKE_TIMEOUT_MS);

      ws.on('open', () => {
        logger.info(`${tag} WS connected, waiting for challenge`);
        entry.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, KEEPALIVE_MS);
      });

      ws.on('message', (rawData) => {
        let msg;
        try { msg = JSON.parse(rawData.toString()); } catch (_) { return; }
        entry.lastActivity = Date.now();

        // Handshake step 1: connect.challenge → authenticate
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          logger.info(`${tag} Authenticating...`);
          ws.send(JSON.stringify({
            type: 'req', id: crypto.randomUUID(), method: 'connect',
            params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: 'gateway-client', displayName: 'Integration Chat', mode: 'backend', version: '1.0.0', platform: 'linux' },
              auth: { token: gatewayToken }
            }
          }));
          return;
        }

        // Handshake step 2: hello-ok → list sessions
        if (msg.type === 'res' && msg.ok && msg.payload?.type === 'hello-ok') {
          ws.send(JSON.stringify({ type: 'req', id: crypto.randomUUID(), method: 'sessions.list', params: {} }));
          return;
        }

        // Handshake step 3: sessions → READY
        if (msg.type === 'res' && msg.ok && msg.payload?.sessions && entry.state === STATE.CONNECTING) {
          const sessions = msg.payload.sessions;
          const preferredSessionKey = `agent:${employeeId}:integration-chat`;
          const existingPreferred = sessions.find(s => s?.key === preferredSessionKey)?.key;
          entry.sessionKey = existingPreferred || preferredSessionKey;
          entry.state = STATE.READY;
          clearTimeout(hsTimeout);
          logger.info(`${tag} Pool READY (session: ${entry.sessionKey})`);
          resolve(entry);
          return;
        }

        // During active chat, delegate to chat handler
        if (entry._currentChat) {
          this._handleChatMsg(entry, msg, tag);
          return;
        }

        // Auto-approve exec requests even when idle
        if (msg.type === 'event' && (msg.event === 'exec.approval.requested' || msg.event === 'exec.approval')) {
          const approvalId = msg.payload?.id || msg.payload?.approvalId;
          if (approvalId) {
            ws.send(JSON.stringify({ type: 'req', id: crypto.randomUUID(), method: 'exec.approval.resolve', params: { id: approvalId, approved: true } }));
          }
          return;
        }
      });

      ws.on('error', (err) => {
        logger.error(`${tag} WS error`, { error: err.message });
        clearTimeout(hsTimeout);
        this._handleDisconnect(employeeId, tag);
        if (entry.state === STATE.CONNECTING) reject(new Error('Connection error: ' + err.message));
      });

      ws.on('close', (code) => {
        logger.info(`${tag} WS closed`, { code });
        clearTimeout(hsTimeout);
        this._handleDisconnect(employeeId, tag);
        if (entry.state === STATE.CONNECTING) reject(new Error('Connection closed during handshake'));
      });

      ws.on('pong', () => { entry.lastActivity = Date.now(); });
    });
  }

  /**
   * Send chat.send on an authenticated connection.
   */
  _sendChat(entry, fullMessage, chatId, onEvent, tag) {
    return new Promise((resolve) => {
      entry.state = STATE.BUSY;
      entry.lastActivity = Date.now();

      const ctx = { chatId, onEvent, resolve, chunks: [], deltas: [], finalText: null, runId: null, settled: false, timeout: null, earlyTimeout: null, lifecycleStarted: false, gotContent: false, runAcked: false };
      entry._currentChat = ctx;

      onEvent(chatId, { state: 'thinking', detail: 'Processing your request...', ts: Date.now() });

      const reqId = crypto.randomUUID();
      entry.ws.send(JSON.stringify({
        type: 'req', id: reqId, method: 'chat.send',
        params: { sessionKey: entry.sessionKey, message: fullMessage, idempotencyKey: crypto.randomUUID() }
      }));
      ctx._sendReqId = reqId;

      logger.info(`${tag} Message sent to agent`);

      // Early timeout: if agent doesn't start within 30s, likely config/API key error
      ctx.earlyTimeout = setTimeout(() => {
        if (!ctx.lifecycleStarted && !ctx.gotContent && !ctx.runAcked) {
          logger.warn(`${tag} Agent failed to start within ${EARLY_TIMEOUT_MS / 1000}s — likely config or API key error`);
          this._finishChat(entry, ctx, 'Agent failed to start. Please check your API key in Settings and try again.', tag);
        }
      }, EARLY_TIMEOUT_MS);

      ctx.timeout = setTimeout(() => {
        logger.warn(`${tag} Chat timeout after ${CHAT_TIMEOUT_MS / 1000}s`);
        this._finishChat(entry, ctx, ctx.chunks.length > 0 ? null : 'Agent timed out. Try starting a New Chat or simplifying your request.', tag);
      }, CHAT_TIMEOUT_MS);
    });
  }

  /**
   * Handle WS messages during an active chat.
   */
  _handleChatMsg(entry, msg, _closureTag) {
    const ctx = entry._currentChat;
    if (!ctx) return;
    const { chatId, onEvent } = ctx;
    // Use dynamic tag from current ctx, not stale closure tag
    const tag = `[pool:${chatId.slice(0, 8)}]`;

    // Capture runId from chat.send acknowledgement
    if (msg.type === 'res' && msg.ok && msg.payload?.runId && msg.payload?.status === 'started') {
      if (ctx._sendReqId && msg.id === ctx._sendReqId) {
        ctx.runId = msg.payload.runId;
        ctx.runAcked = true;
        // Clear early timeout — run was accepted by gateway
        if (ctx.earlyTimeout) { clearTimeout(ctx.earlyTimeout); ctx.earlyTimeout = null; }
        logger.info(`${tag} Run started: ${ctx.runId.slice(0, 8)}`);
      }
      return;
    }

    // Filter stale events from previous runs (runId mismatch)
    const msgRunId = msg.payload?.runId;
    if (ctx.runId && msgRunId && msgRunId !== ctx.runId) {
      return; // Silently drop stale event
    }

    // Chat state events
    if (msg.type === 'event' && msg.event === 'chat') {
      const p = msg.payload;
      const state = p?.state;

      if (state === 'thinking' || state === 'processing') {
        onEvent(chatId, { state: 'thinking', detail: 'Agent is thinking...', ts: Date.now() });
      } else if (state === 'tool-call' || state === 'tool_call') {
        const toolName = p?.tool?.name || p?.toolName || '';
        const toolDetail = _resolveToolDetail(toolName, p);
        onEvent(chatId, { state: 'tool-call', detail: toolDetail, ts: Date.now() });
      } else if (state === 'tool-result' || state === 'tool_result') {
        onEvent(chatId, { state: 'tool-result', detail: 'Processing results...', ts: Date.now() });
      } else if (state === 'delta' || state === 'partial' || state === 'streaming') {
        // chat:delta carries CUMULATIVE text — save for backup but don't emit
        // (agent:assistant events handle real-time streaming display with deltas)
        if (p?.message?.content) {
          const text = p.message.content.filter(c => c.type === 'text').map(c => c.text).join('');
          if (text) ctx.chunks = [text];
        }
      } else if (state === 'final') {
        if (p?.message?.content) {
          const text = p.message.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          if (text) ctx.finalText = text; // Definitive full response
        }
        setTimeout(() => this._finishChat(entry, ctx, null, tag), 300);
      } else {
        logger.warn(`${tag} Unknown chat state: ${state}`);
      }
      return;
    }

    // Exec approval during chat
    if (msg.type === 'event' && (msg.event === 'exec.approval.requested' || msg.event === 'exec.approval')) {
      const approvalId = msg.payload?.id || msg.payload?.approvalId;
      if (approvalId) {
        onEvent(chatId, { state: 'tool-call', detail: 'Approving integration action...', ts: Date.now() });
        entry.ws.send(JSON.stringify({ type: 'req', id: crypto.randomUUID(), method: 'exec.approval.resolve', params: { id: approvalId, approved: true } }));
      }
      return;
    }

    // Agent/execution events
    if (msg.type === 'event' && (msg.event === 'agent' || msg.event === 'execution')) {
      const stream = msg.payload?.stream;
      const data = msg.payload?.data;
      if (stream === 'lifecycle' && data?.phase === 'start') {
        ctx.lifecycleStarted = true;
        // Clear early timeout — agent started successfully
        if (ctx.earlyTimeout) { clearTimeout(ctx.earlyTimeout); ctx.earlyTimeout = null; }
        onEvent(chatId, { state: 'thinking', detail: 'Agent is processing...', ts: Date.now() });
      } else if (stream === 'assistant' && data?.delta) {
        ctx.deltas.push(data.delta);
        ctx.gotContent = true;
        onEvent(chatId, { state: 'streaming', detail: data.delta, ts: Date.now() });
      } else if (stream === 'tool' || stream === 'tool-call' || stream === 'exec') {
        const execDetail = this._resolveToolDetail(data?.name || data?.tool || '', { tool: { args: data?.args || data?.command || '' } });
        onEvent(chatId, { state: 'tool-call', detail: execDetail, ts: Date.now() });
      } else if (stream === 'compaction') {
        logger.info(`${tag} Compaction: ${data?.phase}`);
      } else {
        const st = msg.payload?.state || msg.payload?.status;
        if (st === 'running' || st === 'executing') {
          onEvent(chatId, { state: 'tool-call', detail: 'Running integration...', ts: Date.now() });
        }
      }
      return;
    }

    // Gateway errors — fail immediately instead of waiting for timeout
    if (msg.type === 'res' && msg.ok === false) {
      const errMsg = msg.error?.message || 'Gateway error';
      logger.error(`${tag} Gateway error: ${errMsg}`);
      // Fail fast on critical errors (API key, config, session, auth)
      if (errMsg.includes('not found') || errMsg.includes('invalid') ||
          errMsg.includes('API key') || errMsg.includes('auth') ||
          errMsg.includes('provider') || errMsg.includes('config') ||
          errMsg.includes('failed before reply')) {
        this._finishChat(entry, ctx, errMsg, tag);
      }
    }
  }

  /**
   * Finish a chat, return connection to READY, process queue.
   */
  _finishChat(entry, ctx, errorMsg, tag) {
    if (ctx.settled) return;
    ctx.settled = true;
    clearTimeout(ctx.timeout);
    if (ctx.earlyTimeout) clearTimeout(ctx.earlyTimeout);
    entry._currentChat = null;
    entry.state = STATE.READY;
    entry.lastActivity = Date.now();

    if (errorMsg) {
      logger.error(`${tag} Chat error`, { error: errorMsg });
      ctx.onEvent(ctx.chatId, { state: 'error', detail: errorMsg, ts: Date.now() });
      ctx.resolve({ ok: false, error: errorMsg });
    } else {
      const response = ctx.finalText || ctx.chunks.join('') || ctx.deltas.join('');
      if (response) {
        const source = ctx.finalText ? 'final' : (ctx.chunks.length ? 'chunks' : 'deltas');
        logger.info(`${tag} Chat OK`, { len: response.length, source });
        ctx.onEvent(ctx.chatId, { state: 'done', detail: response, ts: Date.now() });
        ctx.resolve({ ok: true, response });
      } else {
        // Agent produced zero output — likely context overflow or tool failure
        const hint = ctx.lifecycleStarted && !ctx.gotContent
          ? 'Agent context may be overloaded. Try starting a New Chat to reset the conversation.'
          : 'I wasn\'t able to process that request. Try clearing chat history and asking again.';
        logger.warn(`${tag} Empty response`, { lifecycle: ctx.lifecycleStarted, gotContent: ctx.gotContent, runId: ctx.runId });
        ctx.onEvent(ctx.chatId, { state: 'error', detail: hint, ts: Date.now() });
        ctx.resolve({ ok: false, error: hint });
      }
    }

    // Process queued messages
    if (entry.pendingMessages.length > 0) {
      const next = entry.pendingMessages.shift();
      logger.info(`${next.tag} Processing queued message`);
      this._sendChat(entry, next.fullMessage, next.chatId, next.onEvent, next.tag).then(next.resolve);
    }
  }

  /**
   * Resolve tool/exec names into user-friendly status messages.
   */
  _resolveToolDetail(toolName, payload) {
    const name = (toolName || '').toLowerCase();
    const args = payload?.tool?.args || payload?.args || '';
    const argsStr = typeof args === 'string' ? args : JSON.stringify(args);

    // Match specific integration tool scripts
    if (argsStr.includes('gmail-tools/check_emails') || argsStr.includes('check_emails.js')) return 'Checking your emails...';
    if (argsStr.includes('gmail-tools/read_email') || argsStr.includes('read_email.js')) return 'Reading email...';
    if (argsStr.includes('gmail-tools/search_emails') || argsStr.includes('search_emails.js')) return 'Searching emails...';
    if (argsStr.includes('gmail-tools/send_email') || argsStr.includes('send_email.js')) return 'Sending email...';
    if (argsStr.includes('calendar-tools/check_calendar') || argsStr.includes('check_calendar.js')) return 'Checking calendar...';
    if (argsStr.includes('calendar-tools/search_events') || argsStr.includes('search_events.js')) return 'Searching calendar events...';
    if (argsStr.includes('calendar-tools/create_event') || argsStr.includes('create_event.js')) return 'Creating calendar event...';
    if (argsStr.includes('mcp-executor') || argsStr.includes('mcp-client')) return 'Running MCP integration...';
    if (argsStr.includes('mcp-bridge')) return 'Using MCP bridge...';

    // Match by tool name
    if (name === 'exec' || name === 'shell' || name === 'run') return 'Running command...';
    if (name === 'read' || name === 'read_file') return 'Reading file...';
    if (name === 'write' || name === 'write_file') return 'Writing file...';
    if (name === 'web_search') return 'Searching the web...';
    if (name === 'web_fetch') return 'Fetching web page...';

    return `Using ${toolName || 'integration'}...`;
  }

  _handleDisconnect(employeeId, tag) {
    const entry = this.pools.get(employeeId);
    if (!entry) return;

    // If there's an active chat, fail it
    if (entry._currentChat && !entry._currentChat.settled) {
      const ctx = entry._currentChat;
      ctx.settled = true;
      clearTimeout(ctx.timeout);
      ctx.onEvent(ctx.chatId, { state: 'error', detail: 'Connection lost', ts: Date.now() });
      ctx.resolve({ ok: false, error: 'Connection lost' });
    }

    // Fail queued messages
    for (const pending of entry.pendingMessages) {
      pending.onEvent(pending.chatId, { state: 'error', detail: 'Connection lost', ts: Date.now() });
      pending.resolve({ ok: false, error: 'Connection lost' });
    }

    this._destroyEntry(entry);
    this.pools.delete(employeeId);
    logger.info(`${tag} Pool entry removed`);
  }

  _destroyEntry(entry) {
    if (!entry) return;
    if (entry.pingInterval) clearInterval(entry.pingInterval);
    if (entry.ws) try { entry.ws.close(); } catch (_) {}
  }

  _cleanupStale() {
    const now = Date.now();
    for (const [id, entry] of this.pools) {
      if (entry.state === STATE.READY && (now - entry.lastActivity) > STALE_MS) {
        logger.info(`[pool] Removing stale connection for ${id.slice(0, 8)}`);
        this._destroyEntry(entry);
        this.pools.delete(id);
      }
    }
  }

  /** Remove a specific pool entry (e.g. when container stops). */
  removePool(employeeId) {
    const entry = this.pools.get(employeeId);
    if (entry) {
      this._destroyEntry(entry);
      this.pools.delete(employeeId);
    }
  }

  /** Get pool stats for monitoring. */
  getStats() {
    const stats = { total: this.pools.size, ready: 0, busy: 0, connecting: 0 };
    for (const entry of this.pools.values()) {
      if (entry.state === STATE.READY) stats.ready++;
      else if (entry.state === STATE.BUSY) stats.busy++;
      else stats.connecting++;
    }
    return stats;
  }
}

module.exports = new WSPool();
