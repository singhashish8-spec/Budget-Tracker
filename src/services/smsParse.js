// Parses Indian bank / UPI transaction SMS into a transaction shape.
// Returns null when the message doesn't look like a debit/credit alert.

const AMOUNT_RE = /(?:rs|inr)\.?\s*([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT_RE = /\b(debited|debit|spent|paid|withdrawn|purchase|sent)\b/i;
const CREDIT_RE = /\b(credited|credit|received|deposited|refund)\b/i;

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
  const merchant = extractMerchant(body) || (type === 'income' ? 'Credit' : 'Payment');
  return { amount, type, merchant };
}

// Two SMS describe the SAME payment when they share amount+type and land
// within this window — e.g. your UPI app and your bank both text you for one
// transaction. Used to de-duplicate.
export const DEDUP_WINDOW_MS = 5 * 60 * 1000;
