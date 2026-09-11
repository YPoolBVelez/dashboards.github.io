'use strict';

const assert = require('node:assert/strict');
require('../src/import-assistant-logic.js');
const workbook = require('../src/import-workbook-logic.js');

(function selectsLargestTabularSheet() {
  const sheets = {
    'RESUMEN JUNIO': [
      ['CLIENTE', 'TOTAL'],
      ['A', 10],
      ['B', 20],
      ['C', 30]
    ],
    'DETALLE JUNIO': [
      ['NUMERO', 'FECHA', 'CLIENTE', 'VALOR'],
      ...Array.from({ length: 1500 }, (_, i) => [i + 1, `2026-06-${String((i % 28) + 1).padStart(2, '0')}`, `Cliente ${i + 1}`, (i + 1) * 100])
    ]
  };

  const analysis = workbook.analyzeWorkbook(sheets);
  assert.equal(analysis.best.name, 'DETALLE JUNIO');
  assert.equal(analysis.best.rowCount, 1500);
  assert.equal(analysis.best.columnCount, 4);
  assert.equal(analysis.best.headerIndex, 0);
})();

(function reportsEverySheetInsteadOfOnlyTheFirstOne() {
  const analysis = workbook.analyzeWorkbook({
    Resumen: [['A', 'B'], ['uno', 1]],
    Datos: [['ID', 'MONTO'], [1, 100], [2, 200], [3, 300]]
  });
  assert.equal(analysis.sheets.length, 2);
  assert.equal(workbook.byName(analysis, 'Resumen').rowCount, 1);
  assert.equal(workbook.byName(analysis, 'Datos').rowCount, 3);
})();

(function ignoresBlankRowsButContinuesAfterThem() {
  const result = workbook.analyzeSheet([
    ['ID', 'CLIENTE'],
    [1, 'A'],
    ['', ''],
    [2, 'B'],
    ['', ''],
    [3, 'C']
  ]);
  assert.equal(result.rowCount, 3);
  assert.equal(result.columnCount, 2);
})();

console.log('importWorkbook.test.cjs OK');
