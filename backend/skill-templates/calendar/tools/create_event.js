#!/usr/bin/env node
/**
 * create_event.js — Create a Google Calendar event.
 *
 * Usage:
 *   node create_event.js "<title>" "<start>" "<end>" [--location "<loc>"] [--desc "<description>"]
 *
 * Date formats:
 *   Timed:   "2026-02-15T14:00:00"  (local time, ISO format)
 *   All-day: "2026-02-15"           (date only)
 *
 * Examples:
 *   node create_event.js "Team Meeting" "2026-02-15T14:00:00" "2026-02-15T15:00:00"
 *   node create_event.js "Team Meeting" "2026-02-15T14:00:00" "2026-02-15T15:00:00" --location "Room 3"
 *   node create_event.js "Vacation" "2026-02-20" "2026-02-22"
 *   node create_event.js "Lunch" "2026-02-15T12:00:00" "2026-02-15T13:00:00" --desc "With client"
 */
const { apiCall } = require('./calendar-helper');

async function main() {
  const args = process.argv.slice(2);

  // Parse named flags
  let location = null;
  let description = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--location' && args[i + 1]) {
      location = args[++i];
    } else if (args[i] === '--desc' && args[i + 1]) {
      description = args[++i];
    } else {
      positional.push(args[i]);
    }
  }

  const title = positional[0];
  const startStr = positional[1];
  const endStr = positional[2];

  if (!title || !startStr || !endStr) {
    console.error('Usage: node create_event.js "<title>" "<start>" "<end>" [--location "<loc>"] [--desc "<desc>"]');
    console.error('');
    console.error('Examples:');
    console.error('  node create_event.js "Meeting" "2026-02-15T14:00:00" "2026-02-15T15:00:00"');
    console.error('  node create_event.js "Vacation" "2026-02-20" "2026-02-22"');
    process.exit(1);
  }

  // Normalize datetime: add :00 seconds if missing (e.g. "2026-02-15T14:00" → "2026-02-15T14:00:00")
  function normalizeDT(s) {
    if (s.includes('T') && s.split('T')[1].split(':').length === 2) {
      return s + ':00';
    }
    return s;
  }

  const nStart = normalizeDT(startStr);
  const nEnd = normalizeDT(endStr);

  // Detect all-day vs timed event
  const isAllDay = !startStr.includes('T');

  const event = {
    summary: title,
  };

  if (isAllDay) {
    event.start = { date: nStart };
    event.end = { date: nEnd };
  } else {
    // Default to Asia/Kolkata — container runs UTC but user is in IST
    const tz = 'Asia/Kolkata';
    event.start = { dateTime: nStart, timeZone: tz };
    event.end = { dateTime: nEnd, timeZone: tz };
  }

  if (location) event.location = location;
  if (description) event.description = description;

  const result = await apiCall('POST', 'calendars/primary/events', event);

  console.log('Event created successfully!');
  console.log(`Title: ${result.summary}`);
  console.log(`ID: ${result.id}`);
  if (result.start?.dateTime) {
    const start = new Date(result.start.dateTime);
    console.log(`Start: ${start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`);
  } else if (result.start?.date) {
    console.log(`Start: ${result.start.date} (all day)`);
  }
  if (result.htmlLink) console.log(`Link: ${result.htmlLink}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
