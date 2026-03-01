#!/usr/bin/env node
/**
 * write_sheet.js — Write data to a Google Spreadsheet.
 *
 * Usage:
 *   node write_sheet.js "<spreadsheet_id>" "<range>" "<json_data>"
 *
 * Examples:
 *   node write_sheet.js "1BxiMVs..." "Sheet1!A1" '[["Name","Age"],["Alice","30"]]'
 *   node write_sheet.js "1BxiMVs..." "Sheet1!A1:B1" '[["Hello","World"]]'
 */
const { googleApiCall } = require('./google-api-helper');

async function main() {
  const spreadsheetId = process.argv[2];
  const range = process.argv[3];
  const jsonData = process.argv[4];

  if (!spreadsheetId || !range || !jsonData) {
    console.error('Usage: node write_sheet.js "<spreadsheet_id>" "<range>" \'<json_2d_array>\'');
    console.error('');
    console.error('Example:');
    console.error('  node write_sheet.js "abc123" "Sheet1!A1" \'[["Name","Age"],["Alice","30"]]\'');
    process.exit(1);
  }

  let values;
  try {
    values = JSON.parse(jsonData);
    if (!Array.isArray(values) || !Array.isArray(values[0])) {
      throw new Error('Data must be a 2D array');
    }
  } catch (e) {
    console.error('ERROR: Invalid JSON data. Must be a 2D array like [["a","b"],["c","d"]]');
    console.error('Parse error:', e.message);
    process.exit(1);
  }

  const encodedRange = encodeURIComponent(range);
  const result = await googleApiCall(
    'sheets.googleapis.com', 'PUT',
    `/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    { range, values }
  );

  console.log('Data written successfully!');
  console.log(`Range: ${result.updatedRange || range}`);
  console.log(`Rows updated: ${result.updatedRows || values.length}`);
  console.log(`Cells updated: ${result.updatedCells || 'N/A'}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
