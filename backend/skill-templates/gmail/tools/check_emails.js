#!/usr/bin/env node
/**
 * check_emails.js — List recent emails with sender, subject, date, and preview.
 * Includes semantic interpretation: importance, type, and action signals.
 *
 * Usage:
 *   node check_emails.js [count] [--unread]
 *
 * Examples:
 *   node check_emails.js              # Last 5 emails
 *   node check_emails.js 10           # Last 10 emails
 *   node check_emails.js 5 --unread   # Last 5 unread emails
 */
const { apiCall, getHeader } = require('./gmail-helper');

/** Detect email importance based on subject, snippet, and sender */
function interpretEmail(from, subject, snippet, labels) {
  const text = `${subject} ${snippet}`.toLowerCase();
  const senderLower = from.toLowerCase();

  // Type detection
  let type = 'message';
  if (/meeting|calendar|invite|rsvp|scheduled|appointment/.test(text)) type = 'event';
  else if (/invoice|payment|receipt|billing|subscription|charged/.test(text)) type = 'transaction';
  else if (/task|todo|assign|action item|deadline/.test(text)) type = 'task';
  else if (/newsletter|unsubscribe|digest|weekly|monthly/.test(text)) type = 'newsletter';

  // Importance detection
  let importance = 'normal';
  if (/urgent|asap|immediately|critical|emergency|action required|time.?sensitive/.test(text)) {
    importance = 'high';
  } else if (/no-?reply|noreply|notifications?@|marketing@|newsletter|unsubscribe/.test(senderLower)) {
    importance = 'low';
  }

  // Requires action detection
  let requiresAction = false;
  if (/please review|approve|confirm|sign|accept|respond|reply needed|action required|rsvp/.test(text)) {
    requiresAction = true;
  }

  // Boost importance if unread + requires action
  if (labels.includes('UNREAD') && requiresAction && importance === 'normal') {
    importance = 'high';
  }

  return { type, importance, requiresAction };
}

async function main() {
  const args = process.argv.slice(2);
  const unreadOnly = args.includes('--unread');
  const countArg = args.find((a) => !a.startsWith('--'));
  const count = Math.min(parseInt(countArg, 10) || 5, 20);

  let endpoint = `messages?maxResults=${count}`;
  if (unreadOnly) endpoint += `&q=${encodeURIComponent('is:unread')}`;

  const list = await apiCall('GET', endpoint);

  if (!list.messages || list.messages.length === 0) {
    console.log(unreadOnly ? 'No unread emails found.' : 'No emails found.');
    return;
  }

  const label = unreadOnly ? 'Unread Emails' : 'Recent Emails';
  console.log(`=== ${label} (${list.messages.length}) ===\n`);

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

    console.log(`--- Email ${i + 1} ---`);
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
