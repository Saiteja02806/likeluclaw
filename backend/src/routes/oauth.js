const express = require('express');
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../lib/encryption');
const logger = require('../config/logger');
const crypto = require('node:crypto');
const https = require('node:https');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://likelyclaw.com/api/oauth/google/callback';

const SCOPES_BY_SKILL = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  sheets: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
  ],
  docs: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.readonly'
  ],
  drive: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

// Map integration page slugs to OAuth skill slugs (only Gmail + Calendar use direct OAuth)
const INTEGRATION_TO_SKILL = {
  gmail: 'gmail',
  googlecalendar: 'calendar',
};

// In-memory state store for OAuth CSRF protection (short-lived)
const pendingOAuthStates = new Map();

// Clean up stale states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingOAuthStates) {
    if (now - data.created_at > 10 * 60 * 1000) {
      pendingOAuthStates.delete(state);
    }
  }
}, 10 * 60 * 1000);

// GET /api/oauth/google/start — Generate Google OAuth URL
router.get('/google/start', authMiddleware, async (req, res) => {
  try {
    const { employee_id, skill_slug } = req.query;

    if (!employee_id || !skill_slug) {
      return res.status(400).json({ error: 'employee_id and skill_slug are required' });
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ error: 'Google OAuth is not configured. Contact support.' });
    }

    // Verify employee belongs to user
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Resolve integration slug to skill slug (e.g. googlecalendar → calendar)
    const resolvedSlug = INTEGRATION_TO_SKILL[skill_slug] || skill_slug;
    const scopes = SCOPES_BY_SKILL[resolvedSlug];
    if (!scopes) {
      return res.status(400).json({ error: `No OAuth scopes defined for skill: ${skill_slug}` });
    }

    // Merge scopes from ALL installed Google skills for this employee
    // This prevents OAuth overwrite when user connects Gmail then Calendar (or vice versa)
    let allScopes = [...scopes];
    try {
      const { data: installedSkills } = await supabaseAdmin
        .from('employee_skills')
        .select('skills(slug)')
        .eq('employee_id', employee_id)
        .eq('status', 'active');
      if (installedSkills) {
        for (const es of installedSkills) {
          const otherSlug = es.skills?.slug;
          if (otherSlug && otherSlug !== resolvedSlug && SCOPES_BY_SKILL[otherSlug]) {
            allScopes.push(...SCOPES_BY_SKILL[otherSlug]);
          }
        }
      }
    } catch (mergeErr) {
      logger.warn('Failed to merge scopes from other skills', { error: mergeErr.message });
    }
    allScopes = [...new Set(allScopes)];

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    pendingOAuthStates.set(state, {
      user_id: req.user.id,
      employee_id,
      skill_slug: resolvedSlug,
      created_at: Date.now()
    });

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: allScopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    res.json({ auth_url: authUrl });
  } catch (err) {
    logger.error('OAuth start error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/oauth/google/callback — Handle Google OAuth redirect
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Determine frontend base URL for redirects
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? `https://${process.env.DOMAIN || 'likelyclaw.com'}`
      : 'http://localhost:5173';

    if (oauthError) {
      logger.warn('OAuth denied by user', { error: oauthError });
      return res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/oauth/callback?error=missing_params`);
    }

    // Validate state (CSRF protection)
    const stateData = pendingOAuthStates.get(state);
    if (!stateData) {
      return res.redirect(`${frontendUrl}/oauth/callback?error=invalid_state`);
    }
    pendingOAuthStates.delete(state);

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code);
    if (!tokenData) {
      return res.redirect(`${frontendUrl}/oauth/callback?error=token_exchange_failed`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Store encrypted tokens in DB
    const providerName = 'google';
    const { error: dbError } = await supabaseAdmin
      .from('oauth_tokens')
      .upsert({
        user_id: stateData.user_id,
        provider: providerName,
        access_token_encrypted: encrypt(access_token),
        refresh_token_encrypted: refresh_token ? encrypt(refresh_token) : null,
        token_expiry: tokenExpiry,
        scopes: Object.values(SCOPES_BY_SKILL).flat().filter((s, i, a) => a.indexOf(s) === i)
      }, {
        onConflict: 'user_id,provider'
      });

    if (dbError) {
      logger.error('Failed to store OAuth tokens', { error: dbError.message });
      return res.redirect(`${frontendUrl}/oauth/callback?error=db_error`);
    }

    // Update employee_skills status from pending_setup to active
    const { data: skillRow } = await supabaseAdmin
      .from('skills')
      .select('id')
      .eq('slug', stateData.skill_slug)
      .single();

    if (skillRow) {
      await supabaseAdmin
        .from('employee_skills')
        .update({ status: 'active' })
        .eq('employee_id', stateData.employee_id)
        .eq('skill_id', skillRow.id)
        .eq('status', 'pending_setup');
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: stateData.user_id,
      employee_id: stateData.employee_id,
      action: 'oauth.google_connected',
      details: { skill: stateData.skill_slug }
    });

    logger.info('Google OAuth completed', {
      userId: stateData.user_id,
      skill: stateData.skill_slug,
      employeeId: stateData.employee_id
    });

    // Redirect to integrations page so the polling picks up the connection
    const integrationSlug = stateData.skill_slug === 'calendar' ? 'googlecalendar' : stateData.skill_slug;
    res.redirect(`${frontendUrl}/integrations?connected=${integrationSlug}`);
  } catch (err) {
    logger.error('OAuth callback error', { error: err.message });
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? `https://${process.env.DOMAIN || 'likelyclaw.com'}`
      : 'http://localhost:5173';
    res.redirect(`${frontendUrl}/oauth/callback?error=server_error`);
  }
});

// GET /api/oauth/status — Check if OAuth is set up for a skill
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { provider } = req.query;
    if (!provider) {
      return res.status(400).json({ error: 'provider query param required' });
    }

    const { data } = await req.supabase
      .from('oauth_tokens')
      .select('id, provider, token_expiry, scopes')
      .eq('user_id', req.user.id)
      .eq('provider', provider)
      .single();

    res.json({
      connected: !!data,
      token_expiry: data?.token_expiry,
      scopes: data?.scopes
    });
  } catch (err) {
    logger.error('OAuth status error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Exchange authorization code for access and refresh tokens.
 */
function exchangeCodeForTokens(code) {
  return new Promise((resolve) => {
    const postData = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) {
            resolve(data);
          } else {
            logger.error('Google token exchange failed', { response: body });
            resolve(null);
          }
        } catch {
          logger.error('Google token exchange parse error', { body });
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('Google token exchange request error', { error: err.message });
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = router;
