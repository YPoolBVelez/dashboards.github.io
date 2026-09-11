'use strict';

const assert = require('node:assert/strict');
const logic = require('../src/import-assistant-logic.js');

(function importsEveryDataRowAfterTheChosenHeader() {
  const rows = [['NUMERO', 'FECHA', 'CLIENTE']];
  for (let i = 1; i <= 250; i += 1) rows.push([i, `2026-06-${String((i % 28) + 1).padStart(2, '0')}`, `Cliente ${i}`]);
  rows.push(['', '', '']); // fila completamente vacía: no debe convertirse en registro
  rows.push([251, '2026-07-01', 'Cliente 251']);

  const imported = logic.rowsFromHeader(rows, 0);
  assert.equal(imported.length, 251, 'debe importar todas las filas con datos hasta el final, incluso después de filas vacías');
  assert.deepEqual(imported[0], { NUMERO: 1, FECHA: '2026-06-02', CLIENTE: 'Cliente 1' });
  assert.deepEqual(imported.at(-1), { NUMERO: 251, FECHA: '2026-07-01', CLIENTE: 'Cliente 251' });
})();

(function doesNotLimitImportToPreviewSize() {
  const rows = [['ID', 'VALOR']];
  for (let i = 1; i <= 1500; i += 1) rows.push([i, i * 10]);
  const imported = logic.rowsFromHeader(rows, 0);
  assert.equal(imported.length, 1500, 'la importación no debe tener un límite de 8, 100 o 1000 filas');
})();

(function keepsAllColumnsWithHeaders() {
  const rows = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    Array.from({ length: 14 }, (_, index) => index + 1)
  ];
  const imported = logic.rowsFromHeader(rows, 0);
  assert.equal(Object.keys(imported[0]).length, 14, 'no debe existir el antiguo límite visual de 12 columnas en los datos importados');
  assert.equal(imported[0].N, 14);
})();

(function detectsTheRealHeaderCandidate() {
  const rows = [
    ['NUMERO', 'FECHA', 'RUT', 'CLIENTE', 'TIPO COTIZ.', 'CODIGO', 'CANTIDAD'],
    [1230, '2026-06-01', 78202307, 'TRANSPORTE LT SPA', 'ARRIENDO', 9080, 2],
    [1238, '2026-06-01', 76069910, 'SERCOING', 'ARRIENDO', 9080, 3]
  ];
  const candidates = logic.findHeaderCandidates(rows, 5);
  assert.equal(candidates[0].index, 0);
})();

console.log('importAssistant.test.cjs OK');
