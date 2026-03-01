#!/usr/bin/env node
/**
 * search_events.js — Search Google Calendar events by text query.
 *
 * Usage:
 *   node search_events.js "<query>" [days]
 *
 * Examples:
 *   node search_events.js "meeting"
 *   node search_events.js "dentist" 30
 *   node search_events.js "team standup" 14
 */
const { apiCall, formatEventTime } = require('./calendar-helper');

async function main() {
  const query = process.argv[2];
  const days = Math.min(parseInt(process.argv[3], 10) || 30, 90);

  if (!query) {
    console.error('Usage: node search_events.js "<query>" [days]');
    console.error('');
    console.error('Examples:');
    console.error('  node search_events.js "meeting"');
    console.error('  node search_events.js "dentist" 30');
    process.exit(1);
  }

  const now = new Date();
  const timeMin = now.toISOString();
  const future = new Date(now);
  future.setDate(future.getDate() + days);
  const timeMax = future.toISOString();

  const endpoint = `calendars/primary/events?q=${encodeURIComponent(query)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=20`;

  const result = await apiCall('GET', endpoint);

  if (!result.items || result.items.length === 0) {
    console.log(`No events found matching "${query}" in the next ${days} days.`);
    return;
  }

  console.log(`=== Calendar Search: "${query}" (${result.items.length} results) ===\n`);

  for (let i = 0; i < result.items.length; i++) {
    const event = result.items[i];
    console.log(`--- Result ${i + 1} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`Title: ${event.summary || '(No title)'}`);
    console.log(`When: ${formatEventTime(event)}`);
    if (event.location) console.log(`Where: ${event.location}`);
    if (event.attendees && event.attendees.length > 0) {
      const names = event.attendees.map((a) => a.displayName || a.email).join(', ');
      console.log(`Attendees: ${names}`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
