const assert = require('node:assert/strict');
const utils = require('../src/chart-utils.js');

assert.equal(utils.parseLocaleNumber(61000), 61000);
assert.equal(utils.parseLocaleNumber('61.000'), 61000);
assert.equal(utils.parseLocaleNumber('61.000,50'), 61000.5);
assert.equal(utils.parseLocaleNumber('61,000.50'), 61000.5);
assert.equal(utils.parseLocaleNumber('$ 12.500'), 12500);
assert.equal(utils.parseLocaleNumber('12,5'), 12.5);
assert.equal(utils.parseLocaleNumber('texto'), null);
assert.equal(utils.inferNumeric(['1.000', '2.000', '3.000']), true);

const axes = utils.axisAssignments([
  { data: [6], measure: { name: 'NUMERO', operation: 'count', axis: 'auto', format: 'auto' } },
  { data: [6], measure: { name: 'CANTIDAD', operation: 'median', axis: 'auto', format: 'auto' } },
  { data: [61000], measure: { name: 'PRECIO', operation: 'sum', axis: 'auto', format: 'currency' } }
]);
assert.deepEqual(axes, [0, 0, 1]);

const filter = { values: [], matchNone: false };
utils.toggleFilterValue(filter, 'B', false, ['A','B','C']);
assert.deepEqual(filter.values, ['A','C']);
utils.toggleFilterValue(filter, 'B', true, ['A','B','C']);
assert.deepEqual(filter.values, []);
filter.matchNone = true;
utils.toggleFilterValue(filter, 'A', true, ['A','B','C']);
assert.equal(filter.matchNone, false);
assert.deepEqual(filter.values, ['A']);

console.log('chartUtils.test: OK');
