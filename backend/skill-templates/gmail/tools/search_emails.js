#!/usr/bin/env node
/**
 * search_emails.js — Search emails by Gmail query syntax.
 * Includes semantic interpretation: importance, type, and action signals.
 *
 * Usage:
 *   node search_emails.js "<query>" [count]
 *
 * Examples:
 *   node search_emails.js "from:john@example.com"
 *   node search_emails.js "subject:invoice" 10
 *   node search_emails.js "is:unread after:2026/02/01" 5
 *   node search_emails.js "has:attachment from:boss@company.com"
 */
const { apiCall, getHeader } = require('./gmail-helper');

/** Detect email importance based on subject, snippet, and sender */
function interpretEmail(from, subject, snippet, labels) {
  const text = `${subject} ${snippet}`.toLowerCase();
  const senderLower = from.toLowerCase();

  let type = 'message';
  if (/meeting|calendar|invite|rsvp|scheduled|appointment/.test(text)) type = 'event';
  else if (/invoice|payment|receipt|billing|subscription|charged/.test(text)) type = 'transaction';
  else if (/task|todo|assign|action item|deadline/.test(text)) type = 'task';
  else if (/newsletter|unsubscribe|digest|weekly|monthly/.test(text)) type = 'newsletter';

  let importance = 'normal';
  if (/urgent|asap|immediately|critical|emergency|action required|time.?sensitive/.test(text)) {
    importance = 'high';
  } else if (/no-?reply|noreply|notifications?@|marketing@|newsletter|unsubscribe/.test(senderLower)) {
    importance = 'low';
  }

  let requiresAction = false;
  if (/please review|approve|confirm|sign|accept|respond|reply needed|action required|rsvp/.test(text)) {
    requiresAction = true;
  }

  if (labels.includes('UNREAD') && requiresAction && importance === 'normal') {
    importance = 'high';
  }

  return { type, importance, requiresAction };
}

async function main() {
  const query = process.argv[2];
  const count = Math.min(parseInt(process.argv[3], 10) || 5, 20);

  if (!query) {
    console.error('Usage: node search_emails.js "<query>" [count]');
    console.error('');
    console.error('Query examples:');
    console.error('  "from:john@example.com"');
    console.error('  "subject:invoice"');
    console.error('  "is:unread after:2026/02/01"');
    console.error('  "has:attachment"');
    console.error('  "newer_than:7d"');
    process.exit(1);
  }

  const endpoint = `messages?q=${encodeURIComponent(query)}&maxResults=${count}`;
  const list = await apiCall('GET', endpoint);

  if (!list.messages || list.messages.length === 0) {
    console.log(`No emails found for query: "${query}"`);
    return;
  }

  console.log(
    `=== Search Results for "${query}" (${list.messages.length}) ===\n`
  );

  for (let i = 0; i < list.messages.length; i++) {
    const msg = await apiCall(
      'GET',
      `messages/${list.messages[i].id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    );
    const headers = msg.payload ? msg.payload.headers : [];
    const from = getHeader(headers, 'From');
    const subject = getHeader(headers, 'Subject');
    const snippet = msg.snippet || '';
    const msgLabels = msg.labelIds || [];

    const { type, importance, requiresAction } = interpretEmail(from, subject, snippet, msgLabels);

    console.log(`--- Result ${i + 1} ---`);
    console.log(`ID: ${msg.id}`);
    console.log(`From: ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Date: ${getHeader(headers, 'Date')}`);
    console.log(`Preview: ${snippet || '(empty)'}`);
    if (msgLabels.includes('UNREAD')) console.log('Status: UNREAD');
    console.log(`Importance: ${importance.toUpperCase()}`);
    console.log(`Type: ${type}`);
    if (requiresAction) console.log('Requires Action: YES');
    console.log('');
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
