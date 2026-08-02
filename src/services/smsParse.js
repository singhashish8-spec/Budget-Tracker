// Parses Indian bank / UPI / card / lender SMS into a transaction shape.
// Returns null when the message is not a completed money movement.
//
// ── The central idea ────────────────────────────────────────────────────────
// Indian banks send FOUR kinds of message that all quote a rupee amount, and
// only one of them is a transaction:
//
//   1. "Rs.450 debited ... at Swiggy"          ← a thing that HAPPENED  ✅
//   2. "Rs.5,000 will be debited on 05-Aug"    ← a thing that WILL happen  ❌
//   3. "EMI of Rs.5,000 is due on 05-Aug"      ← a reminder  ❌
//   4. "Get a pre-approved loan of Rs.5,00,000"← an advertisement  ❌
//
// The old parser only looked for a verb like "debited" anywhere in the text, so
// #2 and #3 were imported as real spending — an EMI reminder and the EMI itself
// both became transactions, double-counting the month. The rule now is:
//
//   A message is a transaction ONLY if it contains a completed money verb that
//   is not preceded by a future modal and not negated.
//
// "will be debited" contains "debited", so the check has to look at what comes
// immediately BEFORE each verb, not just whether the verb appears at all.

// ── Amounts ─────────────────────────────────────────────────────────────────
// Both orders occur in the wild: "Rs.1,234.00" / "INR 1,234" (prefix) and
// "1,234.00 INR" (suffix, common in card-network and some NBFC templates).
const AMOUNT_RE = /(?:rs|inr|₹)\.?\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs\b|inr\b|₹)/i;
const AMOUNT_G = new RegExp(AMOUNT_RE.source, 'gi');

// Words that mark the number after them as a BALANCE, not the transaction
// amount. "Avl Bal Rs.12,345" must never be imported as a ₹12,345 spend — a
// real and very visible failure, since balances are large.
const BALANCE_CTX = /\b(bal|bals|balance|avl|avbl|available|limit|outstanding|o\/s|remaining|as\s+on)\b[^.;]*$/i;

// ── Completed vs. intended money movement ───────────────────────────────────
// Past/complete verbs only. "spend" and "pay" (imperative, in ads and
// reminders) are deliberately absent — only "spent" and "paid" count.
// "debit of Rs.500" / "credit of Rs.500" are noun forms that still describe a
// completed movement. Matched with an explicit "of" so "your debit card" and
// "credit limit" — which describe an instrument, not an event — never qualify.
const DEBIT_VERBS = /\b(debited|deducted|charged|spent|paid|withdrawn|purchased|transferred|sent)\b|\bdebit\s+of\b|\bdr\.?\s+(?:rs|inr)\b|\/dr\//gi;
const CREDIT_VERBS = /\b(credited|received|deposited|refunded|reversed|added)\b|\bcredit\s+of\b|\bcr\.?\s+(?:rs|inr)\b|\/cr\//gi;

// A modal immediately before a verb turns "happened" into "will happen".
// Checked against the ~24 characters preceding each verb match.
const FUTURE_MODAL = /\b(will|shall|would|going\s+to|about\s+to|may|might|can|could|to\s+be|due\s+to\s+be|is\s+to|are\s+to|shortly)\s*(?:be\s*)?$/i;
// Negation: "not debited", "could not be debited", "failed to debit".
const NEGATION = /\b(not|n't|never|failed\s+to|unable\s+to|couldn't|cannot)\s*(?:be\s*)?$/i;

