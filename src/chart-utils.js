/* Utilidades puras para números, formatos, filtros y escalas del Dashboard Builder. */
(function (root) {
  'use strict';

  function parseLocaleNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value == null || value === '') return null;
    var raw = String(value).trim();
    if (!raw) return null;
    var negative = /^\(.*\)$/.test(raw);
    var s = raw.replace(/[()\s\u00a0$€£¥%A-Za-z]/g, '').replace(/[^0-9,.'+-]/g, '').replace(/'/g, '');
    if (!s || !/[0-9]/.test(s)) return null;
    var sign = negative ? -1 : 1;
    s = s.replace(/^\+/, '');
    if (s.charAt(0) === '-') { sign *= -1; s = s.slice(1); }

    var comma = s.lastIndexOf(',');
    var dot = s.lastIndexOf('.');
    if (comma !== -1 && dot !== -1) {
      var decimalSep = comma > dot ? ',' : '.';
      var thousandsSep = decimalSep === ',' ? '.' : ',';
      s = s.split(thousandsSep).join('');
      s = s.replace(decimalSep, '.');
    } else {
      var sep = comma !== -1 ? ',' : (dot !== -1 ? '.' : '');
      if (sep) {
        var parts = s.split(sep);
        if (parts.length > 2) {
          s = parts.join('');
        } else if (parts.length === 2) {
          var left = parts[0], right = parts[1];
          var looksThousands = right.length === 3 && left.length >= 1 && left.length <= 3 && /^\d+$/.test(left + right);
          s = looksThousands ? left + right : left + '.' + right;
        }
      }
    }
    var n = Number(s);
    return Number.isFinite(n) ? n * sign : null;
  }

  function isNumericValue(value) { return parseLocaleNumber(value) !== null; }

  function inferNumeric(values) {
    var sample = (values || []).filter(function (v) { return v !== '' && v != null; }).slice(0, 150);
    if (!sample.length) return false;
    return sample.filter(isNumericValue).length / sample.length >= 0.85;
  }

  function formatValue(value, format, decimals) {
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value == null ? '' : value);
    var d = Math.max(0, Math.min(6, Number(decimals) || 0));
    if (format === 'currency') return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
    if (format === 'percent') return new Intl.NumberFormat('es-CL', { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(n / 100);
    if (format === 'compact') return new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: Math.max(1, d) }).format(n);
    return new Intl.NumberFormat('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }

  function measureUnit(measure) {
    measure = measure || {};
    if (measure.format === 'currency') return 'currency';
    if (measure.format === 'percent') return 'percent';
    if (measure.operation === 'count' || measure.operation === 'distinct') return 'count';
    return 'field:' + String(measure.name || 'value').toLocaleLowerCase('es');
  }

  function magnitude(dataset) {
    return Math.max.apply(Math, (dataset && dataset.data || []).map(function (v) { return Math.abs(Number(v) || 0); }).concat([0]));
  }

  function axisAssignments(datasets) {
    datasets = datasets || [];
    if (datasets.length < 2) return datasets.map(function () { return 0; });
    var assignments = datasets.map(function (d) {
      var axis = d.measure && d.measure.axis;
      return axis === 'right' ? 1 : (axis === 'left' ? 0 : null);
    });
    var firstAuto = assignments.findIndex(function (v) { return v == null; });
    var primaryUnit = firstAuto >= 0 ? measureUnit(datasets[firstAuto].measure) : measureUnit(datasets[0].measure);
    var mags = datasets.map(magnitude);
    var nonZero = mags.filter(function (v) { return v > 0; });
    var smallest = nonZero.length ? Math.min.apply(Math, nonZero) : 0;
    var largest = nonZero.length ? Math.max.apply(Math, nonZero) : 0;
    var magnitudeSplit = smallest > 0 && largest / smallest >= 100;
    var threshold = magnitudeSplit ? Math.sqrt(smallest * largest) : Infinity;

    datasets.forEach(function (dataset, index) {
      if (assignments[index] != null) return;
      var unit = measureUnit(dataset.measure);
      var semanticSplit = unit !== primaryUnit && (unit === 'currency' || primaryUnit === 'currency' || unit === 'percent' || primaryUnit === 'percent' || unit === 'count' || primaryUnit === 'count');
      assignments[index] = semanticSplit || (magnitudeSplit && mags[index] >= threshold) ? 1 : 0;
    });
    return assignments;
  }

  function filterIsAll(filter) { return !filter || (!filter.matchNone && (!Array.isArray(filter.values) || filter.values.length === 0)); }

  function toggleFilterValue(filter, value, checked, universe) {
    filter.values = Array.isArray(filter.values) ? filter.values.slice() : [];
    filter.matchNone = !!filter.matchNone;
    var all = (universe || []).map(String);
    if (filter.matchNone) {
      filter.matchNone = false;
      filter.values = checked ? [String(value)] : [];
      return filter;
    }
    if (filter.values.length === 0) {
      if (checked) return filter;
      filter.values = all.filter(function (item) { return item !== String(value); });
      return filter;
    }
    if (checked && filter.values.indexOf(String(value)) === -1) filter.values.push(String(value));
    if (!checked) filter.values = filter.values.filter(function (item) { return item !== String(value); });
    if (filter.values.length === all.length) filter.values = [];
    return filter;
  }

  var api = {
    parseLocaleNumber: parseLocaleNumber,
    isNumericValue: isNumericValue,
    inferNumeric: inferNumeric,
    formatValue: formatValue,
    measureUnit: measureUnit,
    magnitude: magnitude,
    axisAssignments: axisAssignments,
    filterIsAll: filterIsAll,
    toggleFilterValue: toggleFilterValue
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DashboardChartUtils = api;
})(typeof window !== 'undefined' ? window : globalThis);
