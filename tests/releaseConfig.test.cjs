'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.match(index, /https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.3\/package\/dist\/xlsx\.full\.min\.js/);
assert.doesNotMatch(index, /xlsx@0\.18\.5/);
assert.equal(Boolean(pkg.dependencies && pkg.dependencies.xlsx), false, 'xlsx antiguo no debe volver a package.json');

const sheetJsPosition = index.indexOf('xlsx-0.20.3');
const appPosition = index.indexOf('src/app-standalone.js');
const previewPosition = index.indexOf('src/import-full-sheet-preview.js');
assert.ok(sheetJsPosition >= 0 && sheetJsPosition < appPosition, 'SheetJS debe cargar antes del runtime');
assert.ok(appPosition >= 0 && appPosition < previewPosition, 'el módulo de vista previa debe cargar después del runtime que extiende');

assert.ok(fs.existsSync(path.join(root, 'src', 'import-full-sheet-preview.js')));
assert.ok(fs.existsSync(path.join(root, 'tests', 'importAssistant.test.cjs')));
assert.ok(fs.existsSync(path.join(root, 'tests', 'chartUtils.test.cjs')));

console.log('releaseConfig.test.cjs OK');
