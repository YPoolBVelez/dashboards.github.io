import { parseFlexible } from '../utils/parseFlexible.js';

export class DataService {
  constructor(store) {
    this.store = store;
  }

  // Load file using FileReader and SheetJS. Returns a Promise with cleaned rows.
  loadFile(file) {
    const WORKER_THRESHOLD = 2 * 1024 * 1024; // 2 MB
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));
      console.debug('[DataService] loadFile start', { name: file.name, size: file.size });

      // If file is large and browser supports Worker, delegate parsing to worker
      if (file.size > WORKER_THRESHOLD && typeof Worker !== 'undefined') {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.onload = (e) => {
          try {
            const buffer = e.target.result;
            // Create worker from Blob to avoid path/CORS issues when opening via file://
            const workerCode = `importScripts('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');
            self.onmessage = function(e) {
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
                  self.postMessage({ type: 'result', json });
                } catch (err) {
                  self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
                }
              }
            };
            `;
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);
            const timeout = setTimeout(() => {
              worker.terminate();
              reject(new Error('Worker timeout while processing file'));
            }, 30 * 1000);

            worker.onmessage = (ev) => {
              const msg = ev.data;
              if (msg.type === 'result') {
                clearTimeout(timeout);
                const json = msg.json || [];
                const sheetName = msg.sheetName || (msg.sheetNames && msg.sheetNames[0]) || 'Sheet1';
                const cleaned = json.map(row => {
                  const out = {};
                  Object.keys(row).forEach(k => {
                    out[k] = (row[k] === null || row[k] === undefined) ? '' : row[k];
                  });
                  return out;
                });
                if (!cleaned || cleaned.length === 0) {
                  console.warn('[DataService] no rows found after worker parsing');
                  this.store.setState({ raw: [], parsedMeta: { sheetName, rowCount: 0 } });
                  worker.terminate();
                  return reject(new Error('No rows found in sheet'));
                }
                this.store.setState({ raw: cleaned, parsedMeta: { sheetName, rowCount: cleaned.length } });
                worker.terminate();
                resolve(cleaned);
              } else if (msg.type === 'error') {
                clearTimeout(timeout);
                worker.terminate();
                reject(new Error(msg.message || 'Worker error'));
              }
            };

            // Post buffer (transfer if supported)
            try {
              worker.postMessage({ type: 'process', buffer }, [buffer]);
            } catch (err) {
              // Fall back without transfer
              worker.postMessage({ type: 'process', buffer });
            }
            // Revoke object URL after worker created
            URL.revokeObjectURL(workerUrl);
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      // Fallback: parse on main thread for small files or when Worker not supported
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            console.error('[DataService] workbook has no sheets', workbook);
            throw new Error('Workbook has no sheets');
          }
          const sheetName = workbook.SheetNames[0];
          console.debug('[DataService] workbook sheets:', workbook.SheetNames);
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          console.debug('[DataService] parsed rows (main thread):', json.length);
          const cleaned = json.map(row => {
            const out = {};
            Object.keys(row).forEach(k => {
              // trim strings, keep raw otherwise
              out[k] = (row[k] === null || row[k] === undefined) ? '' : row[k];
            });
            return out;
          });
          if (!cleaned || cleaned.length === 0) {
            console.warn('[DataService] no rows found after parsing');
            // still set raw to empty array for downstream checks
            this.store.setState({ raw: [], parsedMeta: { sheetName: sheetName || 'Sheet1', rowCount: 0 } });
            return reject(new Error('No rows found in sheet'));
          }
          this.store.setState({ raw: cleaned, parsedMeta: { sheetName: sheetName, rowCount: cleaned.length } });
          resolve(cleaned);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Aggregate rows by xKey and sum valueKey (using parseFlexible)
  aggregate(rows, xKey, valueKey) {
    const grouped = new Map();
    let total = 0;
    for (const row of rows) {
      const x = (row[xKey] === null || row[xKey] === undefined || row[xKey] === '') ? 'N/A' : String(row[xKey]);
      const rawVal = row[valueKey];
      const v = parseFlexible(rawVal) ?? 0;
      grouped.set(x, (grouped.get(x) || 0) + v);
      total += v;
    }
    return { labels: Array.from(grouped.keys()), data: Array.from(grouped.values()), total };
  }
}
