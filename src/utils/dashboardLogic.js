/** Shared, framework-free dashboard data helpers. */
export function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDataset(rows = []) {
  const sourceHeaders = Object.keys(rows[0] || {});
  const seen = new Set();
  const columns = sourceHeaders.reduce((result, raw) => {
    const base = normalizeHeader(raw);
    const hasData = rows.some(row => row[raw] != null && String(row[raw]).trim() !== '');
    if (!base || /^__EMPTY(?:_\d+)?$/i.test(base) || /^EMPTY(?:\s+\d+)?$/i.test(base) || !hasData) return result;
    let name = base;
    let suffix = 2;
    while (seen.has(name)) name = `${base} (${suffix++})`;
    seen.add(name);
    result.push([raw, name]);
    return result;
  }, []);
  return rows.map(row => Object.fromEntries(columns.map(([raw, name]) => [name, row[raw] ?? ''])));
}

export function normalizeFilter(filter = {}) {
  const field = typeof filter === 'string' ? filter : filter.field || filter.name;
  const values = Array.isArray(filter.values) ? filter.values.map(String) : filter.value != null && filter.value !== '' ? [String(filter.value)] : [];
  return { field, scope: filter.scope === 'global' ? 'global' : 'local', values };
}

/** Filters use AND across fields, and OR among selected values within one field. */
export function applyFilters(rows = [], globalFilters = [], localFilters = []) {
  const filters = [...globalFilters, ...localFilters].map(normalizeFilter).filter(f => f.field);
  return rows.filter(row => filters.every(filter => !filter.values.length || filter.values.some(value => String(value).trim() === String(row[filter.field] ?? '').trim())));
}

export function serializeLayout(visuals = []) {
  return visuals.map(({ id, x = 0, y = 0, w, width, h, height, title, type, chartType, filters = [], categories = [], values = [] }) => ({ id, x, y, width: w ?? width ?? 6, height: h ?? height ?? 5, title, chartType: chartType ?? type ?? 'bar', filters, categories, values }));
}
