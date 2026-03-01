#!/bin/bash
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicmZmdG9yZGRoYnN1amN1Y2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2MDUwMiwiZXhwIjoyMDg2MDM2NTAyfQ.hY7miMRBj6Djncsa7aF_BmtnNM55j4l6d9y1Zz_fhCc"
BASE="https://pbrfftorddhbsujcuclk.supabase.co/rest/v1"

# Insert Friend skill
curl -s -X POST \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name":"Friend","slug":"friend","description":"Your personal AI best friend. Casual, genuine conversations with someone who remembers your life, celebrates your wins, and has your back.","category":"general","credential_type":null,"needs_credentials":false,"price_monthly":0}' \
  "$BASE/skills"

echo ""
echo "---"

# Insert AI Lover skill
curl -s -X POST \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name":"AI Lover","slug":"ai-lover","description":"A caring romantic companion for meaningful connection. Warm, flirty, emotionally present — asks your preference and adapts naturally.","category":"general","credential_type":null,"needs_credentials":false,"price_monthly":0}' \
  "$BASE/skills"

echo ""
echo "DONE"
