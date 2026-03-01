const express = require('express');
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { encrypt } = require('../lib/encryption');
const logger = require('../config/logger');
const k8s = require('../lib/k8s-utils');
const wsPool = require('../lib/wsPool');

const router = express.Router();

const LLM_PROXY_HOST = process.env.LLM_PROXY_HOST || '';
const LLM_PROXY_PORT = process.env.LLM_PROXY_PORT || '3100';

const SHORT_CONTEXT = 10;  // messages kept with long_context OFF
const LONG_CONTEXT = 50;   // messages kept with long_context ON

/**
 * Compute the LLM base URL. When proxy is enabled, encodes max_history in the path.
 * Short: http://host.docker.internal:3100/10/openai/v1
 * Long:  http://host.docker.internal:3100/50/openai/v1
 */
function getLlmBaseUrl(provider, directUrl, longContext = false) {
  if (!LLM_PROXY_HOST) return directUrl;
  const ctx = longContext ? LONG_CONTEXT : SHORT_CONTEXT;
  return `http://${LLM_PROXY_HOST}:${LLM_PROXY_PORT}/${ctx}/${provider}/v1`;
}

// PUT /api/settings/api-key — Save or update user's LLM API key
router.put('/api-key', authMiddleware, async (req, res) => {
  try {
    const { api_key, provider, tier } = req.body;

    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const validProviders = ['openai', 'anthropic', 'google'];
    const selectedProvider = provider || 'openai';
    if (!validProviders.includes(selectedProvider)) {
      return res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
    }

    const validTiers = ['budget', 'premium'];
    const selectedTier = tier || 'budget';
    if (!validTiers.includes(selectedTier)) {
      return res.status(400).json({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` });
    }

    // Basic key format validation
    if (selectedProvider === 'openai' && !api_key.startsWith('sk-')) {
      return res.status(400).json({ error: 'OpenAI keys should start with sk-' });
    }

    // Encrypt and store
    const encryptedKey = encrypt(api_key);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        api_key_encrypted: encryptedKey,
        api_key_provider: selectedProvider,
        api_model_tier: selectedTier
      })
      .eq('id', req.user.id);

    if (error) {
      logger.error('Supabase update failed', { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    // Update all running K8s agent pods for this user with the new API key
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, user_id')
      .eq('user_id', req.user.id)
      .eq('status', 'running');

    const PROVIDER_CONFIG = {
      openai:    { baseUrl: 'https://api.openai.com/v1',                     api: 'openai-completions',    tiers: { budget: { modelId: 'gpt-4o-mini', modelName: 'GPT-4o Mini' }, premium: { modelId: 'gpt-5.2', modelName: 'GPT-5.2' } } },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1',                   api: 'anthropic-messages',    tiers: { budget: { modelId: 'claude-3-5-haiku-latest', modelName: 'Claude 3.5 Haiku' }, premium: { modelId: 'claude-sonnet-4-5-latest', modelName: 'Claude Sonnet 4.5' } } },
      google:    { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', api: 'google-generative-ai', tiers: { budget: { modelId: 'gemini-2.0-flash', modelName: 'Gemini 2.0 Flash' }, premium: { modelId: 'gemini-3.0', modelName: 'Gemini 3.0' } } }
    };
    const providerCfg = PROVIDER_CONFIG[selectedProvider] || PROVIDER_CONFIG.openai;
    const tierCfg = providerCfg.tiers[selectedTier] || providerCfg.tiers.budget;

    const { data: userProfile } = await supabaseAdmin.from('profiles').select('long_context').eq('id', req.user.id).single();
    const longCtx = userProfile?.long_context || false;

    if (employees && employees.length > 0) {
      for (const emp of employees) {
        wsPool.removePool(emp.id);
        k8s.patchAgentConfig(emp.user_id, (config) => {
          config.models = config.models || {};
          config.models.providers = {
            [selectedProvider]: {
              baseUrl: getLlmBaseUrl(selectedProvider, providerCfg.baseUrl, longCtx),
              apiKey: api_key,
              api: providerCfg.api,
              models: [{ id: tierCfg.modelId, name: tierCfg.modelName }]
            }
          };
          config.agents = config.agents || {};
          config.agents.defaults = config.agents.defaults || {};
          config.agents.defaults.model = config.agents.defaults.model || {};
          config.agents.defaults.model.primary = `${selectedProvider}/${tierCfg.modelId}`;
          return config;
        }).catch(err => logger.warn('K8s patch failed after API key change', { employeeId: emp.id, error: err.message }));
      }
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'settings.api_key_updated',
      details: { provider: selectedProvider, key_preview: api_key.slice(0, 7) + '...' }
    });

    logger.info('API key updated', { userId: req.user.id, provider: selectedProvider });

    res.json({
      message: 'API key saved successfully',
      provider: selectedProvider,
      tier: selectedTier,
      pods_updated: employees?.length || 0
    });
  } catch (err) {
    logger.error('Update API key error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settings/api-key — Remove user's LLM API key
router.delete('/api-key', authMiddleware, async (req, res) => {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ api_key_encrypted: null })
      .eq('id', req.user.id);

    res.json({ message: 'API key removed' });
  } catch (err) {
    logger.error('Delete API key error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/long-context — Toggle long context mode
router.put('/long-context', authMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body;
    const longContext = Boolean(enabled);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ long_context: longContext })
      .eq('id', req.user.id);

    if (error) {
      logger.error('Supabase update long_context failed', { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    // Update running K8s agent pods — change proxy URL to reflect new context length
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, user_id')
      .eq('user_id', req.user.id)
      .eq('status', 'running');

    let containersUpdated = 0;
    if (employees && employees.length > 0 && LLM_PROXY_HOST) {
      for (const emp of employees) {
        wsPool.removePool(emp.id);
        k8s.patchAgentConfig(emp.user_id, (config) => {
          const providers = config.models?.providers || {};
          for (const [prov, provCfg] of Object.entries(providers)) {
            if (typeof provCfg.baseUrl === 'string' && provCfg.baseUrl.includes(LLM_PROXY_HOST)) {
              provCfg.baseUrl = getLlmBaseUrl(prov, provCfg.baseUrl, longContext);
            }
          }
          return config;
        }).then(() => { containersUpdated++; })
          .catch(err => logger.warn('K8s patch failed for long_context toggle', { employeeId: emp.id, error: err.message }));
      }
    }

    logger.info('Long context toggled', { userId: req.user.id, enabled: longContext });

    res.json({
      message: `Long context ${longContext ? 'enabled' : 'disabled'}`,
      long_context: longContext,
      context_messages: longContext ? LONG_CONTEXT : SHORT_CONTEXT,
      pods_updated: containersUpdated
    });
  } catch (err) {
    logger.error('Toggle long context error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
