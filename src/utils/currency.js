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
