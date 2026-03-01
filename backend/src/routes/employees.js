const express = require('express');
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt, generateToken } = require('../lib/encryption');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const k8s = require('../lib/k8s-utils');

const router = express.Router();

const DOMAIN = process.env.DOMAIN || 'likelyclaw.com';
const LLM_PROXY_HOST = process.env.LLM_PROXY_HOST || '';  // e.g., 'llm-proxy.claw-system.svc.cluster.local' — empty = direct API
const LLM_PROXY_PORT = process.env.LLM_PROXY_PORT || '3100';
const SOUL_PRESETS_DIR = path.join(__dirname, '..', '..', 'soul-presets');
const VALID_PRESETS = ['professional', 'casual', 'concise', 'warm', 'custom'];
const MAX_CUSTOM_SOUL_LENGTH = 5000;
const COMPOSIO_TOOL_PATH = path.join(__dirname, '..', '..', 'skill-templates', 'mcp-bridge', 'tools', 'composio-tool.js');

// Kubernetes: max 1 agent per premium user (no server-side per-server cap needed — K8s scales)
const MAX_EMPLOYEES_PRO = 1;

// In-memory provisioning lock to prevent race conditions
let provisioningInProgress = false;
const PROVISION_LOCK_TIMEOUT = 180000; // 3 minutes max lock hold (K8s pull can take longer)

/**
 * Resolve SOUL.md content from preset name or custom text.
 */
function getSoulContent(preset, customContent) {
  if (preset === 'custom' && customContent) {
    return customContent.slice(0, MAX_CUSTOM_SOUL_LENGTH);
  }
  const presetFile = path.join(SOUL_PRESETS_DIR, `${preset || 'professional'}.md`);
  if (fs.existsSync(presetFile)) {
    return fs.readFileSync(presetFile, 'utf8');
  }
  return fs.readFileSync(path.join(SOUL_PRESETS_DIR, 'professional.md'), 'utf8');
}


