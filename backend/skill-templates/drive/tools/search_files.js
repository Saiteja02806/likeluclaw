#!/usr/bin/env node
/**
 * search_files.js — Search Google Drive files by name or content.
 *
 * Usage:
 *   node search_files.js "<query>" [count]
 *
 * Examples:
 *   node search_files.js "budget"
 *   node search_files.js "project proposal" 5
 */
const { googleApiCall } = require('./google-api-helper');

async function main() {
  const searchQuery = process.argv[2];
  const count = Math.min(parseInt(process.argv[3], 10) || 10, 25);

  if (!searchQuery) {
    console.error('Usage: node search_files.js "<query>" [count]');
    process.exit(1);
  }

  const query = encodeURIComponent(`name contains '${searchQuery}' and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,size,webViewLink)');
  const result = await googleApiCall(
    'www.googleapis.com', 'GET',
    `/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=${count}`
  );

  if (!result.files || result.files.length === 0) {
    console.log(`No files found matching "${searchQuery}".`);
    return;
  }

  console.log(`=== Search: "${searchQuery}" (${result.files.length} results) ===\n`);

  for (let i = 0; i < result.files.length; i++) {
    const f = result.files[i];
    const type = f.mimeType?.includes('folder') ? 'Folder' :
                 f.mimeType?.includes('spreadsheet') ? 'Sheet' :
                 f.mimeType?.includes('document') ? 'Doc' :
                 f.mimeType?.includes('presentation') ? 'Slides' :
                 f.mimeType?.includes('pdf') ? 'PDF' : 'File';
    console.log(`${i + 1}. [${type}] ${f.name}`);
    console.log(`   ID: ${f.id} | Modified: ${new Date(f.modifiedTime).toLocaleDateString()}`);
    if (f.webViewLink) console.log(`   Link: ${f.webViewLink}`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
