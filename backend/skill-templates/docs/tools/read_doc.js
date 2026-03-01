#!/usr/bin/env node
/**
 * read_doc.js — Read content from a Google Doc.
 *
 * Usage:
 *   node read_doc.js "<document_id>"
 *
 * Examples:
 *   node read_doc.js "1abc123..."
 */
const { googleApiCall } = require('./google-api-helper');

const MAX_BODY = 8000;

async function main() {
  const docId = process.argv[2];

  if (!docId) {
    console.error('Usage: node read_doc.js "<document_id>"');
    console.error('  Use list_docs.js to find document IDs.');
    process.exit(1);
  }

  const result = await googleApiCall(
    'docs.googleapis.com', 'GET',
    `/v1/documents/${docId}`
  );

  console.log(`=== ${result.title || 'Untitled Document'} ===\n`);

  // Extract plain text from document body
  let text = '';
  if (result.body?.content) {
    for (const element of result.body.content) {
      if (element.paragraph?.elements) {
        for (const el of element.paragraph.elements) {
          if (el.textRun?.content) {
            text += el.textRun.content;
          }
        }
      }
      if (element.table) {
        text += '[Table]\n';
      }
    }
  }

  if (!text.trim()) {
    console.log('(Empty document)');
    return;
  }

  if (text.length > MAX_BODY) {
    console.log(text.substring(0, MAX_BODY));
    console.log(`\n... (truncated, ${text.length - MAX_BODY} more characters)`);
  } else {
    console.log(text);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
