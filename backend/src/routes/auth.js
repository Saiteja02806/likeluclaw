const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// POST /api/auth/signup — Register new user
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || '' }
      }
    });

    if (error) {
      logger.warn('Signup failed', { email, error: error.message });
      return res.status(400).json({ error: error.message });
    }

    logger.info('User signed up', { email, userId: data.user?.id });

    res.status(201).json({
      message: 'Account created. Check your email for verification.',
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    });
  } catch (err) {
    logger.error('Signup error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login — Login and return session
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.warn('Login failed', { email, error: error.message });
      return res.status(401).json({ error: error.message });
    }

    logger.info('User logged in', { email, userId: data.user?.id });

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me — Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      logger.error('Profile fetch failed', { userId: req.user.id, error: error.message });
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Count user's employees
    const { count } = await req.supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    res.json({
      ...profile,
      api_key_encrypted: undefined, // Never send encrypted key to frontend
      has_api_key: !!profile.api_key_encrypted,
      employee_count: count || 0
    });
  } catch (err) {
    logger.error('Get profile error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/profile — Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { full_name } = req.body;

    const { data, error } = await req.supabase
      .from('profiles')
      .update({ full_name })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    logger.error('Update profile error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
