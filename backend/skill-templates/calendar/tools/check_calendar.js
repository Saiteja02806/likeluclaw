#!/usr/bin/env node
/**
 * check_calendar.js — List upcoming calendar events.
 * Includes semantic interpretation: urgency, conflicts, and timing signals.
 *
 * Usage:
 *   node check_calendar.js [days] [--today]
 *
 * Examples:
 *   node check_calendar.js              # Next 7 days
 *   node check_calendar.js 3            # Next 3 days
 *   node check_calendar.js --today      # Today only
 *   node check_calendar.js 14           # Next 2 weeks
 */
const { apiCall, formatEventTime } = require('./calendar-helper');

/** Detect event urgency and timing signals */
function interpretEvent(event, allEvents, now) {
  const title = (event.summary || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  // Timing: how soon is this event?
  let timing = 'upcoming';
  const startMs = event.start?.dateTime ? new Date(event.start.dateTime).getTime() : null;
  if (startMs) {
    const hoursUntil = (startMs - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < 0) timing = 'in-progress';
    else if (hoursUntil <= 1) timing = 'imminent';
    else if (hoursUntil <= 2) timing = 'soon';
  }

  // Importance
  let importance = 'normal';
  if (/urgent|critical|mandatory|important|escalation/.test(text)) {
    importance = 'high';
  } else if (timing === 'imminent' || timing === 'in-progress') {
    importance = 'high';
  }

  // Conflict detection: overlaps with another event
  let conflict = false;
  if (startMs && event.end?.dateTime) {
    const endMs = new Date(event.end.dateTime).getTime();
    for (const other of allEvents) {
      if (other.id === event.id) continue;
      const otherStart = other.start?.dateTime ? new Date(other.start.dateTime).getTime() : null;
      const otherEnd = other.end?.dateTime ? new Date(other.end.dateTime).getTime() : null;
      if (otherStart && otherEnd && startMs < otherEnd && endMs > otherStart) {
        conflict = true;
        break;
      }
    }
  }

  // Requires action
  let requiresAction = false;
  if (/rsvp|confirm|prepare|bring|submit|review|deadline/.test(text)) {
    requiresAction = true;
  }
  // Check if user hasn't responded yet
  if (event.attendees) {
    const self = event.attendees.find((a) => a.self);
    if (self && self.responseStatus === 'needsAction') {
      requiresAction = true;
    }
  }

  return { timing, importance, conflict, requiresAction };
}

async function main() {
  const args = process.argv.slice(2);
  const todayOnly = args.includes('--today');
  const daysArg = args.find((a) => !a.startsWith('--'));
  const days = todayOnly ? 1 : Math.min(parseInt(daysArg, 10) || 7, 30);

  const now = new Date();
  const timeMin = now.toISOString();

  const future = new Date(now);
  future.setDate(future.getDate() + days);
  future.setHours(23, 59, 59, 999);
  const timeMax = future.toISOString();

  const endpoint = `calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=25`;

  const result = await apiCall('GET', endpoint);

  if (!result.items || result.items.length === 0) {
    console.log(todayOnly ? 'No events today.' : `No events in the next ${days} day(s).`);
    return;
  }

  const events = result.items;
  const label = todayOnly ? "Today's Events" : `Upcoming Events (next ${days} days)`;
  console.log(`=== ${label} (${events.length}) ===\n`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const { timing, importance, conflict, requiresAction } = interpretEvent(event, events, now);

    console.log(`--- Event ${i + 1} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`Title: ${event.summary || '(No title)'}`);
    console.log(`When: ${formatEventTime(event)}`);
    if (event.location) console.log(`Where: ${event.location}`);
    if (event.description) {
      const desc = event.description.length > 200
        ? event.description.substring(0, 200) + '...'
        : event.description;
      console.log(`Notes: ${desc}`);
    }
    if (event.attendees && event.attendees.length > 0) {
      const attendeeList = event.attendees
        .map((a) => `${a.displayName || a.email}${a.responseStatus === 'accepted' ? ' ✓' : ''}`)
        .join(', ');
      console.log(`Attendees: ${attendeeList}`);
    }
    if (event.hangoutLink) console.log(`Meet: ${event.hangoutLink}`);
    const status = event.status === 'cancelled' ? ' [CANCELLED]' : '';
    if (status) console.log(`Status:${status}`);
    console.log(`Timing: ${timing.toUpperCase()}`);
    console.log(`Importance: ${importance.toUpperCase()}`);
    if (conflict) console.log('CONFLICT: Overlaps with another event');
    if (requiresAction) console.log('Requires Action: YES');
    console.log('');
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
