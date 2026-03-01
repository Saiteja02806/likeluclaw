const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authorization' });
    }

    // Use singleton admin client for auth verification (no per-request client needed)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Auth failed', { error: error?.message });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = user;

    // Lazy per-user Supabase client — only created when a route actually needs it
    // This preserves RLS security while avoiding instantiation on every request
    let _userClient = null;
    Object.defineProperty(req, 'supabase', {
      get() {
        if (!_userClient) {
          _userClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
          );
        }
        return _userClient;
      },
      configurable: true,
    });

    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = authMiddleware;
