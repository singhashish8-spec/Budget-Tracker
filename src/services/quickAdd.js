// Turns a free-text line like "spent 500 on food", "1200 petrol", or
// "got 5000 salary" into a structured entry: amount, a short item note, a
// guessed category, and whether it's money in or out. If no category can be
// guessed the UI asks the user to pick one.

// Keyword → builtin category id. First category (in this order) with a hit wins,
// so more specific buckets are listed before broad ones.
const KEYWORD_MAP = [
  ['income', ['salary', 'income', 'received', 'credited', 'credit', 'refund', 'cashback', 'bonus', 'freelance', 'stipend', 'reimburse', 'reimbursement']],
  ['groceries', ['grocery', 'groceries', 'vegetable', 'veggies', 'veggie', 'milk', 'supermarket', 'bigbasket', 'dmart', 'kirana', 'ration', 'fruits']],
  ['food', ['food', 'restaurant', 'dinner', 'lunch', 'breakfast', 'snack', 'swiggy', 'zomato', 'eat', 'cafe', 'coffee', 'takeaway', 'meal', 'pizza', 'burger', 'tea', 'juice']],
  ['transport', ['transport', 'fuel', 'petrol', 'diesel', 'uber', 'ola', 'cab', 'taxi', 'auto', 'bus', 'train', 'metro', 'parking', 'toll', 'rapido', 'fastag']],
  ['health', ['health', 'gym', 'doctor', 'medicine', 'medical', 'pharmacy', 'hospital', 'fitness', 'supplement', 'protein', 'whey', 'trainer', 'workout', 'dentist', 'clinic', 'vitamin']],
  ['subscriptions', ['subscription', 'netflix', 'prime', 'spotify', 'hotstar', 'youtube', 'membership', 'jio', 'recharge', 'plan']],
  ['entertainment', ['entertainment', 'movie', 'cinema', 'game', 'concert', 'party', 'bar', 'pub', 'drinks', 'outing']],
  ['utilities', ['utility', 'utilities', 'electricity', 'water', 'internet', 'wifi', 'broadband', 'dth', 'bill', 'current']],
  ['rent', ['rent', 'housing', 'landlord', 'maintenance', 'society', 'pg']],
  ['shopping', ['shopping', 'shop', 'clothes', 'amazon', 'flipkart', 'myntra', 'shoes', 'tshirt', 'shirt', 'dress', 'bought', 'buy']],
  ['emi', ['emi', 'loan', 'instalment', 'installment']],
  ['invest', ['invest', 'sip', 'mutual', 'fund', 'stocks', 'shares', 'gold', 'savings']],
  ['transfer', ['transfer', 'sent', 'paytm', 'gpay', 'phonepe']],
];

// `credit` alone is too weak a signal — "credit card bill 5000" is an
// expense, not income — but `credited`/`credit` used any other way (not
// immediately followed by "card") still reads as money coming in.
const INCOME_WORDS = /\b(received|got|credited|credit(?!\s*card)|salary|income|refund|cashback|bonus|deposit|reimburse|reimbursement|stipend)\b/i;

// Filler words stripped to leave a clean item label.
const FILLER = /\b(spent|spend|paid|pay|bought|buy|on|for|at|to|rs|inr|rupees|rupee|bucks|got|received|income|of|the|a|an|my)\b/gi;

// A number directly marked with a currency symbol/word is unambiguous —
// prefer it over any other number in the text, wherever it sits.
const CURRENCY_AMOUNT_RE = /(?:₹|rs\.?|inr|rupees?)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?)\b/i;

// A bare 4-digit number in a plausible calendar-year range, with no comma and
// no decimal, reads as part of the context ("diwali 2025 shopping") rather
// than the amount — unless it's the only number in the text at all.
function looksLikeBareYear(numStr) {
  return /^(19|20)\d{2}$/.test(numStr);
}

// The amount isn't always the first number in the text — "diwali 2025
// shopping 500" and "flat 502 rent 15000" both have an earlier, unrelated
// number ahead of the real amount. Prefer a currency-marked number; failing
// that, prefer the last number that doesn't look like a bare year, since in
// practice the real amount tends to be the one closest to the end of a short
// quick-add phrase once incidental context numbers are excluded.
function pickAmount(raw) {
  const marked = raw.match(CURRENCY_AMOUNT_RE);
  if (marked) return parseFloat((marked[1] || marked[2]).replace(/,/g, ''));

  const all = [...raw.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0]);
  if (!all.length) return null;
  const nonYear = all.filter((n) => !looksLikeBareYear(n));
  const candidates = nonYear.length ? nonYear : all;
  return parseFloat(candidates[candidates.length - 1].replace(/,/g, ''));
}

export function parseQuickEntry(text, categoryIds = []) {
  const raw = (text || '').trim();
  if (!raw) return { error: 'Type something like "500 groceries"' };

  const amount = pickAmount(raw);
  if (amount == null) return { error: 'No amount found — try "petrol 1200" or "500 lunch"' };
  if (!amount || amount <= 0) return { error: 'That amount looks off' };

  const low = raw.toLowerCase();
  const type = INCOME_WORDS.test(low) ? 'income' : 'expense';

  // Guess the category from keywords, matched as whole words only — a plain
  // substring test let "cab" match inside "cabbage" and "ola" match inside
  // "cola", mis-filing unrelated purchases under Transport.
  const wordSet = new Set(low.split(/[^a-z0-9]+/).filter(Boolean));
  let cat = null;
  for (const [id, words] of KEYWORD_MAP) {
    if (!categoryIds.includes(id)) continue;
    if (words.some((w) => wordSet.has(w))) { cat = id; break; }
  }

  // Clean item label: drop the amount and filler words, tidy whitespace.
  let item = raw
    .replace(/₹/g, ' ')
    .replace(/\d[\d,]*(\.\d+)?/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (item) item = item.charAt(0).toUpperCase() + item.slice(1);

  return { amount, type, cat, item };
}
