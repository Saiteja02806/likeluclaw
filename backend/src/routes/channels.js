const express = require('express');
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { encrypt } = require('../lib/encryption');
const logger = require('../config/logger');
const k8s = require('../lib/k8s-utils');

const router = express.Router();

// POST /api/connect/whatsapp/:employeeId — Initiate WhatsApp QR pairing
// Note: The actual QR relay happens via WebSocket (see ws-handler.js)
// This endpoint just validates the request and returns WebSocket URL
router.post('/whatsapp/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, name, status, port, whatsapp_connected, gateway_token')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (employee.status !== 'running') {
      return res.status(400).json({ error: `Employee is not running (status: ${employee.status})` });
    }

    if (employee.whatsapp_connected) {
      return res.status(400).json({ error: 'WhatsApp is already connected. Disconnect first to re-pair.' });
    }

    // Return WebSocket URL for the frontend to connect to
    const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    const host = process.env.NODE_ENV === 'production' ? (process.env.DOMAIN || 'likelyclaw.com') : `localhost:${process.env.PORT}`;

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: employee.id,
      action: 'whatsapp.pairing_initiated'
    });

    res.json({
      message: 'Connect to WebSocket to receive QR code',
      ws_url: `${wsProtocol}://${host}/ws/whatsapp/${employee.id}`,
      employee_id: employee.id,
      employee_name: employee.name
    });
  } catch (err) {
    logger.error('WhatsApp connect error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/connect/telegram/:employeeId — Connect Telegram bot token
router.post('/telegram/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Telegram bot token is required' });
    }

    // Validate token format: numbers:alphanumeric
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      return res.status(400).json({ error: 'Invalid Telegram bot token format. Expected: 123456:ABC-DEF...' });
    }

    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, name, status, port, user_id, gateway_token')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (employee.status !== 'running') {
      return res.status(400).json({ error: `Employee is not running (status: ${employee.status})` });
    }

    // Encrypt and store the token in DB (critical step)
    const encryptedToken = encrypt(token);

    await supabaseAdmin
      .from('employees')
      .update({
        telegram_token_encrypted: encryptedToken,
        telegram_connected: true
      })
      .eq('id', employee.id);

    // Delete any existing Telegram webhook (OpenClaw uses long polling)
    try {
      const https = require('https');
      await new Promise((resolve) => {
        https.get(`https://api.telegram.org/bot${token}/deleteWebhook`, resolve).on('error', resolve);
      });
    } catch (_) {}

    // Patch the K8s ConfigMap openclaw.json to add Telegram channel config, then restart pod
    k8s.patchAgentConfig(employee.user_id, (config) => {
      config.channels = config.channels || {};
      config.channels.telegram = {
        enabled: true,
        botToken: token,
        dmPolicy: 'open',
        allowFrom: ['*']
      };
      config.plugins = config.plugins || {};
      config.plugins.entries = config.plugins.entries || {};
      config.plugins.entries.telegram = { enabled: true };
      return config;
    }).catch(err => {
      logger.error('K8s patch for Telegram failed (token saved in DB)', {
        employeeId: employee.id, error: err.message
      });
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: employee.id,
      action: 'telegram.connected',
      details: { token_preview: token.slice(0, 6) + '...' }
    });

    logger.info('Telegram connected', { employeeId: employee.id });

    res.json({
      message: 'Telegram bot connected successfully',
      telegram_connected: true
    });
  } catch (err) {
    logger.error('Telegram connect error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/connect/whatsapp/:employeeId/disconnect — Disconnect WhatsApp
router.post('/whatsapp/:employeeId/disconnect', authMiddleware, async (req, res) => {
  try {
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, port')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update DB
    await supabaseAdmin
      .from('employees')
      .update({ whatsapp_connected: false })
      .eq('id', employee.id);

    // Restart pod so WhatsApp session is cleared (K8s ephemeral pod = clean state)
    k8s.restartAgentPod(employee.user_id).catch(err => {
      logger.warn('K8s restart after WhatsApp disconnect failed', { employeeId: employee.id, error: err.message });
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: employee.id,
      action: 'whatsapp.disconnected'
    });

    res.json({ message: 'WhatsApp disconnected' });
  } catch (err) {
    logger.error('WhatsApp disconnect error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/connect/telegram/:employeeId/disconnect — Disconnect Telegram
router.post('/telegram/:employeeId/disconnect', authMiddleware, async (req, res) => {
  try {
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id, user_id, port')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update DB
    await supabaseAdmin
      .from('employees')
      .update({ telegram_connected: false, telegram_token_encrypted: null })
      .eq('id', employee.id);

    // Patch K8s ConfigMap to disable Telegram channel, then restart pod
    k8s.patchAgentConfig(employee.user_id, (config) => {
      if (config.channels) config.channels.telegram = { enabled: false };
      if (config.plugins?.entries) config.plugins.entries.telegram = { enabled: false };
      return config;
    }).catch(err => {
      logger.warn('K8s patch for Telegram disconnect failed', { employeeId: employee.id, error: err.message });
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      employee_id: employee.id,
      action: 'telegram.disconnected'
    });

    res.json({ message: 'Telegram disconnected' });
  } catch (err) {
    logger.error('Telegram disconnect error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
