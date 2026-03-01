#!/usr/bin/env node
/**
 * LLM Proxy — Token Optimization Layer
 *
 * Sits between OpenClaw containers and LLM APIs (OpenAI, Anthropic, Google).
 * Two key optimizations:
 *   1. Dynamic skill routing — only includes relevant skill sections in system prompt
 *   2. Sliding window — trims conversation history to last N messages
 *
 * How it works:
 *   OpenClaw container → this proxy (port 3100) → real LLM API
 *   URL format: http://host.docker.internal:3100/{maxHistory}/{provider}/v1
 *   Example:    http://host.docker.internal:3100/50/openai/v1  (long context)
 *   Legacy:     http://host.docker.internal:3100/openai/v1     (uses default)
 *
 * Usage:
 *   node services/llm-proxy.js
 *   pm2 start services/llm-proxy.js --name llm-proxy
 *
 * Environment:
 *   LLM_PROXY_PORT=3100           (listening port)
 *   LLM_PROXY_MAX_HISTORY=10      (max non-system messages to keep)
 */
'use strict';

const express = require('express');
const { Readable } = require('node:stream');

const app = express();
const PORT = Number.parseInt(process.env.LLM_PROXY_PORT || '3100');
const MAX_HISTORY = Number.parseInt(process.env.LLM_PROXY_MAX_HISTORY || '10');

// ── Real API base URLs ──
const PROVIDER_URLS = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com'
};

// ── Intent Classification (keyword-based, zero-cost, <5ms) ──
// DESIGN: Broad keywords maximize recall. False positives (extra skill loaded) are
// cheap — they add ~200 tokens. False negatives (missing a skill) break the agent.
// When NO keyword matches, ALL skills are loaded as safe fallback.
const SKILL_KEYWORDS = {
  'friend':        ['friend', 'buddy', 'how are you', 'feeling', 'lonely', 'chat with me',
                    'talk to me', 'hang out', 'bored', 'what\'s up', 'yo', 'hey there',
                    'tell me about', 'need someone', 'listen to me', 'vent', 'advice',
                    'cheer me up', 'motivate', 'miss you', 'good morning', 'good night'],
  'ai-lover':      ['love', 'babe', 'baby', 'honey', 'darling', 'sweetheart', 'kiss',
                    'miss you', 'romantic', 'date', 'heart', 'cuddle', 'hug', 'partner',
                    'boyfriend', 'girlfriend', 'relationship', 'flirt', 'sweet',
                    'good morning babe', 'good night love', 'i love you'],
  'news':          ['news', 'headline', 'headlines', 'breaking', 'current events', 'latest news',
                    'what happened', 'any updates', 'in the news', 'article', 'journalist',
                    'politics', 'economy', 'election', 'world news', 'bbc', 'cnn'],
  'weather':       ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy', 'humid',
                    'storm', 'hot today', 'cold today', 'climate', 'degrees', 'wind', 'snow',
                    'umbrella', 'outside today', 'heatwave', 'fog', 'drizzle'],
  'coding':        ['code', 'python', 'javascript', 'typescript', 'nodejs', 'react', 'html',
                    'css', 'bug', 'debug', 'build', 'deploy', 'website', 'webapp', 'script',
                    'function', 'npm', 'program', 'developer', 'database', 'sql', 'server',
                    'api', 'error', 'fix this', 'github', 'git', 'repo', 'terminal',
                    'command line', 'install', 'package', 'docker', 'linux', 'compile',
                    'syntax', 'variable', 'class', 'component', 'backend', 'frontend',
                    'framework', 'library', 'algorithm', 'regex', 'json', 'yaml', 'config'],
  'spotify':       ['spotify', 'music', 'song', 'playlist', 'artist', 'album', 'track',
                    'listen', 'play music', 'shuffle', 'queue', 'podcast', 'audio',
                    'beats', 'tune', 'radio', 'playing right now', 'next song', 'pause',
                    'resume', 'skip', 'volume', 'genre', 'rock', 'pop', 'hip hop', 'jazz'],
  'twitter':       ['twitter', 'tweet', 'x.com', 'trending', 'timeline', 'retweet', 'hashtag',
                    'post on x', 'followers', 'viral', 'thread', 'quote tweet', 'dm on twitter'],
  'web-browser':   ['search the web', 'look up', 'find online', 'google', 'browse', 'visit',
                    'open url', 'check this link', 'search for', 'find me', 'can you find',
                    'search online', 'wikipedia', 'look it up', 'web search', 'http',
                    'www.', '.com', '.org', '.net', 'website'],
  'deep-research': ['research', 'deep dive', 'analyze', 'investigate', 'thorough', 'study',
                    'compare', 'pros and cons', 'recommend', 'which is better', 'best option',
                    'summarize', 'comprehensive', 'detailed analysis', 'find the best',
                    'review', 'guide', 'benchmark', 'evaluate'],
  'sales-crm':     ['sales', 'crm', 'deal', 'lead', 'pipeline', 'prospect', 'follow up',
                    'customer', 'client', 'revenue', 'conversion', 'quota', 'close the deal',
                    'outreach', 'proposal', 'invoice'],
  'mcp-bridge':    ['mcp', 'make.com', 'automation', 'vapi', 'notion', 'zapier', 'integration',
                    'trigger scenario', 'composio', 'workflow', 'automate', 'webhook',
                    'n8n', 'airtable', 'slack', 'discord'],
  'gmail':         ['email', 'gmail', 'inbox', 'mail', 'send email', 'compose', 'unread',
                    'check mail', 'reply to', 'forward', 'draft', 'attachment', 'cc', 'bcc',
                    'new mail', 'any emails', 'send a message to'],
  'calendar':      ['calendar', 'schedule', 'meeting', 'appointment', 'event', 'remind',
                    'busy today', 'free slot', 'book a', 'am i free', 'my schedule',
                    'reschedule', 'cancel meeting', 'set a reminder', 'what time',
                    'agenda', 'availability'],
  'general-chat':  []  // always included as fallback
};

