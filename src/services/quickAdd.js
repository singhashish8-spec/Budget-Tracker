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

const INCOME_WORDS = /\b(received|got|credited|credit|salary|income|refund|cashback|bonus|deposit|reimburse|reimbursement|stipend)\b/i;

// Filler words stripped to leave a clean item label.
const FILLER = /\b(spent|spend|paid|pay|bought|buy|on|for|at|to|rs|inr|rupees|rupee|bucks|got|received|income|of|the|a|an|my)\b/gi;

export function parseQuickEntry(text, categoryIds = []) {
  const raw = (text || '').trim();
  if (!raw) return { error: 'Type something like "500 groceries"' };

  const amtMatch = raw.match(/\d[\d,]*(\.\d+)?/);
  if (!amtMatch) return { error: 'No amount found — try "petrol 1200" or "500 lunch"' };
  const amount = parseFloat(amtMatch[0].replace(/,/g, ''));
  if (!amount || amount <= 0) return { error: 'That amount looks off' };

  const low = raw.toLowerCase();
  const type = INCOME_WORDS.test(low) ? 'income' : 'expense';

  // Guess the category from keywords, but only offer ids the app actually has.
  let cat = null;
  for (const [id, words] of KEYWORD_MAP) {
    if (!categoryIds.includes(id)) continue;
    if (words.some((w) => low.includes(w))) { cat = id; break; }
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
