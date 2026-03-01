const fs = require('fs');
const path = require('path');
const https = require('https');

const CREDS_PATH = path.join(process.env.HOME || '/home/node', '.openclaw', 'workspace', 'spotify-tools', '.spotify-credentials.json');

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  } catch {
    console.error('ERROR: Spotify credentials not found. Please configure Spotify in the marketplace.');
    process.exit(1);
  }
}

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getAccessToken(creds) {
  const auth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
  const body = 'grant_type=client_credentials';

  const result = await httpsRequest('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });

  if (result.status !== 200 || !result.data.access_token) {
    console.error('ERROR: Failed to get Spotify access token. Check your Client ID and Secret.');
    console.error(result.data);
    process.exit(1);
  }

  return result.data.access_token;
}

async function spotifyApi(endpoint, creds) {
  const token = await getAccessToken(creds);
  const url = new URL(endpoint, 'https://api.spotify.com');

  const result = await httpsRequest(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (result.status === 401) {
    console.error('ERROR: Spotify token expired or invalid credentials.');
    process.exit(1);
  }

  return result.data;
}

function formatDuration(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

module.exports = { loadCredentials, spotifyApi, formatDuration };
