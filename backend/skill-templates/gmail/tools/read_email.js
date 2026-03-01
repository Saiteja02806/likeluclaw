#!/usr/bin/env node
/**
 * read_email.js — Read a single email by message ID, with full decoded body.
 *
 * Usage:
 *   node read_email.js <message_id>
 *
 * Example:
 *   node read_email.js 18d5a3b2c1e4f5a6
 */
const { apiCall, getHeader, extractBody } = require('./gmail-helper');

async function main() {
  const messageId = process.argv[2];
  if (!messageId) {
    console.error('Usage: node read_email.js <message_id>');
    console.error('Get message IDs from: node check_emails.js');
    process.exit(1);
  }

  const msg = await apiCall('GET', `messages/${messageId}?format=full`);
  const headers = msg.payload ? msg.payload.headers : [];

  console.log(`From: ${getHeader(headers, 'From')}`);
  console.log(`To: ${getHeader(headers, 'To')}`);
  console.log(`Subject: ${getHeader(headers, 'Subject')}`);
  console.log(`Date: ${getHeader(headers, 'Date')}`);
  const cc = getHeader(headers, 'Cc');
  if (cc) console.log(`Cc: ${cc}`);
  const labels = msg.labelIds || [];
  if (labels.length) console.log(`Labels: ${labels.join(', ')}`);
  console.log('');
  console.log('--- Body ---');
  console.log('');

  const body = extractBody(msg.payload);
  // Truncate very long bodies to avoid overwhelming the agent context
  const MAX_BODY = 8000;
  if (body.length > MAX_BODY) {
    console.log(body.substring(0, MAX_BODY));
    console.log(`\n... [Truncated — full body is ${body.length} chars] ...`);
  } else {
    console.log(body);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