// Whole-message disqualifiers, checked before anything else.
const OTP_RE = /\bOTP\b|one[-\s]?time\s*password|do\s*not\s*share|never\s*share|verification\s*code/i;
// A transaction that did not go through moves no money.
const FAILED_RE = /\b(fail(?:ed|ure)?|declin(?:ed|e)|unsuccessful|not\s+processed|could\s+not\s+be\s+processed|rejected|cancell?ed|timed\s*out)\b/i;
// UPI "collect" requests: someone is ASKING you for money. Nothing has moved.
const REQUEST_RE = /\b(has\s+requested|is\s+requesting|requesting\s+(?:you|payment)|collect\s+request|payment\s+request|requests?\s+(?:rs|inr|₹))\b/i;
// A mandate/autopay being SET UP is not a debit. (Its later execution is, and
// that message says "debited" without these words.)
// The gap is [\s\S] rather than [^.] because amounts contain dots
// ("Rs.2,499.00"), and a dot-excluding gap could never bridge the mandate word
// to its outcome word across one.
const MANDATE_SETUP_RE = /\b(e[-\s]?mandate|mandate|autopay|auto[-\s]?pay|standing\s+instruction)\b[\s\S]{0,80}?\b(registered|created|set\s*up|activated|approved|will\s+be\s+(?:executed|processed))\b/i;
// Pure reminders. Only used to reject when no completed verb survived.
const REMINDER_RE = /\b(due\s+(?:on|by|date)|is\s+due|are\s+due|amount\s+due|minimum\s+(?:amount\s+)?due|total\s+due|overdue|please\s+pay|kindly\s+pay|pay\s+(?:now|before|by|your)|last\s+date|payable|avoid\s+(?:late|penalty|charges)|grace\s+period|reminder|bill\s+generated|statement)\b/i;
// Advertising. "loan offer", "apply now", "you are eligible".
const PROMO_RE = /\b(pre[-\s]?approved|apply\s+now|you\s+are\s+eligible|eligible\s+for|offer\s+valid|limited\s+period|t&c\s*apply|terms\s+apply|click\s+(?:here|below)|unsubscribe|lowest\s+interest|instant\s+loan|upto\s+(?:rs|inr|₹)|hurry|book\s+now|shop\s+now)\b/i;

// ── Recurring / auto-debit classification ───────────────────────────────────
// The user's ask: when an EMI or a subscription auto-debits, the app should
// know what it was without being told. Each rule maps to one of the built-in
// category ids in db/schema.js (BUILTIN_CATEGORIES).
const RECURRING_RULES = [
  {
    kind: 'emi',
    cat: 'emi',
    re: /\b(emi|e\.m\.i|instal?lment|instalment|loan\s+(?:repayment|account|a\/c)|repayment|principal\s+(?:and|&)\s+interest|nach|ecs|loan\s+emi|auto\s*debit\s+for\s+loan)\b/i,
  },
  {
    kind: 'sip',
    cat: 'invest',
    re: /\b(sip|systematic\s+investment|mutual\s+fund|folio|nav\b|elss|nps\b|ppf\b|recurring\s+deposit|\brd\s+instal)/i,
  },
  {
    kind: 'subscription',
    cat: 'subscriptions',
    re: /\b(subscription|subscribed|auto[-\s]?renew(?:al|ed|s)?|renewed|recurring\s+payment|membership\s+(?:fee|renewed)|prime\s+membership|mandate\s+executed|autopay\s+(?:debit|executed))\b/i,
  },
  {
    // Well-known recurring merchants, so "NETFLIX" alone is enough even when
    // the bank's template says nothing about a subscription.
    kind: 'subscription',
    cat: 'subscriptions',
    re: /\b(netflix|hotstar|disney\+?|spotify|youtube\s*premium|amazon\s*prime|sony\s*liv|zee5|jiocinema|jiosaavn|gaana|apple\.com\/bill|apple\s*services|google\s*(?:one|storage|play\s*subscription)|icloud|adobe|microsoft\s*365|office\s*365|canva|chatgpt|openai|dropbox|audible|kindle\s*unlimited|swiggy\s*one|zomato\s*(?:gold|pro)|cult\.?fit)\b/i,
  },
];

// Buy-now-pay-later / pay-later services. Detected but never auto-typed: a
// BNPL text can be a spend, a bill, or a statement notice, so the user
// confirms. Unchanged from the original implementation.
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
  // UPI transaction id quoted on its own, as PhonePe/GPay templates do.
  /\bUPI\s*(?:txn|transaction)?\s*(?:id|ref)\s*[:\s#]\s*(\w{8,})/i,
];

export function extractRef(body) {
  const s = String(body || '');
  for (const re of REF_PATTERNS) {
    const m = s.match(re);
    if (m && m[1]) return m[1].toUpperCase();
  }
  return null;
}

// Every currency amount in the message, with the position it was found at and
// whether the words just before it mark it as a balance rather than an amount
// that moved.
function findAmounts(body) {
  const s = String(body || '');
  const out = [];
  AMOUNT_G.lastIndex = 0;
  let m;
  while ((m = AMOUNT_G.exec(s)) !== null) {
    const raw = m[1] || m[2];
    if (!raw) continue;
    const value = parseFloat(String(raw).replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) continue;
    const before = s.slice(Math.max(0, m.index - 30), m.index);
    out.push({ value, index: m.index, isBalance: BALANCE_CTX.test(before) });
  }
  return out;
}

