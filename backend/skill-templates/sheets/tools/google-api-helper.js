/**
 * Google API Helper — shared utility for Sheets, Docs, Drive tool scripts.
 * Reuses gmail-credentials.json (same Google OAuth token).
 * Handles credential loading, authenticated API calls, and token refresh.
 * Uses ONLY Node.js built-in modules (no npm dependencies).
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// Primary credentials path: config root (updated by backend token-refresh job)
const CREDS_PATH = path.resolve(__dirname, '..', '..', 'gmail-credentials.json');
// Fallback: workspace copy
const CREDS_PATH_ALT = path.resolve(__dirname, '..', 'gmail-credentials.json');

function loadCredentials() {
  let credsPath = CREDS_PATH;
  if (!fs.existsSync(credsPath)) {
    credsPath = CREDS_PATH_ALT;
  }
  if (!fs.existsSync(credsPath)) {
    throw new Error(
      'Google credentials not found. Please connect your Google account first via the dashboard.'
    );
  }
  const raw = fs.readFileSync(credsPath, 'utf8');
  const creds = JSON.parse(raw);
  if (!creds.access_token) {
    throw new Error('Google credentials file is missing access_token.');
  }
  creds._path = credsPath;
  return creds;
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timed out after 30 seconds'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function refreshAccessToken(creds) {
  if (!creds.refresh_token || !creds.client_id || !creds.client_secret) {
    throw new Error('Cannot refresh: missing refresh_token, client_id, or client_secret');
  }
  const postData = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: 'refresh_token',
  }).toString();

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
  }, postData);

  if (res.statusCode !== 200) {
    throw new Error(`Token refresh failed (${res.statusCode}): ${res.body}`);
  }
  const tokens = JSON.parse(res.body);
  creds.access_token = tokens.access_token;
  if (tokens.refresh_token) creds.refresh_token = tokens.refresh_token;

  // Save refreshed token
  const savePath = creds._path || CREDS_PATH;
  const toSave = { ...creds };
  delete toSave._path;
  fs.writeFileSync(savePath, JSON.stringify(toSave, null, 2));

  return creds;
}

/**
 * Make an authenticated Google API call with automatic token refresh on 401.
 * @param {string} hostname - e.g. 'sheets.googleapis.com'
 * @param {string} method - HTTP method
 * @param {string} apiPath - API path (e.g. '/v4/spreadsheets/...')
 * @param {object|null} body - Request body (will be JSON.stringified)
 */
async function googleApiCall(hostname, method, apiPath, body) {
  let creds = loadCredentials();

  async function doRequest(token) {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { Authorization: `Bearer ${token}` };
    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    return httpsRequest({ hostname, path: apiPath, method, headers }, bodyStr);
  }

  let res = await doRequest(creds.access_token);

  // Auto-refresh on 401
  if (res.statusCode === 401 && creds.refresh_token) {
    try {
      creds = await refreshAccessToken(creds);
      res = await doRequest(creds.access_token);
    } catch (refreshErr) {
      throw new Error(`Google token expired and refresh failed: ${refreshErr.message}`);
    }
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    let errMsg;
    try {
      const errBody = JSON.parse(res.body);
      errMsg = errBody.error?.message || res.body.substring(0, 200);
    } catch {
      errMsg = res.body.substring(0, 200);
    }
    throw new Error(`Google API error (${res.statusCode}): ${errMsg}`);
  }

  return JSON.parse(res.body);
}

module.exports = { loadCredentials, googleApiCall, refreshAccessToken };
