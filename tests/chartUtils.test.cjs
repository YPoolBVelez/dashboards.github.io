'use strict';

const assert = require('node:assert/strict');
const utils = require('../src/chart-utils.js');

assert.equal(utils.parseLocaleNumber('61.000'), 61000);
assert.equal(utils.parseLocaleNumber('1.234,56'), 1234.56);
assert.equal(utils.parseLocaleNumber('$ 9.500'), 9500);
assert.equal(utils.parseLocaleNumber('(1.250)'), -1250);
assert.equal(utils.parseLocaleNumber(''), null);

assert.equal(utils.inferNumeric(['1', '2', '3', '4']), true);
assert.equal(utils.inferNumeric(['A', 'B', 'C']), false);

const axes = utils.axisAssignments([
  { measure: { name: 'CANTIDAD', operation: 'count', axis: 'auto', format: 'auto' }, data: [6] },
  { measure: { name: 'PRECIO', operation: 'sum', axis: 'auto', format: 'currency' }, data: [61000] }
]);
assert.deepEqual(axes, [0, 1], 'conteos y moneda deben poder usar escalas separadas');

const filter = { values: [], matchNone: false };
utils.toggleFilterValue(filter, 'A', false, ['A', 'B', 'C']);
assert.deepEqual(filter.values.sort(), ['B', 'C']);
utils.toggleFilterValue(filter, 'A', true, ['A', 'B', 'C']);
assert.deepEqual(filter.values, [], 'seleccionar todo debe volver al estado Todos');

console.log('chartUtils.test.cjs OK');
