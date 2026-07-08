export function parseFlexible(value) {
  // Robust numeric parser that handles currencies, thousand separators, and
  // both comma and dot decimals. Returns null for unparseable values.
  if (value == null || value === '') return null;
  let str = String(value).trim();
  // Remove currency symbols, letters and spaces (keep digits, comma, dot, minus)
  str = str.replace(/[^0-9,\.\-]/g, '');

  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  // Cases:
  // "1.234,56" -> thousands '.', decimal ','
  // "1,234.56" -> thousands ',', decimal '.'
  // "1234,56"  -> decimal ','
  // "1234.56"  -> decimal '.'
  if (commaCount > 0 && dotCount === 0) {
    // Only commas present -> treat comma as decimal separator
    str = str.replace(/\./g, '');
    str = str.replace(/,/g, '.');
  } else if (dotCount > 0 && commaCount === 0) {
    // Only dots present -> assume dot is decimal, remove commas if any
    str = str.replace(/,/g, '');
  } else if (dotCount > 0 && commaCount > 0) {
    // Both present: assume the last symbol is the decimal separator
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      // dot appears after comma -> dot is decimal
      str = str.replace(/,/g, '');
    } else {
      // comma is decimal
      str = str.replace(/\./g, '');
      str = str.replace(/,/g, '.');
    }
  } else {
    // No separators -> nothing to do
  }

  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}
