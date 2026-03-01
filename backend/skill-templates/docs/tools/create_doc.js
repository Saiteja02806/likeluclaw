#!/usr/bin/env node
/**
 * create_doc.js — Create a new Google Doc with content.
 *
 * Usage:
 *   node create_doc.js "<title>" [body_text]
 *
 * Examples:
 *   node create_doc.js "Meeting Notes"
 *   node create_doc.js "Meeting Notes" "Key points from today's meeting..."
 */
const { googleApiCall } = require('./google-api-helper');

async function main() {
  const title = process.argv[2];
  const bodyText = process.argv.slice(3).join(' ');

  if (!title) {
    console.error('Usage: node create_doc.js "<title>" [body_text]');
    process.exit(1);
  }

  // Create the document
  const doc = await googleApiCall(
    'docs.googleapis.com', 'POST',
    '/v1/documents',
    { title }
  );

  console.log('Document created successfully!');
  console.log(`Title: ${doc.title}`);
  console.log(`ID: ${doc.documentId}`);
  console.log(`Link: https://docs.google.com/document/d/${doc.documentId}/edit`);

  // Insert body text if provided
  if (bodyText) {
    await googleApiCall(
      'docs.googleapis.com', 'POST',
      `/v1/documents/${doc.documentId}:batchUpdate`,
      {
        requests: [{
          insertText: {
            location: { index: 1 },
            text: bodyText
          }
        }]
      }
    );
    console.log(`Content added: ${bodyText.length} characters`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
