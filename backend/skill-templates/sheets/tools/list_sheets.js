#!/usr/bin/env node
/**
 * list_sheets.js — List recent Google Sheets files.
 *
 * Usage:
 *   node list_sheets.js [count]
 *
 * Examples:
 *   node list_sheets.js          # Last 10 spreadsheets
 *   node list_sheets.js 5        # Last 5 spreadsheets
 */
const { googleApiCall } = require('./google-api-helper');

async function main() {
  const count = Math.min(parseInt(process.argv[2], 10) || 10, 25);

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,owners,webViewLink)');
  const result = await googleApiCall(
    'www.googleapis.com', 'GET',
    `/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=${count}`
  );

  if (!result.files || result.files.length === 0) {
    console.log('No spreadsheets found.');
    return;
  }

  console.log(`=== Your Spreadsheets (${result.files.length}) ===\n`);
  for (let i = 0; i < result.files.length; i++) {
    const f = result.files[i];
    console.log(`--- Sheet ${i + 1} ---`);
    console.log(`ID: ${f.id}`);
    console.log(`Name: ${f.name}`);
    console.log(`Modified: ${new Date(f.modifiedTime).toLocaleString()}`);
    if (f.owners?.[0]) console.log(`Owner: ${f.owners[0].displayName || f.owners[0].emailAddress}`);
    if (f.webViewLink) console.log(`Link: ${f.webViewLink}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
