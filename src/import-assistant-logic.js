/* Pure helpers shared by the browser import assistant and Node tests. */
(function (root) {
  'use strict';
  function cleanText(value) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
  function isEmpty(value) { return cleanText(value) === ''; }
  function isNumber(value) { if (typeof value === 'number') return Number.isFinite(value); var valueText = cleanText(value); return valueText !== '' && /^[-+]?\d{1,3}(?:[., ]\d{3})*(?:[.,]\d+)?$/.test(valueText); }
  function isDate(value) { return value instanceof Date || (typeof value === 'string' && /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(cleanText(value))); }
  function rowValues(row) { return Array.isArray(row) ? row : []; }
  function scoreHeaderRow(rows, index) {
    var row = rowValues(rows[index]), width = Math.max.apply(Math, [row.length].concat(rows.map(function (r) { return rowValues(r).length; }))), values = Array.from({ length: width }, function (_, column) { return row[column]; }), filled = values.filter(function (v) { return !isEmpty(v); }), strings = filled.filter(function (v) { return !isNumber(v) && !isDate(v); }).map(cleanText), unique = new Set(strings.map(function (v) { return v.toLocaleLowerCase(); })), maxLength = strings.reduce(function (max, value) { return Math.max(max, value.length); }, 0), averageLength = strings.length ? strings.reduce(function (sum, value) { return sum + value.length; }, 0) / strings.length : 0;
    var rejected = filled.length < 2 || strings.length < 2 || maxLength > 120 || averageLength > 64;
    var duplicateCount = strings.length - unique.size, below = rows.slice(index + 1, index + 11), dataRows = below.filter(function (candidate) { return rowValues(candidate).filter(function (v) { return !isEmpty(v); }).length >= Math.max(2, Math.min(filled.length, 2)); }).length;
    var typedBelow = below.reduce(function (total, candidate) { return total + rowValues(candidate).filter(function (v) { return !isEmpty(v); }).length; }, 0);
    var score = rejected ? -1000 : Math.round((filled.length * 12) + (strings.length * 8) + (dataRows * 5) + Math.min(20, typedBelow / 3) - ((width - filled.length) * 3) - (duplicateCount * 14) - Math.max(0, averageLength - 30));
    return { index: index, score: score, rejected: rejected, values: strings.slice(0, 6), stats: { filled: filled.length, text: strings.length, blanks: width - filled.length, maxLength: maxLength, duplicateCount: duplicateCount, continuity: dataRows } };
  }
  function findHeaderCandidates(rows, limit) { return rows.map(function (_, index) { return scoreHeaderRow(rows, index); }).filter(function (candidate) { return !candidate.rejected; }).sort(function (a, b) { return b.score - a.score || a.index - b.index; }).slice(0, limit || 8); }
  function uniqueName(name, used) { var base = cleanText(name), candidate = base, suffix = 2; while (used[candidate]) candidate = base + ' (' + suffix++ + ')'; used[candidate] = true; return candidate; }
  function rowsFromHeader(rows, headerIndex) {
    var header = rowValues(rows[headerIndex]), used = Object.create(null), columns = header.map(function (value, index) { var name = cleanText(value); if (!name || /^__EMPTY(?:_\d+)?$/i.test(name) || /^EMPTY(?:\s+\d+)?$/i.test(name)) return null; var hasData = rows.slice(headerIndex + 1).some(function (row) { return !isEmpty(rowValues(row)[index]); }); return hasData ? { index: index, name: uniqueName(name, used) } : null; }).filter(Boolean);
    return rows.slice(headerIndex + 1).filter(function (row) { return columns.some(function (column) { return !isEmpty(rowValues(row)[column.index]); }); }).map(function (row) { var result = {}; columns.forEach(function (column) { var value = rowValues(row)[column.index]; result[column.name] = value == null ? '' : value; }); return result; });
  }
  var api = { cleanText: cleanText, scoreHeaderRow: scoreHeaderRow, findHeaderCandidates: findHeaderCandidates, rowsFromHeader: rowsFromHeader };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ImportAssistantLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
