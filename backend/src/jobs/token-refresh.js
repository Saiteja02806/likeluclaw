const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../lib/encryption');
const logger = require('../config/logger');
const https = require('node:https');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const EXPIRY_BUFFER = 45 * 60 * 1000;    // Refresh tokens expiring within 45 min

/**
 * Refresh Google OAuth tokens that are about to expire.
 */
async function refreshExpiredTokens() {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return; // OAuth not configured — nothing to refresh
    }

    // Find tokens expiring within the buffer window
    const cutoff = new Date(Date.now() + EXPIRY_BUFFER).toISOString();

    const { data: tokens, error } = await supabaseAdmin
      .from('oauth_tokens')
      .select('id, user_id, provider, refresh_token_encrypted, token_expiry')
      .eq('provider', 'google')
      .lt('token_expiry', cutoff);

    if (error) {
      logger.error('Token refresh query failed', { error: error.message });
      return;
    }

    if (!tokens || tokens.length === 0) return;

    logger.info(`Refreshing ${tokens.length} expiring OAuth token(s)`);

    for (const token of tokens) {
      try {
        if (!token.refresh_token_encrypted) {
          logger.warn('No refresh token available, marking as error', { tokenId: token.id });
          await supabaseAdmin
            .from('oauth_tokens')
            .delete()
            .eq('id', token.id);
          continue;
        }

        const refreshToken = decrypt(token.refresh_token_encrypted);
        const newTokenData = await refreshGoogleToken(refreshToken);

        if (!newTokenData) {
          logger.error('Token refresh failed — user may have revoked access', { tokenId: token.id, userId: token.user_id });
          // Mark associated employee_skills as error
          await markSkillsAsError(token.user_id);
          // Delete the expired token
          await supabaseAdmin
            .from('oauth_tokens')
            .delete()
            .eq('id', token.id);
          continue;
        }

        const newExpiry = new Date(Date.now() + (newTokenData.expires_in || 3600) * 1000).toISOString();

        await supabaseAdmin
          .from('oauth_tokens')
          .update({
            access_token_encrypted: encrypt(newTokenData.access_token),
            token_expiry: newExpiry,
            // Google sometimes returns a new refresh token
            ...(newTokenData.refresh_token ? { refresh_token_encrypted: encrypt(newTokenData.refresh_token) } : {})
          })
          .eq('id', token.id);

        logger.info('Token refreshed successfully', { tokenId: token.id, newExpiry });
      } catch (tokenErr) {
        logger.error('Error refreshing individual token', { tokenId: token.id, error: tokenErr.message });
      }
    }
  } catch (err) {
    logger.error('Token refresh job error', { error: err.message });
  }
}

/**
 * Use refresh_token to get a new access_token from Google.
 */
function refreshGoogleToken(refreshToken) {
  return new Promise((resolve) => {
    const postData = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
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
            logger.error('Google token refresh failed', { response: body });
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('Google token refresh request error', { error: err.message });
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Mark all google_oauth skills as error for a user whose token was revoked.
 */
async function markSkillsAsError(userId) {
  try {
    // Find all employees for this user
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('user_id', userId);

    if (!employees) return;

    for (const emp of employees) {
      // Find skills that need google_oauth
      const { data: skills } = await supabaseAdmin
        .from('employee_skills')
        .select('id, skill_id, skills!inner(credential_type)')
        .eq('employee_id', emp.id)
        .eq('status', 'active');

      if (!skills) continue;

      for (const es of skills) {
        if (es.skills?.credential_type === 'google_oauth') {
          await supabaseAdmin
            .from('employee_skills')
            .update({ status: 'error' })
            .eq('id', es.id);
        }
      }
    }
  } catch (err) {
    logger.error('Failed to mark skills as error', { userId, error: err.message });
  }
}

/**
 * Start the token refresh interval.
 */
function startTokenRefreshJob() {
  logger.info('Token refresh job started', { intervalMs: REFRESH_INTERVAL });
  // Run immediately on startup
  refreshExpiredTokens();
  // Then run on interval
  return setInterval(refreshExpiredTokens, REFRESH_INTERVAL);
}

module.exports = { startTokenRefreshJob, refreshExpiredTokens };
