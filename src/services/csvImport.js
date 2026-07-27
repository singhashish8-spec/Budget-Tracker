// Non-AI CSV import: a plain client-side parser + column mapping, so a bank
// statement can be imported without sending anything to a third party. The
// mapping the user picks is remembered per bank name (csv_bank_profiles) so
// re-importing the same bank's export later skips straight to the preview.

const DELIMITERS = [',', ';', '\t'];

// Detects the delimiter that splits the first non-empty line into the most
// (and a consistent number of) columns — handles the common , ; and tab
// exports without asking the user to pick one.
export function detectDelimiter(text) {
  const firstLine = (text.split(/\r?\n/).find((l) => l.trim().length > 0) || '');
  let best = ',';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

// A small hand-rolled CSV parser (quoted fields, escaped "" quotes, CRLF/LF)
// rather than pulling in a dependency for something this contained.
export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // ignored — the following \n closes the row
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank trailing rows a trailing newline produces.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Accepts DD/MM/YYYY, DD-MM-YYYY (Indian convention), YYYY-MM-DD, and 2-digit
// years, falling back to the JS Date parser for anything else (e.g. "12 Jun
// 2026"). Returns a timestamp, or null if nothing could be read.
export function parseDateFlexible(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) return new Date(2000 + +m[3], +m[2] - 1, +m[1]).getTime();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// Strips currency symbols/commas/whitespace, treats parenthesised numbers and
// a leading '-' as negative (the two common ways statements mark a debit).
export function parseAmount(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[₹$,\s]/g, '');
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

// Turns parsed CSV rows + a column mapping into the same shape UploadScreen's
// AI path produces, so both feed the existing ReviewImportScreen unchanged.
// mapping: { hasHeader, dateCol, merchantCol, typeMode: 'signed'|'debitCredit',
//            amountCol, debitCol, creditCol }
export function rowsToTransactions(rows, mapping, sourceLabel) {
  const start = mapping.hasHeader ? 1 : 0;
  const stamp = Date.now();
  const out = [];
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const occurredAt = parseDateFlexible(row[mapping.dateCol]);
    const merchant = String(row[mapping.merchantCol] ?? '').trim();
    if (!occurredAt || !merchant) continue;

    let amount = null;
    let type = null;
    if (mapping.typeMode === 'debitCredit') {
      const debit = parseAmount(row[mapping.debitCol]);
      const credit = parseAmount(row[mapping.creditCol]);
      if (credit) {
        amount = Math.abs(credit);
        type = 'income';
      } else if (debit) {
        amount = Math.abs(debit);
        type = 'expense';
      }
    } else {
      const raw = parseAmount(row[mapping.amountCol]);
      if (raw != null && raw !== 0) {
        amount = Math.abs(raw);
        type = raw < 0 ? 'expense' : 'income';
      }
    }
    if (!amount || !type) continue;

    out.push({
      id: `csv${stamp}-${i}`,
      merchant: merchant.slice(0, 64),
      account: sourceLabel ? `CSV · ${sourceLabel}` : 'CSV import',
      date: new Date(occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      occurredAt,
      amount,
      cat: null,
      type,
    });
  }
  return out;
}
