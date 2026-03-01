const fs = require('fs');
const path = require('path');
const https = require('https');

const CREDS_PATH = path.join(process.env.HOME || '/home/node', '.openclaw', 'workspace', 'twitter-tools', '.twitter-credentials.json');

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  } catch {
    console.error('ERROR: Twitter credentials not found. Please configure Twitter in the marketplace.');
    process.exit(1);
  }
}

function twitterApi(endpoint, method = 'GET', body = null) {
  const creds = loadCredentials();
  const url = new URL(endpoint, 'https://api.twitter.com');

  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${creds.bearer_token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url.toString(), options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 429) {
            console.error('ERROR: Twitter API rate limit reached. Please wait a few minutes and try again.');
            process.exit(1);
          }
          if (res.statusCode === 401) {
            console.error('ERROR: Invalid Twitter Bearer Token. Please reconfigure in the marketplace.');
            process.exit(1);
          }
          if (res.statusCode === 403) {
            console.error('ERROR: Access forbidden. This action may require a higher API tier (Basic $100/mo or Pro).');
            process.exit(1);
          }
          resolve(parsed);
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

module.exports = { loadCredentials, twitterApi, formatDate };