// Skills that are always included (tiny, no real cost)
const ALWAYS_INCLUDE = new Set(['general-chat']);

// Skill dependencies: when a skill is matched, also include these companion skills
const SKILL_DEPENDENCIES = {
  'gmail': ['mcp-bridge'],
  'calendar': ['mcp-bridge'],
};

/**
 * Classify user message → list of relevant skill slugs.
 * Returns null if intent is unclear (= include all skills as safe fallback).
 */
function classifyIntent(message) {
  if (!message) return null;
  const lower = message.toLowerCase();
  const matched = new Set(ALWAYS_INCLUDE);

  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (keywords.length === 0) continue;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matched.add(skill);
        break;
      }
    }
  }

  // If only default matched, can't determine intent → include all
  if (matched.size <= ALWAYS_INCLUDE.size) {
    return null;
  }

  // Inject dependency skills (e.g., gmail needs mcp-bridge for Composio tools)
  for (const skill of [...matched]) {
    const deps = SKILL_DEPENDENCIES[skill];
    if (deps) {
      for (const dep of deps) matched.add(dep);
    }
  }

  return [...matched];
}

// ── System Prompt Optimization ──

/**
 * Parse system prompt into base content + skill sections.
 * Skill sections are marked with <!-- skill:slug --> ... <!-- /skill:slug -->
 */
function parseSystemPrompt(content) {
  const skillRegex = /<!-- skill:(\S+) -->([\s\S]*?)<!-- \/skill:\1 -->/g;
  const skills = {};
  let match;
  while ((match = skillRegex.exec(content)) !== null) {
    skills[match[1]] = match[0];
  }

  const firstIdx = content.indexOf('<!-- skill:');
  const base = firstIdx >= 0 ? content.substring(0, firstIdx).trimEnd() : content;

  return { base, skills };
}

/**
 * Rebuild system prompt with only the relevant skill sections.
 */
function optimizeSystemPrompt(content, relevantSkills) {
  if (!relevantSkills) return content;           // null = include all
  if (!content.includes('<!-- skill:')) return content; // no markers

  const { base, skills } = parseSystemPrompt(content);
  if (Object.keys(skills).length === 0) return content;

  let optimized = base;
  for (const slug of relevantSkills) {
    if (skills[slug]) {
      optimized += '\n\n' + skills[slug];
    }
  }

  return optimized;
}

// ── Conversation History Sliding Window ──

/**
 * Trim messages to: system prompt + last N non-system messages.
 * Preserves tool call/result sequences in recent context.
 */
function trimHistory(messages, maxMessages) {
  if (!messages || messages.length === 0) return messages;

  const hasSystem = messages[0]?.role === 'system';
  const systemMsgs = hasSystem ? [messages[0]] : [];
  const rest = hasSystem ? messages.slice(1) : messages;

  if (rest.length <= maxMessages) return messages;

  return [...systemMsgs, ...rest.slice(-maxMessages)];
}

// ── Utility ──

function getLastUserMessage(messages) {
  if (!messages) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const c = messages[i].content;
      return typeof c === 'string' ? c : JSON.stringify(c);
    }
  }
  return '';
}

