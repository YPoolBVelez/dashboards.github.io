const assert = require('node:assert/strict');
const logic = require('../src/import-assistant-logic.js');

const rows = [
  ['Reporte de ventas', '', ''],
  ['', '', ''],
  ['Producto', 'Cantidad', 'Precio'],
  ['A', 2, 1000],
  ['B', 4, 2500]
];

const candidates = logic.findHeaderCandidates(rows);
assert.ok(candidates.length > 0);
assert.equal(candidates[0].index, 2);

const parsed = logic.rowsFromHeader(rows, 2);
assert.deepEqual(parsed, [
  { Producto: 'A', Cantidad: 2, Precio: 1000 },
  { Producto: 'B', Cantidad: 4, Precio: 2500 }
]);

const duplicated = [
  ['Nombre', 'Nombre', 'Monto'],
  ['A', 'B', 100]
];
assert.deepEqual(logic.rowsFromHeader(duplicated, 0), [
  { Nombre: 'A', 'Nombre (2)': 'B', Monto: 100 }
]);

console.log('importAssistant.test: OK');
