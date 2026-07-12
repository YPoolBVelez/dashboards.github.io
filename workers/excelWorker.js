// Worker for processing Excel/CSV ArrayBuffer using SheetJS
// Uses importScripts to load XLSX in worker scope.
importScripts('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');

function normalizeHeader(value) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function cleanRows(rows) {
  var seen = Object.create(null), columns = [];
  Object.keys(rows[0] || {}).forEach(function (raw) {
    var base = normalizeHeader(raw);
    if (!base || /^__EMPTY(?:_\d+)?$/i.test(base) || /^EMPTY(?:\s+\d+)?$/i.test(base) || !rows.some(function (row) { return row[raw] != null && String(row[raw]).trim() !== ''; })) return;
    var name = base, suffix = 2;
    while (seen[name]) name = base + ' (' + suffix++ + ')';
    seen[name] = true; columns.push([raw, name]);
  });
  return rows.map(function (row) { var output = {}; columns.forEach(function (column) { output[column[1]] = row[column[0]] == null ? '' : row[column[0]]; }); return output; });
}

self.onmessage = function (e) {
  const msg = e.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'process') {
    try {
      const buffer = msg.buffer;
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        self.postMessage({ type: 'error', message: 'Workbook has no sheets' });
        return;
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = cleanRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      // Post result; transfer nothing since it's structured clone
      self.postMessage({ type: 'result', json });
    } catch (err) {
      self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
    }
  }
};
