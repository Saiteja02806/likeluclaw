#!/usr/bin/env node
/**
 * read_sheet.js — Read data from a Google Spreadsheet.
 *
 * Usage:
 *   node read_sheet.js "<spreadsheet_id>" [range]
 *
 * Examples:
 *   node read_sheet.js "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
 *   node read_sheet.js "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" "Sheet1!A1:D10"
 */
const { googleApiCall } = require('./google-api-helper');

async function main() {
  const spreadsheetId = process.argv[2];
  const range = process.argv[3] || 'Sheet1';

  if (!spreadsheetId) {
    console.error('Usage: node read_sheet.js "<spreadsheet_id>" [range]');
    console.error('  Use list_sheets.js to find spreadsheet IDs.');
    process.exit(1);
  }

  const encodedRange = encodeURIComponent(range);
  const result = await googleApiCall(
    'sheets.googleapis.com', 'GET',
    `/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`
  );

  if (!result.values || result.values.length === 0) {
    console.log(`No data found in range "${range}".`);
    return;
  }

  console.log(`=== ${result.range || range} (${result.values.length} rows) ===\n`);

  // Print as a simple table
  const maxCols = Math.min(Math.max(...result.values.map(r => r.length)), 10);
  const colWidths = Array(maxCols).fill(0);

  // Calculate column widths (cap at 30 chars)
  for (const row of result.values.slice(0, 50)) {
    for (let c = 0; c < maxCols; c++) {
      const val = String(row[c] || '');
      colWidths[c] = Math.min(Math.max(colWidths[c], val.length), 30);
    }
  }

  // Print rows (limit to 50 to avoid token explosion)
  const maxRows = Math.min(result.values.length, 50);
  for (let r = 0; r < maxRows; r++) {
    const row = result.values[r];
    const formatted = [];
    for (let c = 0; c < maxCols; c++) {
      const val = String(row[c] || '').substring(0, 30);
      formatted.push(val.padEnd(colWidths[c]));
    }
    console.log(formatted.join(' | '));
    if (r === 0) {
      console.log(colWidths.map(w => '-'.repeat(w)).join('-+-'));
    }
  }

  if (result.values.length > 50) {
    console.log(`\n... (${result.values.length - 50} more rows truncated)`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
