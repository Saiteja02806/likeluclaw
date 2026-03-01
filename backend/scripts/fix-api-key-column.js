/**
 * One-time migration: ensure api_key_provider column exists in profiles table
 * Run: node scripts/fix-api-key-column.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Checking profiles table schema...');

  // Try selecting the column — if it errors, it doesn't exist
  const { data, error } = await supabase
    .from('profiles')
    .select('api_key_provider')
    .limit(1);

  if (error && error.message.includes('api_key_provider')) {
    console.log('Column api_key_provider missing — adding it now...');
    const { error: migErr } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_key_provider text DEFAULT 'openai';"
    });
    if (migErr) {
      console.log('RPC not available. Please run this SQL manually in Supabase SQL Editor:');
      console.log("  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_key_provider text DEFAULT 'openai';");
    } else {
      console.log('Column added successfully!');
    }
  } else if (error) {
    console.log('Unexpected error:', error.message);
  } else {
    console.log('Column api_key_provider already exists. No action needed.');
  }

  // Also verify api_key_encrypted column
  const { error: err2 } = await supabase
    .from('profiles')
    .select('api_key_encrypted')
    .limit(1);

  if (err2 && err2.message.includes('api_key_encrypted')) {
    console.log('Column api_key_encrypted also missing! Run this SQL:');
    console.log("  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_key_encrypted text;");
  } else {
    console.log('Column api_key_encrypted exists.');
  }

  console.log('\nDone. You can now save API keys from the dashboard.');
}

run().catch(console.error);
