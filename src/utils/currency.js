// Amounts are always stored in INR (paise-free integers). Display converts
// via these static rates — same caveat as the original design prototype:
// demo rates only, not live FX. Swap for a real FX API before shipping if
// multi-currency display needs to be accurate rather than illustrative.
export const RATES = { INR: 1, USD: 0.0116, EUR: 0.0107, GBP: 0.0091, AED: 0.0426 };
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

const formatters = {};
function formatterFor(code) {
  if (!formatters[code]) {
    formatters[code] = new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    });
  }
  return formatters[code];
}

let activeCurrency = 'INR';
export function setActiveCurrency(code) {
  if (RATES[code]) activeCurrency = code;
}

export function fmt(amountInInr) {
  const rate = RATES[activeCurrency] ?? 1;
  const converted = Math.round((amountInInr || 0) * rate);
  return formatterFor(activeCurrency).format(converted);
}

// Always renders the stored INR amount, ignoring the display-currency toggle.
// Exported reports (HTML/PDF/CSV) need to agree with each other on what a
// transaction was actually worth — the CSV always writes the raw stored INR
// value, so an HTML/PDF report built with fmt() instead would silently run
// every amount through RATES, which is explicitly a demo/illustrative rate,
// not live FX (see the note above). Baking that into a document a user might
// keep for their records would make the two exports of the same data disagree,
// and pass off a fabricated conversion as a real one.
export function fmtInr(amountInInr) {
  return formatterFor('INR').format(amountInInr || 0);
}
