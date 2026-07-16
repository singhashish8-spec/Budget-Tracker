// Parses Indian bank / UPI transaction SMS into a transaction shape.
// Returns null when the message doesn't look like a debit/credit alert.

const AMOUNT_RE = /(?:rs|inr)\.?\s*([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT_RE = /\b(debited|debit|spent|paid|withdrawn|purchase|sent)\b/i;
const CREDIT_RE = /\b(credited|credit|received|deposited|refund)\b/i;

// Buy-now-pay-later / pay-later services. When one of these is detected we
// don't guess the type — we flag it so the user confirms (it might be a spend,
// a bill, or just a statement notice).
const BNPL_SERVICES = [
  { re: /\b(amazon\s*pay\s*later|axio|capital\s*float)\b/i, name: 'Amazon Pay Later (Axio)' },
  { re: /\bsimpl\b/i, name: 'Simpl' },
  { re: /\blazypay\b/i, name: 'LazyPay' },
  { re: /\bslice\b/i, name: 'Slice' },
  { re: /\buni\s*card|\buni\s*pay\b/i, name: 'Uni' },
  { re: /\bpostpe\b/i, name: 'PostPe' },
  { re: /\bkreditbee\b/i, name: 'KreditBee' },
  { re: /\bzestmoney\b/i, name: 'ZestMoney' },
  { re: /\bpaytm\s*postpaid\b/i, name: 'Paytm Postpaid' },
];

function detectBnpl(body) {
  for (const s of BNPL_SERVICES) if (s.re.test(body)) return s.name;
  return null;
}

// Stable key for the "ignore this message forever" list. Numbers (amounts,
// dates, ref ids) are collapsed to # so all similar messages share a
// signature — ignoring one silences that whole recurring template.
export function smsSignature(body) {
  return String(body || '')
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function extractMerchant(body) {
  // Ordered heuristics for common Indian bank/UPI SMS phrasings.
  const patterns = [
    /\bto VPA\s+([^\s.,]+)/i,
    /\bat\s+([A-Z0-9][A-Za-z0-9*&._-]+(?:\s+[A-Za-z0-9*&._-]+){0,2})/,
    /\bto\s+([A-Z0-9][A-Za-z0-9*&._@-]+(?:\s+[A-Za-z0-9*&._-]+){0,2})/,
    /\bby\s+([A-Z0-9][A-Za-z0-9*&._-]+(?:\s+[A-Za-z0-9*&._-]+){0,2})/,
    /\bfrom\s+([A-Za-z0-9][A-Za-z0-9*&._@-]+)/i,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m && m[1]) {
      let name = m[1].replace(/[.,]$/, '').trim();
      // Skip account-number fragments like "a/c" matches
      if (/^a\/?c$/i.test(name) || /^\*+\d+$/.test(name)) continue;
      if (name.length >= 2) return name.slice(0, 48);
    }
  }
  return null;
}

export function parseSms(body) {
  if (!body) return null;
  const amtMatch = body.match(AMOUNT_RE);
  if (!amtMatch) return null;
  const amount = Math.round(parseFloat(amtMatch[1].replace(/,/g, '')));
  if (!amount || amount <= 0) return null;

  const isCredit = CREDIT_RE.test(body);
  const isDebit = DEBIT_RE.test(body);
  if (!isCredit && !isDebit) return null; // has an amount but no txn verb (e.g. balance/OTP)
  // OTP messages sometimes contain "Rs" — guard against them.
  if (/\bOTP\b|one[-\s]?time password|do not share/i.test(body)) return null;

  const type = isCredit && !isDebit ? 'income' : 'expense';
  const bnpl = detectBnpl(body);
  const merchant = bnpl || extractMerchant(body) || (type === 'income' ? 'Credit' : 'Payment');
  // BNPL transactions are returned but flagged so the caller leaves them for
  // the user to confirm rather than auto-categorising.
  return { amount, type, merchant, bnpl: bnpl || null };
}

// Two SMS describe the SAME payment when they share amount+type and land
// within this window — e.g. your UPI app and your bank both text you for one
// transaction. Used to de-duplicate.
export const DEDUP_WINDOW_MS = 5 * 60 * 1000;
