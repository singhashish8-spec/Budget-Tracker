// MVP scope is INR-only (multi-currency display is one of the deferred
// blueprint features). Kept as its own module so swapping in live FX later
// doesn't touch every screen that formats an amount.
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function fmt(amount) {
  return INR.format(Math.round(amount || 0));
}
