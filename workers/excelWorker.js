// Worker for processing Excel/CSV ArrayBuffer using SheetJS
// Uses importScripts to load XLSX in worker scope.
importScripts('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');

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
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // Post result; transfer nothing since it's structured clone
      self.postMessage({ type: 'result', json });
    } catch (err) {
      self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
    }
  }
};
