#!/usr/bin/env node
/**
 * list_files.js — List recent Google Drive files.
 *
 * Usage:
 *   node list_files.js [count]
 *   node list_files.js [count] --type <sheets|docs|pdf|images|folders>
 *
 * Examples:
 *   node list_files.js              # Last 10 files
 *   node list_files.js 5            # Last 5 files
 *   node list_files.js 10 --type pdf
 */
const { googleApiCall } = require('./google-api-helper');

const MIME_FILTERS = {
  sheets: "mimeType='application/vnd.google-apps.spreadsheet'",
  docs: "mimeType='application/vnd.google-apps.document'",
  pdf: "mimeType='application/pdf'",
  images: "(mimeType contains 'image/')",
  folders: "mimeType='application/vnd.google-apps.folder'",
};

async function main() {
  const args = process.argv.slice(2);
  let typeFilter = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      typeFilter = args[++i].toLowerCase();
    } else {
      positional.push(args[i]);
    }
  }

  const count = Math.min(parseInt(positional[0], 10) || 10, 25);

  let query = 'trashed=false';
  if (typeFilter && MIME_FILTERS[typeFilter]) {
    query += ` and ${MIME_FILTERS[typeFilter]}`;
  }

  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,size,webViewLink)');
  const result = await googleApiCall(
    'www.googleapis.com', 'GET',
    `/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=${count}`
  );

  if (!result.files || result.files.length === 0) {
    console.log('No files found.');
    return;
  }

  const label = typeFilter ? `${typeFilter} files` : 'files';
  console.log(`=== Your Drive ${label} (${result.files.length}) ===\n`);

  for (let i = 0; i < result.files.length; i++) {
    const f = result.files[i];
    const typeLabel = getTypeLabel(f.mimeType);
    console.log(`--- File ${i + 1} ---`);
    console.log(`ID: ${f.id}`);
    console.log(`Name: ${f.name}`);
    console.log(`Type: ${typeLabel}`);
    console.log(`Modified: ${new Date(f.modifiedTime).toLocaleString()}`);
    if (f.size) console.log(`Size: ${formatSize(parseInt(f.size, 10))}`);
    if (f.webViewLink) console.log(`Link: ${f.webViewLink}`);
    console.log('');
  }
}

function getTypeLabel(mimeType) {
  if (!mimeType) return 'Unknown';
  if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
  if (mimeType.includes('document')) return 'Document';
  if (mimeType.includes('presentation')) return 'Presentation';
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image/')) return 'Image';
  if (mimeType.includes('video/')) return 'Video';
  return mimeType.split('/').pop();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
