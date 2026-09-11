const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const officialSheetJs = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

assert(
  html.includes(officialSheetJs),
  'index.html debe cargar SheetJS 0.20.3 desde el CDN oficial.'
);
assert(
  !/cdn\.jsdelivr\.net\/npm\/xlsx@?0?\.18\.5|cdn\.jsdelivr\.net\/npm\/xlsx\/dist/i.test(html),
  'index.html no debe cargar la versión antigua de XLSX desde jsDelivr.'
);
assert(
  !pkg.dependencies || !pkg.dependencies.xlsx,
  'package.json no debe reintroducir xlsx 0.18.5 desde npm.'
);

const xlsxPos = html.indexOf(officialSheetJs);
const appPos = html.indexOf('src/app-standalone.js');
assert(xlsxPos >= 0 && appPos > xlsxPos, 'SheetJS debe cargarse antes del runtime de la aplicación.');

console.log('releaseConfig.test.cjs: OK');
