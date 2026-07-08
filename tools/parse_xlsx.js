const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

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
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
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
