#!/usr/bin/env node
/**
 * send_email.js — Send an email via Gmail API.
 *
 * Usage:
 *   node send_email.js "<to>" "<subject>" "<body>"
 *
 * Example:
 *   node send_email.js "user@example.com" "Meeting Tomorrow" "Hi, confirming our 3pm meeting."
 */
const { apiCall } = require('./gmail-helper');

async function main() {
  const to = process.argv[2];
  const subject = process.argv[3];
  const body = process.argv.slice(4).join(' ');

  if (!to || !subject) {
    console.error('Usage: node send_email.js "<to>" "<subject>" "<body>"');
    console.error('');
    console.error('Example:');
    console.error(
      '  node send_email.js "user@example.com" "Hello" "This is the email body."'
    );
    process.exit(1);
  }

  // Compose RFC 2822 email
  const rawEmail = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body || '',
  ].join('\r\n');

  // Base64url encode
  const encoded = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await apiCall('POST', 'messages/send', { raw: encoded });

  console.log('Email sent successfully!');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message ID: ${result.id}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
