// Shared CSV-cell formatting for every "export my transactions" path
// (exportReport.js's plain CSV export, zipExport.js's bundled CSV). Kept in
// one place after the formula-injection guard's negative-number bug shipped
// independently in both files at once, since each had its own copy of the
// same logic — see docs/history/findings.md. Zero imports on purpose, so
// this stays trivially testable under plain `node --test`.

// CSV formula/injection guard (CWE-1236): a merchant or date string that
// originates from attacker-influenceable content (bank SMS text, a CSV
// import) could start with =, +, -, or @ and get interpreted as a live
// formula when the exported file is opened in Excel/Sheets — quoting the
// cell alone does NOT stop this. Prefixing with a literal `'` neutralizes it.
export function csvCell(value) {
  let v = String(value ?? '');
  if (/^[\s﻿\xA0]*[=+\-@]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

// The amount column is always a number the app computed itself — never
// attacker-influenceable text — so it's written as a plain numeric literal,
// with no quoting and no formula-guard prefix. Running csvCell on this
// column used to turn every expense (always negative here) into a text
// cell, since a bare "-450" also starts with "-": a spreadsheet's own
// SUM()/AutoSum silently skips text cells, undercounting real spending to
// near zero when totalled.
export function csvNumber(n) {
  return String(n);
}

export function categoryLabel(categories, catId) {
  return categories.find((c) => c.id === catId)?.label ?? 'Uncategorised';
}

export const CSV_HEADER = ['Date', 'Merchant', 'Account', 'Category', 'Type', 'Amount (INR)'];

export function buildTransactionsCsv(txns, categories, bom = '﻿') {
  const header = CSV_HEADER.map(csvCell);
  const rows = [header];
  txns.forEach((t) => {
    rows.push([
      csvCell(t.date),
      csvCell(t.merchant),
      csvCell(t.account || ''),
      csvCell(categoryLabel(categories, t.cat)),
      csvCell(t.type),
      csvNumber(t.type === 'income' ? t.amount : -t.amount),
    ]);
  });
  return bom + rows.map((r) => r.join(',')).join('\n');
}