// The amount that actually moved: the first one that isn't a balance. Falling
// back to the first of any kind keeps a message that only quotes a balance-ish
// number from returning nothing at all.
function pickAmount(body) {
  const all = findAmounts(body);
  if (!all.length) return null;
  const moved = all.find((a) => !a.isBalance);
  return moved || all[0];
}

// Positions of completed (not future, not negated) money verbs. Returns [] when
// every occurrence is "will be debited" / "not debited" style.
function completedVerbs(body, re) {
  const s = String(body || '');
  const out = [];
  const g = new RegExp(re.source, 'gi');
  let m;
  while ((m = g.exec(s)) !== null) {
    const before = s.slice(Math.max(0, m.index - 24), m.index);
    if (FUTURE_MODAL.test(before)) continue;
    if (NEGATION.test(before)) continue;
    out.push(m.index);
  }
  return out;
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
  const picked = pickAmount(body);
  if (!picked) return 0;
  const n = Math.round(picked.value);
  return n > 0 ? n : 0;
}

// Which recurring bucket (if any) a message belongs to.
export function detectRecurring(body) {
  const s = String(body || '');
  for (const rule of RECURRING_RULES) {
    if (rule.re.test(s)) return { kind: rule.kind, cat: rule.cat };
  }
  return null;
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
    // Bill/EMI phrasings: "paid towards Electricity Bill", "for Rent".
    /\btowards\s+([A-Za-z][A-Za-z0-9 .&_-]+?)(?=\.|\s+Bal\b|[\r\n]|$)/i,
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

// Why a message was NOT treated as a transaction. Exported for the "not
// recognised" screen and for tests — a rejection you can't explain is a
// rejection you can't debug.
export function rejectionReason(body) {
  const s = String(body || '');
  if (!s.trim()) return 'empty';
  if (OTP_RE.test(s)) return 'otp';
  if (!AMOUNT_RE.test(s)) return 'no-amount';
  if (REQUEST_RE.test(s)) return 'payment-request';
  if (FAILED_RE.test(s)) return 'failed';
  if (MANDATE_SETUP_RE.test(s)) return 'mandate-setup';

  const debits = completedVerbs(s, DEBIT_VERBS);
  const credits = completedVerbs(s, CREDIT_VERBS);
  if (!debits.length && !credits.length) {
    // Nothing completed. Name the most useful reason we can.
    if (REMINDER_RE.test(s)) return 'reminder';
    if (PROMO_RE.test(s)) return 'promotional';
    if (/\b(will|shall|would)\s+be\s+(?:debited|deducted|charged|credited)\b/i.test(s)) return 'scheduled';
    return 'no-transaction-verb';
  }
  return null; // it IS a transaction
}

export function parseSms(body) {
  if (!body) return null;
  const s = String(body);

  const reason = rejectionReason(s);
  if (reason) return null;

  const picked = pickAmount(s);
  if (!picked) return null;
  const amount = Math.round(picked.value);
  if (!amount || amount <= 0) return null;

  const debits = completedVerbs(s, DEBIT_VERBS);
  const credits = completedVerbs(s, CREDIT_VERBS);

  // When a message carries both directions ("credited to your card" on a card
  // bill payment, "debited ... refund credited"), the verb sitting CLOSEST to
  // the amount that moved is the one describing it.
  let type;
  if (debits.length && !credits.length) type = 'expense';
  else if (credits.length && !debits.length) type = 'income';
  else {
    const nearest = (arr) => Math.min(...arr.map((i) => Math.abs(i - picked.index)));
    type = nearest(debits) <= nearest(credits) ? 'expense' : 'income';
  }

  const bnpl = detectBnpl(s);
  const recurring = detectRecurring(s);
  const merchant = bnpl || extractMerchant(s) || (type === 'income' ? 'Credit' : 'Payment');

  // A recurring auto-debit files itself. Income is never an EMI/subscription,
  // and BNPL always needs confirming, so neither gets an automatic category.
  const autoCat = !bnpl && type === 'expense' && recurring ? recurring.cat : null;

  return {
    amount,
    type,
    merchant,
    bnpl: bnpl || null,
    ref: extractRef(s),
    // 'emi' | 'sip' | 'subscription' | null — what kind of recurring debit this
    // is, so the UI can badge it and the reminder engine can pick it up.
    kind: recurring ? recurring.kind : null,
    autoCat,
  };
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
