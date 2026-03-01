const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client (respects RLS — use for user-scoped queries)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (bypasses RLS — use for provisioning, webhooks, admin tasks)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
