const express = require('express');
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const k8s = require('../lib/k8s-utils');

const router = express.Router();

const SKILL_TEMPLATES_DIR = path.join(__dirname, '..', '..', 'skill-templates');

// GET /api/marketplace/skills — List all available skills
router.get('/skills', authMiddleware, async (req, res) => {
  try {
    const { data: skills, error } = await req.supabase
      .from('skills')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ skills });
  } catch (err) {
    logger.error('List skills error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/marketplace/install — Install a skill on an employee
router.post('/install', authMiddleware, async (req, res) => {
  try {
    const { employee_id, skill_id } = req.body;

    if (!employee_id || !skill_id) {
      return res.status(400).json({ error: 'employee_id and skill_id are required' });
    }

    // Verify employee belongs to user
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Verify skill exists
    const { data: skill } = await req.supabase
      .from('skills')
      .select('*')
      .eq('id', skill_id)
      .eq('active', true)
      .single();

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Check if already installed
    const { data: existing } = await req.supabase
      .from('employee_skills')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('skill_id', skill_id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Skill already installed on this employee' });
    }

    // Determine initial status: if skill needs credentials that aren't set up yet, mark as pending
    // But if this is a brave_api_key skill and the employee already has a Brave key from another skill, auto-activate
    let initialStatus = skill.needs_credentials ? 'pending_setup' : 'active';
    let existingBraveKey = null;

    if (skill.credential_type === 'brave_api_key') {
      const { data: existingBraveSkills } = await supabaseAdmin
        .from('employee_skills')
        .select('config, skills(credential_type)')
        .eq('employee_id', employee_id)
        .eq('status', 'active');

      const withKey = (existingBraveSkills || []).find(
        s => s.skills?.credential_type === 'brave_api_key' && s.config?.brave_api_key
      );
      if (withKey) {
        existingBraveKey = withKey.config.brave_api_key;
        initialStatus = 'active';
      }
    }

    // Install skill in DB
    const { data: installation, error } = await supabaseAdmin
      .from('employee_skills')
      .insert({
        employee_id,
        skill_id,
        status: initialStatus,
        config: existingBraveKey ? { brave_api_key: existingBraveKey } : {}
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Inject skill instructions into ConfigMap IDENTITY.md and restart pod
    const skillMdPath = path.join(SKILL_TEMPLATES_DIR, skill.slug, 'SKILL.md');
    if (fs.existsSync(skillMdPath) && employee.status === 'running') {
      let skillContent = fs.readFileSync(skillMdPath, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
      const marker = `<!-- skill:${skill.slug} -->`;
      k8s.patchAgentConfig(employee.user_id, (config) => {
        if (!config.tools) config.tools = { allow: ['exec', 'read', 'write', 'web_fetch', 'web_search'] };
        if (!config.approvals) config.approvals = { exec: { enabled: false } };
        return config;
      }).catch(err => logger.warn('K8s openclaw.json patch failed on skill install', { skill: skill.slug, error: err.message }));

      // Patch IDENTITY.md in ConfigMap via a dedicated CM update
      // patchAgentConfig handles openclaw.json; for IDENTITY.md we need a separate patch
      try {
        const safeUserId = employee.user_id.replace(/_/g, '-').slice(0, 50);
        const { CoreV1Api, KubeConfig } = require('@kubernetes/client-node');
        const kc2 = new KubeConfig();
        kc2.loadFromDefault();
        const coreV1b = kc2.makeApiClient(CoreV1Api);
        const cmName = `agent-config-${safeUserId}`;
        const cm = await coreV1b.readNamespacedConfigMap({ name: cmName, namespace: 'claw-agents' });
        const identity = cm.data?.['IDENTITY.md'] || '';
        if (!identity.includes(marker)) {
          const patched = identity.trimEnd() + `\n\n${marker}\n${skillContent}\n<!-- /skill:${skill.slug} -->\n`;
          await coreV1b.replaceNamespacedConfigMap({
            name: cmName, namespace: 'claw-agents',
            body: { ...cm, data: { ...cm.data, 'IDENTITY.md': patched } }
          });
          await k8s.restartAgentPod(employee.user_id);
          logger.info('Skill injected into K8s ConfigMap IDENTITY.md', { skill: skill.slug });
        }
      } catch (injectErr) {
        logger.warn('K8s IDENTITY.md skill injection failed (skill saved in DB)', { skill: skill.slug, error: injectErr.message });
      }
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id,
      action: 'skill.installed',
      details: { skill_name: skill.name, skill_slug: skill.slug, status: initialStatus }
    });

    logger.info('Skill installed', { employeeId: employee_id, skill: skill.slug, status: initialStatus });

    res.status(201).json({
      message: `${skill.name} installed successfully`,
      installation,
      needs_setup: skill.needs_credentials && !existingBraveKey,
      credential_type: skill.credential_type,
      auto_configured: !!existingBraveKey
    });
  } catch (err) {
    logger.error('Install skill error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/marketplace/uninstall — Remove a skill from an employee
router.post('/uninstall', authMiddleware, async (req, res) => {
  try {
    const { employee_id, skill_id } = req.body;

    if (!employee_id || !skill_id) {
      return res.status(400).json({ error: 'employee_id and skill_id are required' });
    }

    // Verify employee belongs to user
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get skill slug before deleting (needed for file cleanup)
    const { data: skill } = await req.supabase
      .from('skills')
      .select('slug, name, needs_credentials, credential_type')
      .eq('id', skill_id)
      .single();

    const { error } = await supabaseAdmin
      .from('employee_skills')
      .delete()
      .eq('employee_id', employee_id)
      .eq('skill_id', skill_id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Remove skill from ConfigMap IDENTITY.md and restart pod
    if (skill && employee.status === 'running') {
      try {
        const safeUserId = employee.user_id.replace(/_/g, '-').slice(0, 50);
        const { CoreV1Api, KubeConfig } = require('@kubernetes/client-node');
        const kc2 = new KubeConfig();
        kc2.loadFromDefault();
        const coreV1b = kc2.makeApiClient(CoreV1Api);
        const cmName = `agent-config-${safeUserId}`;
        const cm = await coreV1b.readNamespacedConfigMap({ name: cmName, namespace: 'claw-agents' });
        let identity = cm.data?.['IDENTITY.md'] || '';
        const skillRegex = new RegExp(`\\n*<!-- skill:${skill.slug} -->[\\s\\S]*?<!-- /skill:${skill.slug} -->\\n?`, 'g');
        const updated = identity.replace(skillRegex, '');
        if (updated !== identity) {
          await coreV1b.replaceNamespacedConfigMap({
            name: cmName, namespace: 'claw-agents',
            body: { ...cm, data: { ...cm.data, 'IDENTITY.md': updated } }
          });
          await k8s.restartAgentPod(employee.user_id);
          logger.info('Skill removed from K8s ConfigMap IDENTITY.md', { skill: skill.slug });
        }
      } catch (removeErr) {
        logger.warn('K8s IDENTITY.md skill removal failed', { skill: skill.slug, error: removeErr.message });
      }

      // Clean up OAuth tokens ONLY if no other employees still use this credentialed skill
      if (skill.needs_credentials && skill.credential_type) {
        const { data: otherInstalls } = await supabaseAdmin
          .from('employee_skills')
          .select('id')
          .eq('skill_id', skill_id)
          .neq('employee_id', employee_id)
          .limit(1);

        if (!otherInstalls || otherInstalls.length === 0) {
          await supabaseAdmin
            .from('oauth_tokens')
            .delete()
            .eq('user_id', req.user.id)
            .eq('provider', skill.credential_type === 'google_oauth' ? 'google' : 'custom')
            .catch(() => {});
        }
      }
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id,
      action: 'skill.uninstalled',
      details: { skill_id, skill_name: skill?.name }
    });

    res.json({ message: 'Skill removed successfully' });
  } catch (err) {
    logger.error('Uninstall skill error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/marketplace/configure-brave — Save Brave Search API key for any brave_api_key skill
router.post('/configure-brave', authMiddleware, async (req, res) => {
  try {
    const { employee_id, api_key } = req.body;

    if (!employee_id || !api_key) {
      return res.status(400).json({ error: 'employee_id and api_key are required' });
    }

    // Verify employee belongs to user
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Find ALL pending brave_api_key skill installations for this employee
    const { data: pendingSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('id, skill_id, skills(slug, credential_type)')
      .eq('employee_id', employee_id)
      .eq('status', 'pending_setup');

    const braveSkills = (pendingSkills || []).filter(s => s.skills?.credential_type === 'brave_api_key');

    if (braveSkills.length === 0) {
      return res.status(404).json({ error: 'No pending skills requiring Brave API key found for this employee' });
    }

    // Store the API key and activate ALL pending brave_api_key skills at once
    for (const sk of braveSkills) {
      await supabaseAdmin
        .from('employee_skills')
        .update({ config: { brave_api_key: api_key }, status: 'active' })
        .eq('id', sk.id);
    }

    // Patch Brave API key into K8s ConfigMap openclaw.json and restart pod
    if (employee.status === 'running') {
      k8s.patchAgentConfig(employee.user_id, (config) => {
        if (!config.tools) config.tools = { allow: ['exec', 'read', 'write', 'web_fetch', 'web_search'] };
        if (!config.tools.web) config.tools.web = {};
        config.tools.web.search = { provider: 'brave', apiKey: api_key };
        return config;
      }).catch(err => {
        logger.error('K8s patch failed for Brave key', { error: err.message });
      });
    }

    const activatedSlugs = braveSkills.map(s => s.skills?.slug).filter(Boolean);

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id,
      action: 'skill.configured',
      details: { skills: activatedSlugs, credential_type: 'brave_api_key' }
    });

    logger.info('Brave API key configured', { employeeId: employee_id, skills: activatedSlugs });

    res.json({ message: 'Web search configured successfully', status: 'active' });
  } catch (err) {
    logger.error('Configure Brave error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/marketplace/configure-twitter — Save Twitter Bearer Token
router.post('/configure-twitter', authMiddleware, async (req, res) => {
  try {
    const { employee_id, bearer_token } = req.body;

    if (!employee_id || !bearer_token) {
      return res.status(400).json({ error: 'employee_id and bearer_token are required' });
    }

    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, port, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Find pending twitter_api_key skill installations
    const { data: pendingSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('id, skill_id, skills(slug, credential_type)')
      .eq('employee_id', employee_id)
      .eq('status', 'pending_setup');

    const twitterSkills = (pendingSkills || []).filter(s => s.skills?.credential_type === 'twitter_api_key');

    if (twitterSkills.length === 0) {
      return res.status(404).json({ error: 'No pending Twitter skill found for this employee' });
    }

    for (const sk of twitterSkills) {
      await supabaseAdmin
        .from('employee_skills')
        .update({ config: { bearer_token }, status: 'active' })
        .eq('id', sk.id);
    }

    // Twitter credentials are stored in DB config; restart pod so agent picks them up from SKILL.md
    if (employee.status === 'running') {
      k8s.restartAgentPod(employee.user_id).catch(err =>
        logger.warn('K8s restart after Twitter config failed', { error: err.message })
      );
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id,
      action: 'skill.configured',
      details: { skill: 'twitter', credential_type: 'twitter_api_key' }
    });

    res.json({ message: 'Twitter configured successfully', status: 'active' });
  } catch (err) {
    logger.error('Configure Twitter error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/marketplace/configure-spotify — Save Spotify Client ID + Secret
router.post('/configure-spotify', authMiddleware, async (req, res) => {
  try {
    const { employee_id, client_id, client_secret } = req.body;

    if (!employee_id || !client_id || !client_secret) {
      return res.status(400).json({ error: 'employee_id, client_id, and client_secret are required' });
    }

    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data: pendingSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('id, skill_id, skills(slug, credential_type)')
      .eq('employee_id', employee_id)
      .eq('status', 'pending_setup');

    const spotifySkills = (pendingSkills || []).filter(s => s.skills?.credential_type === 'spotify_api_key');

    if (spotifySkills.length === 0) {
      return res.status(404).json({ error: 'No pending Spotify skill found for this employee' });
    }

    for (const sk of spotifySkills) {
      await supabaseAdmin
        .from('employee_skills')
        .update({ config: { client_id, client_secret }, status: 'active' })
        .eq('id', sk.id);
    }

    // Spotify credentials stored in DB config; restart pod so agent picks them up from SKILL.md
    if (employee.status === 'running') {
      k8s.restartAgentPod(employee.user_id).catch(err =>
        logger.warn('K8s restart after Spotify config failed', { error: err.message })
      );
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id,
      action: 'skill.configured',
      details: { skill: 'spotify', credential_type: 'spotify_api_key' }
    });

    res.json({ message: 'Spotify configured successfully', status: 'active' });
  } catch (err) {
    logger.error('Configure Spotify error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/marketplace/configure-mcp — Disabled, focusing on Telegram bot
// Supports both pending_setup (first server) and active (adding more servers) states
/* router.post('/configure-mcp', authMiddleware, async (req, res) => {
  try {
    const { employee_id, server_name, server_url, auth_token } = req.body;

    if (!employee_id || !server_name || !server_url) {
      return res.status(400).json({ error: 'employee_id, server_name, and server_url are required' });
    }

    // Validate URL — must be a proper HTTP(S) URL, not a JSON blob or config object
    const trimmedUrl = server_url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'server_url must be a valid HTTP or HTTPS URL (e.g. https://mcp.vapi.ai/mcp)' });
    }
    try {
      new URL(trimmedUrl);
    } catch {
      return res.status(400).json({ error: 'server_url is not a valid URL. Paste only the MCP server URL, not a JSON config block.' });
    }

    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, port, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Find MCP skills in any state (pending_setup OR active — so users can add more servers)
    const { data: allSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('id, skill_id, config, status, skills(slug, credential_type)')
      .eq('employee_id', employee_id);

    const mcpSkills = (allSkills || []).filter(s => s.skills?.credential_type === 'mcp_server_url');

    if (mcpSkills.length === 0) {
      return res.status(404).json({ error: 'No MCP skill found for this employee. Install MCP Bridge first.' });
    }

    // Merge new server into existing config
    const existingConfig = mcpSkills[0].config || {};
    const servers = existingConfig.servers || {};
    servers[server_name] = { url: server_url };
    if (auth_token) {
      servers[server_name].auth = { type: 'bearer', token: auth_token };
    }

    const mcpConfig = { servers };

    for (const sk of mcpSkills) {
      await supabaseAdmin
        .from('employee_skills')
        .update({ config: mcpConfig, status: 'active' })
        .eq('id', sk.id);
    }

    // Write mcp-servers.json config to container workspace
    const userDir = path.join(PLATFORM_DIR, 'users', employee.user_id.slice(0, 8) + '-' + employee.id.slice(0, 8));
    const mcpToolsDir = path.join(userDir, 'config', 'workspace', 'mcp-bridge-tools');
    fs.mkdirSync(mcpToolsDir, { recursive: true });
    fs.writeFileSync(path.join(mcpToolsDir, 'mcp-servers.json'), JSON.stringify(mcpConfig, null, 2));

    if (employee.status === 'running') {
      const configDir = path.join(userDir, 'config');
      await fixOwnership(configDir);
      const containerName = `claw-${employee.user_id.slice(0, 8)}-${employee.id.slice(0, 8)}`;
      scheduleDebouncedRestart(containerName);
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id,
      action: 'skill.configured',
      details: { server_name, credential_type: 'mcp_server_url', total_servers: Object.keys(servers).length }
    });

    logger.info('MCP server configured', { employeeId: employee_id, server: server_name, totalServers: Object.keys(servers).length });

    res.json({
      message: `MCP server "${server_name}" configured successfully`,
      status: 'active',
      servers: Object.keys(servers),
    });
  } catch (err) {
    logger.error('Configure MCP error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}); */

// DELETE /api/marketplace/mcp-server — Disabled, focusing on Telegram bot
/* router.delete('/mcp-server', authMiddleware, async (req, res) => {
  try {
    const { employee_id, server_name } = req.body;

    if (!employee_id || !server_name) {
      return res.status(400).json({ error: 'employee_id and server_name are required' });
    }

    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, port, status')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data: allSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('id, config, skills(credential_type)')
      .eq('employee_id', employee_id);

    const mcpSkills = (allSkills || []).filter(s => s.skills?.credential_type === 'mcp_server_url');
    if (mcpSkills.length === 0) {
      return res.status(404).json({ error: 'No MCP skill found' });
    }

    const existingConfig = mcpSkills[0].config || {};
    const servers = existingConfig.servers || {};
    delete servers[server_name];

    const mcpConfig = { servers };
    const newStatus = Object.keys(servers).length === 0 ? 'pending_setup' : 'active';

    for (const sk of mcpSkills) {
      await supabaseAdmin
        .from('employee_skills')
        .update({ config: mcpConfig, status: newStatus })
        .eq('id', sk.id);
    }

    // Update mcp-servers.json
    const userDir = path.join(PLATFORM_DIR, 'users', employee.user_id.slice(0, 8) + '-' + employee.id.slice(0, 8));
    const mcpToolsDir = path.join(userDir, 'config', 'workspace', 'mcp-bridge-tools');
    if (fs.existsSync(mcpToolsDir)) {
      fs.writeFileSync(path.join(mcpToolsDir, 'mcp-servers.json'), JSON.stringify(mcpConfig, null, 2));
    }

    if (employee.status === 'running') {
      const configDir = path.join(userDir, 'config');
      await fixOwnership(configDir);
      const containerName = `claw-${employee.user_id.slice(0, 8)}-${employee.id.slice(0, 8)}`;
      scheduleDebouncedRestart(containerName);
    }

    logger.info('MCP server removed', { employeeId: employee_id, server: server_name });
    res.json({ message: `Server "${server_name}" removed`, servers: Object.keys(servers) });
  } catch (err) {
    logger.error('Remove MCP server error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}); */

// GET /api/marketplace/mcp-servers/:employeeId — Disabled, focusing on Telegram bot
/* router.get('/mcp-servers/:employeeId', authMiddleware, async (req, res) => {
  try {
    // Verify requesting user owns this employee (prevents cross-user data leak)
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data: allSkills } = await supabaseAdmin
      .from('employee_skills')
      .select('config, skills(credential_type)')
      .eq('employee_id', req.params.employeeId);

    const mcpSkill = (allSkills || []).find(s => s.skills?.credential_type === 'mcp_server_url');
    const servers = mcpSkill?.config?.servers || {};

    res.json({ servers });
  } catch (err) {
    logger.error('List MCP servers error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}); */

// GET /api/marketplace/installed/:employeeId — Get skills installed on an employee
router.get('/installed/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('employee_skills')
      .select('id, status, installed_at, skills(id, name, slug, description, icon, category)')
      .eq('employee_id', req.params.employeeId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ installed_skills: data || [] });
  } catch (err) {
    logger.error('List installed skills error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
