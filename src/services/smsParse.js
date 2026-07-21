// Parses Indian bank / UPI transaction SMS into a transaction shape.
// Returns null when the message doesn't look like a debit/credit alert.

const AMOUNT_RE = /(?:rs|inr)\.?\s*([\d,]+(?:\.\d{1,2})?)/i;
// Full words plus the short forms Indian banks (e.g. AU) use: "Dr INR ..." for
// a debit and the "UPI/DR/..." reference token. Same for credit ("Cr", "/CR/").
const DEBIT_RE = /\b(debited|debit|spent|paid|withdrawn|purchase|sent)\b|\bdr\.?\s+(?:rs|inr)\b|\/dr\//i;
const CREDIT_RE = /\b(credited|credit|received|deposited|refund)\b|\bcr\.?\s+(?:rs|inr)\b|\/cr\//i;

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

// The bank/UPI reference number — a payment's unique id. Two messages carrying
// DIFFERENT refs are definitively different payments however alike they look,
// which is what stops two same-amount payments minutes apart being merged.
const REF_PATTERNS = [
  /UPI\/(?:CR|DR)\/(\w{6,})/i,
  // NEFT/IMPS salary & transfer credits: "Ref NEFT CR-HDFCN52026071502577343".
  /\b(?:NEFT|IMPS|RTGS)\s+(?:CR|DR)-(\w{6,})/i,
  /\bref(?:erence)?(?:\s*(?:no|id))?\.?[:\s#]\s*(\w{6,})/i,
];

// OTPs quote amounts but are never transactions.
const OTP_RE = /\bOTP\b|one[-\s]?time password|do not share/i;

export function extractRef(body) {
  const s = String(body || '');
  for (const re of REF_PATTERNS) {
    const m = s.match(re);
    if (m && m[1]) return m[1].toUpperCase();
  }
  return null;
}

// True when a message mentions money at all — used to surface the messages we
// could NOT interpret, instead of dropping them silently. OTPs are excluded
// because they quote amounts but are never transactions.
export function looksLikeMoney(body) {
  if (!body) return false;
  if (!AMOUNT_RE.test(body)) return false;
  if (OTP_RE.test(body)) return false;
  return true;
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

// The amount alone, for messages we couldn't classify as debit or credit but
// the user is telling us about ("this WAS an expense").
export function extractAmount(body) {
  const m = String(body || '').match(AMOUNT_RE);
  if (!m) return 0;
  const n = Math.round(parseFloat(m[1].replace(/,/g, '')));
  return n > 0 ? n : 0;
}

export function extractMerchant(body) {
  // Ordered heuristics for common Indian bank/UPI SMS phrasings.
  const patterns = [
    // AU / UPI reference format: "UPI/DR/233251988234/Amazon Pay Groceri" —
    // the payee name follows the numeric reference. Stops at a slash, " Bal",
    // or line end so trailing balance text isn't swallowed.
    /UPI\/(?:CR|DR)\/\w+\/([A-Za-z][A-Za-z0-9 .*&_-]+?)(?=\/|\s+Bal\b|[\r\n]|$)/i,
    // NEFT/IMPS credits put the sender after the reference: "Ref NEFT
    // CR-HDFCN52026071502577343 -HITEN SE. Bal INR ..." — without this a
    // salary credit falls back to the useless label "Credit".
    /\b(?:NEFT|IMPS|RTGS)\s+(?:CR|DR)-\S+\s+-\s*([A-Za-z][A-Za-z0-9 .&_-]+?)(?=\.|\s+Bal\b|[\r\n]|$)/i,
    /\bto VPA\s+([^\s.,]+)/i,
    /\bat\s+([A-Z0-9][A-Za-z0-9*&._-]+(?:\s+[A-Za-z0-9*&._-]+){0,2})/,
    /\bto\s+([A-Z0-9][A-Za-z0-9*&._@-]+(?:\s+[A-Za-z0-9*&._-]+){0,2})/,
    /\bby\s+([A-Z0-9][A-Za-z0-9*&._-]+(?:\s+[A-Za-z0-9*&._-]+){0,2})/,
    /\bfrom\s+([A-Za-z0-9][A-Za-z0-9*&._@-]+)/i,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m && m[1]) {
      let name = m[1].replace(/[.,\s]+$/, '').trim();
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
  if (OTP_RE.test(body)) return null;

  const type = isCredit && !isDebit ? 'income' : 'expense';
  const bnpl = detectBnpl(body);
  const merchant = bnpl || extractMerchant(body) || (type === 'income' ? 'Credit' : 'Payment');
  // BNPL transactions are returned but flagged so the caller leaves them for
  // the user to confirm rather than auto-categorising.
  return { amount, type, merchant, bnpl: bnpl || null, ref: extractRef(body) };
}

// Two SMS describe the SAME payment when they share amount+type and land
// within this window — e.g. your UPI app and your bank both text you for one
// transaction. Only used when neither message carries a reference number.
export const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function normMerchant(m) {
  return String(m || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Collapses the two texts one payment often generates (UPI app + bank) into a
// single transaction, keeping the earliest and recording what was folded in on
// `mergedFrom` so the UI can show it and offer to split it back out.
//
// Matching on amount+time alone was wrong: two genuine payments of the same
// amount minutes apart were silently merged into one. So the reference number
// decides whenever both messages carry one (different ref = different payment,
// always). Only when neither has a ref do we fall back to time proximity — and
// even then the payee has to match.
export function dedupeParsed(items) {
  const sorted = [...items].sort((a, b) => a.date - b.date);
  const kept = [];
  for (const it of sorted) {
    const dup = kept.find((k) => {
      if (k.type !== it.type || k.amount !== it.amount) return false;
      if (k.ref && it.ref) return k.ref === it.ref;
      if (Math.abs(k.date - it.date) > DEDUP_WINDOW_MS) return false;
      return normMerchant(k.merchant) === normMerchant(it.merchant);
    });
    if (dup) {
      if (!dup.mergedFrom) dup.mergedFrom = [];
      dup.mergedFrom.push({ rawSms: it.rawSms, address: it.address, date: it.date });
    } else {
      kept.push(it);
    }
  }
  return kept;
}