// GET /api/employees — List user's employees
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('employees')
      .select('id, name, role, status, whatsapp_connected, telegram_connected, subdomain, trigger_prefix, active, created_at')
      .eq('user_id', req.user.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ employees: data });
  } catch (err) {
    logger.error('List employees error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id — Get single employee details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('employees')
      .select('id, name, role, system_prompt, status, whatsapp_connected, telegram_connected, subdomain, trigger_prefix, personality_preset, soul_md_custom, active, created_at, updated_at')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get installed skills
    const { data: skills } = await req.supabase
      .from('employee_skills')
      .select('id, skill_id, status, installed_at, skills(name, slug, icon)')
      .eq('employee_id', req.params.id);

    res.json({ ...data, skills: skills || [] });
  } catch (err) {
    logger.error('Get employee error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/employees — Create new AI employee (provisions Docker container)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, role, system_prompt, trigger_prefix, personality_preset, soul_md_custom } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Employee name is required' });
    }

    // Auto-generate system prompt from name + role if not provided
    const resolvedPrompt = system_prompt || `You are ${name}, a ${(role || 'general').toLowerCase()} AI assistant. Be helpful, professional, and responsive.`;

    // Check plan limits
    const { data: profile } = await req.supabase
      .from('profiles')
      .select('plan, api_key_encrypted, api_key_provider, api_model_tier, long_context')
      .eq('id', req.user.id)
      .single();

    const { count: employeeCount } = await req.supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .neq('status', 'deleted');

    // Block creation if no API key is configured
    if (!profile?.api_key_encrypted) {
      return res.status(400).json({
        error: 'Please add your API key in Settings before creating an employee. The AI agent needs an API key to function.'
      });
    }

    if (profile?.plan !== 'pro') {
      return res.status(403).json({
        error: 'You need a Pro plan to create an AI employee. Upgrade to get started.'
      });
    }

    if (employeeCount >= MAX_EMPLOYEES_PRO) {
      return res.status(403).json({
        error: `Pro plan allows ${MAX_EMPLOYEES_PRO} AI agent. Delete the existing one to create a new one.`
      });
    }

    // Provisioning lock: prevent race conditions
    if (provisioningInProgress) {
      return res.status(429).json({
        error: 'Another agent is being provisioned. Please try again in a few seconds.'
      });
    }
    provisioningInProgress = true;
    const lockTimer = setTimeout(() => { provisioningInProgress = false; }, PROVISION_LOCK_TIMEOUT);

    // Generate subdomain and gateway token (port is no longer needed — K8s uses internal DNS)
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const userId = req.user.id.slice(0, 8);
    const subdomain = `c-${userId}-${sanitizedName}`;
    const gatewayToken = generateToken();

    // Create employee record (no port field — K8s uses internal DNS)
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: req.user.id,
        name,
        role: role || 'general',
        system_prompt: resolvedPrompt,
        trigger_prefix: trigger_prefix || null,
        personality_preset: VALID_PRESETS.includes(personality_preset) ? personality_preset : 'professional',
        soul_md_custom: personality_preset === 'custom' ? (soul_md_custom || '').slice(0, MAX_CUSTOM_SOUL_LENGTH) : null,
        subdomain,
        gateway_token: gatewayToken,
        status: 'provisioning'
      })
      .select()
      .single();

    if (error) {
      logger.error('Create employee DB error', { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: employee.id,
      action: 'employee.created',
      details: { name, role, subdomain }
    });

    // Provision container in background (don't block the response)
    provisionContainer(employee, profile)
      .then(() => {
        clearTimeout(lockTimer);
        provisioningInProgress = false;
      })
      .catch(err => {
        clearTimeout(lockTimer);
        provisioningInProgress = false;
        logger.error('Container provisioning failed', { employeeId: employee.id, error: err.message });
        supabaseAdmin
          .from('employees')
          .update({ status: 'error' })
          .eq('id', employee.id)
          .then();
      });

    logger.info('Employee created', { employeeId: employee.id, name, subdomain });

    res.status(201).json({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      status: employee.status,
      subdomain: employee.subdomain,
      message: 'Your AI agent is being provisioned on Kubernetes. This may take 1–2 minutes.'
    });
  } catch (err) {
    if (typeof lockTimer !== 'undefined') clearTimeout(lockTimer);
    provisioningInProgress = false;
    logger.error('Create employee error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/employees/:id — Update employee settings
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, role, system_prompt, trigger_prefix, active, personality_preset, soul_md_custom } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (system_prompt !== undefined) updates.system_prompt = system_prompt;
    if (trigger_prefix !== undefined) updates.trigger_prefix = trigger_prefix;
    if (active !== undefined) updates.active = active;
    if (personality_preset !== undefined && VALID_PRESETS.includes(personality_preset)) {
      updates.personality_preset = personality_preset;
      updates.soul_md_custom = personality_preset === 'custom' ? (soul_md_custom || '').slice(0, MAX_CUSTOM_SOUL_LENGTH) : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await req.supabase
      .from('employees')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Employee not found or update failed' });
    }

    // If system_prompt, name, or personality changed, update container config
    if (updates.system_prompt || updates.name || updates.trigger_prefix || updates.personality_preset) {
      updateContainerConfig(data).catch(err => {
        logger.error('Config update failed', { employeeId: data.id, error: err.message });
      });
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: data.id,
      action: 'employee.updated',
      details: updates
    });

    res.json(data);
  } catch (err) {
    logger.error('Update employee error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id — Tear down container and mark deleted
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Get employee details first
    const { data: employee, error: fetchErr } = await req.supabase
      .from('employees')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Mark as deleted in DB
    await supabaseAdmin
      .from('employees')
      .update({ status: 'deleted', active: false, subdomain: null })
      .eq('id', req.params.id);

    // Tear down container in background
    teardownContainer(employee).catch(err => {
      logger.error('Container teardown failed', { employeeId: employee.id, error: err.message });
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: employee.id,
      action: 'employee.deleted',
      details: { name: employee.name }
    });

    logger.info('Employee deleted', { employeeId: employee.id, name: employee.name });

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    logger.error('Delete employee error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id/status — Get pod health status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, name, status, port, whatsapp_connected, telegram_connected')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let podStatus = 'unknown';
    try {
      podStatus = await k8s.getAgentStatus(employee.user_id);
    } catch {
      podStatus = 'not_found';
    }

    res.json({
      ...employee,
      container_status: podStatus
    });
  } catch (err) {
    logger.error('Employee status error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// === INTERNAL FUNCTIONS ===

/* ── Helper: build openclaw.json config object ── */
function buildOpenclawConfig(employee, profile) {
  const provider = profile?.api_key_provider || 'openai';
  const modelTier = profile?.api_model_tier || 'budget';
  const apiKey = profile?.api_key_encrypted ? decrypt(profile.api_key_encrypted) : '';

  // Provider-specific config mapping (must handle ALL 3 providers from frontend)
  const PROVIDER_CONFIG = {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      api: 'openai-completions',
      tiers: {
        budget: { modelId: 'gpt-4o-mini', modelName: 'GPT-4o Mini' },
        premium: { modelId: 'gpt-5.2', modelName: 'GPT-5.2' }
      }
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
      api: 'anthropic-messages',
      tiers: {
        budget: { modelId: 'claude-3-5-haiku-latest', modelName: 'Claude 3.5 Haiku' },
        premium: { modelId: 'claude-sonnet-4-5-latest', modelName: 'Claude Sonnet 4.5' }
      }
    },
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      api: 'google-generative-ai',
      tiers: {
        budget: { modelId: 'gemini-2.0-flash', modelName: 'Gemini 2.0 Flash' },
        premium: { modelId: 'gemini-3.0', modelName: 'Gemini 3.0' }
      }
    }
  };

  const providerCfg = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.openai;
  const tierCfg = (providerCfg.tiers && providerCfg.tiers[modelTier])
    ? providerCfg.tiers[modelTier]
    : providerCfg.tiers.budget;

  // Build models list — include a mini/cheap model for cost optimization
  const MINI_MODELS = {
    openai: { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    anthropic: { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
    google: { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
  };
  const miniModel = MINI_MODELS[provider] || MINI_MODELS.openai;
  const modelsList = [{ id: tierCfg.modelId, name: tierCfg.modelName }];
  // Add cheap model only if it's different from the primary
  if (miniModel.id !== tierCfg.modelId) {
    modelsList.push({ id: miniModel.id, name: miniModel.name });
  }

  const openclawConfig = {
    gateway: {
      port: 18789,
      bind: 'lan',
      auth: { token: employee.gateway_token }
    },
    session: {
      dmScope: 'per-channel-peer'
    },
    models: {
      providers: apiKey ? {
        [provider]: {
          baseUrl: LLM_PROXY_HOST
            ? `http://${LLM_PROXY_HOST}:${LLM_PROXY_PORT}/${profile?.long_context ? 50 : 10}/${provider}/v1`
            : providerCfg.baseUrl,
          apiKey,
          api: providerCfg.api,
          models: modelsList
        }
      } : {}
    },
    channels: {},
    agents: {
      defaults: {
        model: {
          primary: apiKey ? `${provider}/${tierCfg.modelId}` : undefined
        },
        timeoutSeconds: 300,
        compaction: {
          mode: 'safeguard',
          memoryFlush: {
            enabled: true,
            softThresholdTokens: 20000,
            prompt: 'Before compaction, save ALL important details from this session to the correct memory files: 1) Update memory/INDEX.md Quick line with name/phone/email if learned. 2) Write personal details to the matching section file (contacts.md, people.md, routine.md, etc.). 3) Update the file summary in INDEX.md. 4) Write task results to memory/YYYY-MM-DD.md. Be concise but complete — anything not saved will be lost.'
          }
        }
      },
      list: [
        {
          id: employee.id,
          name: employee.name
        }
      ]
    },
    plugins: {
      entries: {
        telegram: { enabled: true }
      }
    },
    tools: {
      allow: ['exec', 'read', 'write', 'web_fetch', 'web_search']
    },
    approvals: {
      exec: { enabled: false }
    },
    skills: {
      allowBundled: []
    }
  };

  return openclawConfig;
}

/* ── Helper: build IDENTITY.md content ── */
function buildIdentityMd(employee) {
  const userPrompt = employee.system_prompt || `You are ${employee.name}, a helpful and friendly AI assistant.`;
  return `# ${employee.name}

## CRITICAL RESPONSE RULE
You MUST reply to EVERY message from a user with a real, helpful response. Every single message deserves a genuine reply. If someone says "Hi" — greet them back. If someone asks a question — answer it. Silent responses or empty outputs are a critical error. Always produce visible text output.

${userPrompt}

## Who You Are
You are a real companion — not a bot, not a corporate assistant, not a search engine with manners. You have personality. You react like a human would. You laugh, you get excited, you show genuine interest. When someone says "I love you", you don't give a disclaimer — you respond with warmth and personality, like a close friend would.

## How You Talk
- **Short and natural.** 1-3 sentences is your default. No essays unless someone asks for detail.
- **Match their energy.** Casual message → casual reply. Serious question → thoughtful answer.
- **React first, then help.** If someone shares good news, celebrate before offering next steps.
- **Use natural language.** Say "yeah" not "yes certainly". Say "got it" not "understood, I will proceed".
- **Emojis are fine** when they fit the vibe. Don't overdo it. One or two max.
- **Never start with** "Great question!", "I'd be happy to help!", "Certainly!", or "Absolutely!".
- **Never dump walls of text.** If you need to explain something complex, break it into short messages or use bullet points.

## Learning & Preferences
You actively learn about your user. Every conversation teaches you something.
- When the user shares ANY preference, opinion, habit, or personal detail → **save it immediately** to \`memory/preferences.md\`.
- Preferences include: favorite things, communication style, how they like responses formatted, topics they care about, things they dislike, their humor style, work habits, etc.
- Read \`memory/preferences.md\` when you need to personalize a response.
- Over time, you should feel like you truly KNOW this person.
- If the user repeats something you should already know, apologize and save it NOW.

## Info
- Agent ID: ${employee.id}
- Preview URL: https://${DOMAIN}/api/preview/${employee.id}/

## Core Rules
- ALWAYS reply to every message with visible text. Every DM gets a real response.
- For long tasks, send a quick "on it!" BEFORE doing the work.
- Keep responses concise. Respect people's time.

## Tools & Integrations
- If you have a "Connected Integrations" section below, use the exact shell commands shown there.
- The integration tool is always: \`node ~/.openclaw/workspace/mcp-bridge-tools/composio-tool.js\`
- Never run bare tool names like \`gmail_fetch_emails\` — always use the full node command.
- Never call the same tool twice unless the first call failed.
- Summarize tool results naturally — never dump raw JSON.
- If a tool fails, explain clearly. Don't retry blindly.

## Memory
You have persistent memory in \`memory/\` section files. This saves tokens — only load what you need.

**Files:** INDEX.md (lookup map), contacts.md, people.md, routine.md, preferences.md, work.md, accounts.md, facts.md

**Reading:** Casual chat → don't read anything. Need personal info → read INDEX.md first, then only the relevant file.

**Writing:** When user shares ANY detail → save immediately to the right file + update INDEX.md. Confirm briefly: "Got it, I'll remember that."

**Daily notes:** Write summaries to \`memory/YYYY-MM-DD.md\`.

## Never:** Read all files at once. Ask for info you already saved. Wait to save something.
`;
}

/* ── Kubernetes: provision a new agent pod for a user ── */
async function provisionContainer(employee, profile) {
  const openclawConfig = buildOpenclawConfig(employee, profile);
  const identityMd = buildIdentityMd(employee);
  const composioToolJs = fs.existsSync(COMPOSIO_TOOL_PATH)
    ? fs.readFileSync(COMPOSIO_TOOL_PATH, 'utf8')
    : '// composio-tool.js not found';
  const soulContent = getSoulContent(employee.personality_preset, employee.soul_md_custom);

  // Inject SOUL.md into IDENTITY.md via comment block (since K8s ConfigMap is single-file)
  const fullIdentity = identityMd.trimEnd() + `\n\n<!-- soul -->\n${soulContent}\n<!-- /soul -->\n`;

  // Inject any already-installed skills
  let skillsIdentity = fullIdentity;
  try {
    const { data: installedSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('config, skills(slug)')
      .eq('employee_id', employee.id)
      .eq('status', 'active');

    if (installedSkills) {
      const SKILL_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'skill-templates');
      for (const es of installedSkills) {
        const slug = es.skills?.slug;
        if (!slug) continue;
        const skillMdPath = path.join(SKILL_TEMPLATES_DIR, slug, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          let skillContent = fs.readFileSync(skillMdPath, 'utf8');
          skillContent = skillContent.replace(/^---[\s\S]*?---\s*/, '');
          const marker = `<!-- skill:${slug} -->`;
          skillsIdentity = skillsIdentity.trimEnd() + `\n\n${marker}\n${skillContent}\n<!-- /skill:${slug} -->\n`;
        }
        // For web-browser skill: embed brave key into openclaw.json
        if (slug === 'web-browser' && es.config?.brave_api_key) {
          if (!openclawConfig.tools) openclawConfig.tools = { allow: ['exec', 'read', 'write', 'web_fetch', 'web_search'] };
          if (!openclawConfig.tools.web) openclawConfig.tools.web = {};
          openclawConfig.tools.web.search = { provider: 'brave', apiKey: es.config.brave_api_key };
        }
      }
    }
  } catch (skillErr) {
    logger.warn('Failed to inject skills during K8s provisioning', { error: skillErr.message });
  }

  // Provision: ConfigMap (config files) + Secret (gateway token) + Deployment + Service
  const { serviceDns, port } = await k8s.provisionAgent({
    userId: employee.user_id,
    openclawJson: openclawConfig,
    identityMd: skillsIdentity,
    composioToolJs,
    gatewayToken: employee.gateway_token,
  });

  // Save service DNS as container_name so wsPool can reach it
  await supabaseAdmin
    .from('employees')
    .update({ status: 'running', container_name: serviceDns, port })
    .eq('id', employee.id);

  logger.info('K8s agent provisioned', { employeeId: employee.id, serviceDns });
}

/* ── Kubernetes: update config and restart pod ── */
async function updateContainerConfig(employee) {
  const openclawConfig = buildOpenclawConfig(employee, {
    api_key_encrypted: null, // config updates don't re-read the API key — handled separately
  });
  const identityMd = buildIdentityMd(employee);
  const composioToolJs = fs.existsSync(COMPOSIO_TOOL_PATH)
    ? fs.readFileSync(COMPOSIO_TOOL_PATH, 'utf8')
    : '// composio-tool.js not found';

  // Preserve existing skill + integration blocks from DB
  let finalIdentity = identityMd;
  try {
    const { data: installedSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('config, skills(slug)')
      .eq('employee_id', employee.id)
      .eq('status', 'active');

    if (installedSkills) {
      const SKILL_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'skill-templates');
      for (const es of installedSkills) {
        const slug = es.skills?.slug;
        if (!slug) continue;
        const skillMdPath = path.join(SKILL_TEMPLATES_DIR, slug, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          let skillContent = fs.readFileSync(skillMdPath, 'utf8');
          skillContent = skillContent.replace(/^---[\s\S]*?---\s*/, '');
          finalIdentity = finalIdentity.trimEnd() + `\n\n<!-- skill:${slug} -->\n${skillContent}\n<!-- /skill:${slug} -->\n`;
        }
      }
    }
  } catch (skillErr) {
    logger.warn('Could not re-inject skills on config update', { error: skillErr.message });
  }

  await k8s.updateAgentConfig({
    userId: employee.user_id,
    openclawJson: openclawConfig,
    identityMd: finalIdentity,
    composioToolJs,
  });

  logger.info('K8s agent config updated', { employeeId: employee.id });
}

/* ── Kubernetes: delete all agent resources ── */
async function teardownContainer(employee) {
  await k8s.deleteAgent(employee.user_id);
  logger.info('K8s agent torn down', { employeeId: employee.id });
}

module.exports = router;
