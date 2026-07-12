const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function normalizeHeader(value) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function cleanRows(rows) {
  const seen = new Set(); const columns = [];
  Object.keys(rows[0] || {}).forEach(raw => {
    const base = normalizeHeader(raw);
    if (!base || /^__EMPTY(?:_\d+)?$/i.test(base) || /^EMPTY(?:\s+\d+)?$/i.test(base) || !rows.some(row => row[raw] != null && String(row[raw]).trim() !== '')) return;
    let name = base; let suffix = 2;
    while (seen.has(name)) name = `${base} (${suffix++})`;
    seen.add(name); columns.push([raw, name]);
  });
  return rows.map(row => Object.fromEntries(columns.map(([raw, name]) => [name, row[raw] == null ? '' : row[raw]])));
}

const fileArg = process.argv[2] || 'Dashboards Mari.xlsx';
const filePath = path.resolve(__dirname, '..', fileArg);

try {
  if (!fs.existsSync(filePath)) {
    console.error('ERROR: file not found:', filePath);
    process.exit(2);
  }
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetNames = workbook.SheetNames || [];
  console.log('Sheets:', sheetNames.join(', '));
  if (sheetNames.length === 0) process.exit(0);
  const sheet = workbook.Sheets[sheetNames[0]];
  const json = cleanRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
  console.log('Rows:', json.length);
  if (json.length === 0) {
    console.log('No rows parsed from first sheet.');
    process.exit(0);
  }
  const headers = Object.keys(json[0]);
  console.log('Headers:', headers.join(' | '));
  console.log('Sample 10 rows:');
  console.log(JSON.stringify(json.slice(0, 10), null, 2));
  process.exit(0);
} catch (err) {
  console.error('Parse error:', err && err.stack ? err.stack : err);
  process.exit(1);
}
