/* Utilidades puras para analizar hojas de un libro antes de importar. */
(function (root) {
  'use strict';

  var assistant = root.ImportAssistantLogic;
  if (!assistant && typeof require === 'function') assistant = require('./import-assistant-logic.js');

  function clean(value) {
    return assistant && assistant.cleanText ? assistant.cleanText(value) : String(value == null ? '' : value).trim();
  }

  function empty(value) { return clean(value) === ''; }
  function rowValues(row) { return Array.isArray(row) ? row : []; }

  function uniqueName(name, used) {
    var base = clean(name), candidate = base, suffix = 2;
    while (used[candidate]) candidate = base + ' (' + suffix++ + ')';
    used[candidate] = true;
    return candidate;
  }

  function analyzeSheet(rows) {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length || !assistant) return { headerIndex:null, rowCount:0, columnCount:0, columns:[], score:-Infinity, signature:'' };

    var candidates = assistant.findHeaderCandidates(rows, 8);
    var best = candidates[0];
    if (!best) return { headerIndex:null, rowCount:0, columnCount:0, columns:[], score:-Infinity, signature:'' };

    var header = rowValues(rows[best.index]);
    var width = Math.max.apply(Math, [header.length].concat(rows.slice(best.index + 1).map(function (row) { return rowValues(row).length; })));
    var hasData = Array.from({ length: width }, function () { return false; });

    for (var r = best.index + 1; r < rows.length; r += 1) {
      var current = rowValues(rows[r]);
      for (var c = 0; c < width; c += 1) {
        if (!hasData[c] && !empty(current[c])) hasData[c] = true;
      }
    }

    var used = Object.create(null), columns = [];
    for (var index = 0; index < width; index += 1) {
      var name = clean(header[index]);
      if (!name || /^__EMPTY(?:_\d+)?$/i.test(name) || /^EMPTY(?:\s+\d+)?$/i.test(name) || !hasData[index]) continue;
      columns.push({ index:index, name:uniqueName(name, used) });
    }

    var rowCount = 0;
    for (var rowIndex = best.index + 1; rowIndex < rows.length; rowIndex += 1) {
      var source = rowValues(rows[rowIndex]);
      if (columns.some(function (column) { return !empty(source[column.index]); })) rowCount += 1;
    }

    var signature = columns.map(function (column) { return clean(column.name).toLocaleLowerCase('es'); }).join('\u001f');
    return { headerIndex:best.index, rowCount:rowCount, columnCount:columns.length, columns:columns.map(function (column) { return column.name; }), score:best.score, signature:signature };
  }

  function analyzeWorkbook(sheets) {
    var stats = Object.keys(sheets || {}).map(function (name, order) {
      var result = analyzeSheet(sheets[name]);
      result.name = name;
      result.order = order;
      return result;
    });
    stats.sort(function (a, b) {
      return b.rowCount - a.rowCount || b.columnCount - a.columnCount || b.score - a.score || a.order - b.order;
    });
    return { sheets:stats, best:stats.find(function (item) { return item.rowCount > 0 && item.headerIndex != null; }) || stats[0] || null };
  }

  function byName(analysis, name) {
    return analysis && Array.isArray(analysis.sheets) ? analysis.sheets.find(function (item) { return item.name === name; }) || null : null;
  }

  var api = { analyzeSheet:analyzeSheet, analyzeWorkbook:analyzeWorkbook, byName:byName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ImportWorkbookLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
