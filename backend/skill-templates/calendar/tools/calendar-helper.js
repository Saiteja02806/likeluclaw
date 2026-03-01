/**
 * Google Calendar API Helper — shared utility for all Calendar tool scripts.
 * Handles credential loading, authenticated API calls, and token refresh.
 * Uses ONLY Node.js built-in modules (no npm dependencies).
 * Reuses the SAME Google OAuth credentials as Gmail (gmail-credentials.json).
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// Primary credentials path: config root (same file as Gmail — it's a Google OAuth token)
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
  if (!creds.refresh_token) {
    throw new Error('No refresh_token available. Please re-connect Google account.');
  }
  if (!creds.client_id || !creds.client_secret) {
    throw new Error('Missing client_id or client_secret in credentials. Token refresh not possible from agent — backend will refresh automatically.');
  }

  const params = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: 'refresh_token',
  });

  const res = await httpsRequest(
    {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params.toString()),
      },
    },
    params.toString()
  );

  if (res.statusCode !== 200) {
    throw new Error(`Token refresh failed (${res.statusCode}): ${res.body}`);
  }

  const data = JSON.parse(res.body);
  creds.access_token = data.access_token;

  // Write updated token back to credentials file
  const toWrite = { ...creds };
  delete toWrite._path;
  fs.writeFileSync(creds._path, JSON.stringify(toWrite, null, 2));

  return creds;
}

async function calendarApiRaw(method, endpoint, accessToken, body) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/${endpoint}`
  );
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  if (body) {
    const bodyStr = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    return httpsRequest(options, bodyStr);
  }
  return httpsRequest(options, null);
}

/**
 * Makes an authenticated Google Calendar API call with automatic token refresh on 401.
 */
async function apiCall(method, endpoint, body) {
  let creds = loadCredentials();
  let res = await calendarApiRaw(method, endpoint, creds.access_token, body);

  // Auto-refresh on 401 Unauthorized
  if (res.statusCode === 401 && creds.refresh_token) {
    try {
      creds = await refreshAccessToken(creds);
      res = await calendarApiRaw(method, endpoint, creds.access_token, body);
    } catch (refreshErr) {
      throw new Error(
        `Google token expired and refresh failed: ${refreshErr.message}`
      );
    }
  }

  if (res.statusCode >= 400) {
    let errMsg;
    try {
      const errBody = JSON.parse(res.body);
      errMsg = errBody.error?.message || res.body;
    } catch {
      errMsg = res.body;
    }
    throw new Error(`Calendar API error (${res.statusCode}): ${errMsg}`);
  }

  return JSON.parse(res.body);
}

/** Format an event's time for display */
function formatEventTime(event) {
  if (!event.start) return 'No time set';

  // All-day event
  if (event.start.date) {
    const start = event.start.date;
    const end = event.end?.date || start;
    if (start === end || !event.end?.date) return `All day: ${start}`;
    return `All day: ${start} to ${end}`;
  }

  // Timed event
  if (event.start.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    const tz = event.start.timeZone || '';

    const startStr = start.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    if (end) {
      const endStr = end.toLocaleString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      });
      return `${startStr} - ${endStr}${tz ? ' (' + tz + ')' : ''}`;
    }
    return `${startStr}${tz ? ' (' + tz + ')' : ''}`;
  }

  return 'Unknown time format';
}

module.exports = {
  apiCall,
  loadCredentials,
  formatEventTime,
};