// ── Express Setup ──

app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'llm-proxy', maxHistory: MAX_HISTORY });
});

// ── Shared Handlers ──

const SKIP_HEADERS = new Set([
  'content-encoding', 'transfer-encoding', 'connection', 'keep-alive'
]);

function extractAuthHeaders(req) {
  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
  if (req.headers['x-api-key']) headers['x-api-key'] = req.headers['x-api-key'];
  if (req.headers['anthropic-version']) headers['anthropic-version'] = req.headers['anthropic-version'];
  return headers;
}

function pipeResponse(apiResponse, res) {
  res.status(apiResponse.status);
  apiResponse.headers.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
  });
  if (apiResponse.body) {
    Readable.fromWeb(apiResponse.body).pipe(res);
  } else {
    res.end();
  }
}

async function handleChatCompletion(req, res, provider, maxHistory) {
  const targetBase = PROVIDER_URLS[provider];
  if (!targetBase) {
    return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } });
  }

  try {
    let { messages, ...rest } = req.body;
    let savedChars = 0;
    let trimmedMsgs = 0;
    let detectedSkills = 'all';

    if (messages && messages.length > 0) {
      const lastUserMsg = getLastUserMessage(messages);
      const relevantSkills = classifyIntent(lastUserMsg);
      detectedSkills = relevantSkills ? relevantSkills.join(',') : 'all';

      if (messages[0]?.role === 'system' && typeof messages[0].content === 'string') {
        const original = messages[0].content;
        messages = [...messages];
        messages[0] = { ...messages[0], content: optimizeSystemPrompt(original, relevantSkills) };
        savedChars = original.length - messages[0].content.length;
      }

      const originalCount = messages.length;
      messages = trimHistory(messages, maxHistory);
      trimmedMsgs = originalCount - messages.length;
    }

    if (savedChars > 0 || trimmedMsgs > 0) {
      console.log(
        `[proxy] ${rest.model || '?'} | ctx:${maxHistory} | skills: ${detectedSkills} | ` +
        `saved ~${Math.ceil(savedChars / 4)} prompt tokens | trimmed ${trimmedMsgs} msgs`
      );
    }

    const targetUrl = `${targetBase}/v1/chat/completions`;
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: extractAuthHeaders(req),
      body: JSON.stringify({ messages, ...rest })
    });

    pipeResponse(apiResponse, res);
  } catch (error) {
    console.error('[proxy] Error:', error.message);
    res.status(502).json({ error: { message: 'LLM proxy error: ' + error.message } });
  }
}

async function handlePassThrough(req, res, provider, restPath) {
  const targetBase = PROVIDER_URLS[provider];
  if (!targetBase) {
    return res.status(400).json({ error: { message: `Unknown provider: ${provider}` } });
  }

  try {
    const targetUrl = `${targetBase}/${restPath}`;
    const headers = {};
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers['x-api-key']) headers['x-api-key'] = req.headers['x-api-key'];
    if (req.headers['anthropic-version']) headers['anthropic-version'] = req.headers['anthropic-version'];

    const fetchOpts = { method: req.method, headers };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    pipeResponse(await fetch(targetUrl, fetchOpts), res);
  } catch (error) {
    console.error('[proxy] Pass-through error:', error.message);
    res.status(502).json({ error: { message: 'LLM proxy error: ' + error.message } });
  }
}

// ── Routes: with per-request max_history (URL: /:maxHistory/:provider/v1/...) ──

app.post('/:maxHistory(\\d+)/:provider/v1/chat/completions', (req, res) => {
  handleChatCompletion(req, res, req.params.provider, Number.parseInt(req.params.maxHistory));
});

app.all('/:maxHistory(\\d+)/:provider/*', (req, res) => {
  handlePassThrough(req, res, req.params.provider, req.params[0]);
});

// ── Routes: legacy (URL: /:provider/v1/...) — uses default MAX_HISTORY ──

app.post('/:provider/v1/chat/completions', (req, res) => {
  handleChatCompletion(req, res, req.params.provider, MAX_HISTORY);
});

app.all('/:provider/*', (req, res) => {
  handlePassThrough(req, res, req.params.provider, req.params[0]);
});

// ── Start ──

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[llm-proxy] Running on port ${PORT}`);
  console.log(`[llm-proxy] Max history: ${MAX_HISTORY} messages`);
  console.log(`[llm-proxy] Providers: ${Object.keys(PROVIDER_URLS).join(', ')}`);
  console.log(`[llm-proxy] Skill routing: keyword-based (${Object.keys(SKILL_KEYWORDS).length} skills)`);
});
