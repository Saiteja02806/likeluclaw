#!/usr/bin/env node
/**
 * list_docs.js — List recent Google Docs files.
 *
 * Usage:
 *   node list_docs.js [count]
 *
 * Examples:
 *   node list_docs.js          # Last 10 documents
 *   node list_docs.js 5        # Last 5 documents
 */
const { googleApiCall } = require('./google-api-helper');

async function main() {
  const count = Math.min(parseInt(process.argv[2], 10) || 10, 25);

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,owners,webViewLink)');
  const result = await googleApiCall(
    'www.googleapis.com', 'GET',
    `/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=${count}`
  );

  if (!result.files || result.files.length === 0) {
    console.log('No documents found.');
    return;
  }

  console.log(`=== Your Documents (${result.files.length}) ===\n`);
  for (let i = 0; i < result.files.length; i++) {
    const f = result.files[i];
    console.log(`--- Doc ${i + 1} ---`);
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
