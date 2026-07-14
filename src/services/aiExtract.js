import { toBase64, htmlToText, capText, xlsxToText } from './fileParse';

// Calls Google Gemini directly to extract transactions from a receipt photo,
// PDF/HTML/CSV statement, or spreadsheet.
//
// SECURITY NOTE: the API key ships inside the APK (it's read at build time
// from VITE_GEMINI_API_KEY). Anyone who unpacks the APK can extract it. That
// is an accepted tradeoff for a personal, self-installed build — the proper
// production fix is to route these calls through a small backend that holds
// the key server-side. Mitigate by using a key with tight quotas / that you
// can rotate, and don't publish this APK. See README "AI scanning".

const MODEL = 'gemini-2.5-flash';

function apiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function isConfigured() {
  return !!apiKey();
}

function buildPrompt(categoryIds) {
  const ids = categoryIds && categoryIds.length ? categoryIds.join(', ') : 'food, groceries, transport, rent, utilities, shopping, health, entertainment, emi, invest, subscriptions, income, transfer, other';
  return (
    'Extract every financial transaction from this document. ' +
    'Respond with ONLY a JSON array (no prose, no markdown fences). ' +
    'Each item must be: {"merchant": string, "date": short string like "12 Jun", ' +
    '"amount": number (absolute value, no currency symbol), "type": "expense" or "income", ' +
    '"category": one of [' + ids + '] or null if unsure}. ' +
    'If it is a single bill or receipt, return one item for the grand total. ' +
    'If dates are Excel serial numbers, convert them to readable dates. Assume INR unless stated.'
  );
}

async function callGemini(parts) {
  const key = apiKey();
  if (!key) {
    throw new Error('AI scanning isn’t set up yet — add your Gemini API key (see README) and rebuild');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || '';
    } catch {
      // ignore parse failure — we'll fall back to the status code
    }
    if (res.status === 400 || res.status === 403) throw new Error('AI rejected the request — check your Gemini API key is valid');
    if (res.status === 429) throw new Error('Gemini rate limit hit — wait a moment and try again');
    throw new Error(`AI scan failed (${res.status})${detail ? ': ' + detail.slice(0, 80) : ''}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Couldn’t find any transactions in that file');
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('AI returned an unreadable response — try again');
  }
  if (!Array.isArray(parsed)) throw new Error('Couldn’t find any transactions in that file');
  return parsed;
}

// Returns { transactions, truncated } — `truncated` is surfaced to the user
// when a large statement got cut to the 60k-char cap so "N transactions found"
// doesn't read as complete when it silently isn't.
export async function extractTransactions(file, categoryIds) {
  const name = file.name.toLowerCase();
  const promptPart = { text: buildPrompt(categoryIds) };

  if (file.type.startsWith('image/')) {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ok.includes(file.type)) throw new Error('Use a JPG, PNG or WebP image');
    const data = await toBase64(file);
    const transactions = await callGemini([{ inline_data: { mime_type: file.type, data } }, promptPart]);
    return { transactions, truncated: false };
  }

  if (name.endsWith('.pdf')) {
    const data = await toBase64(file);
    const transactions = await callGemini([{ inline_data: { mime_type: 'application/pdf', data } }, promptPart]);
    return { transactions, truncated: false };
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const raw = await xlsxToText(file);
    const { text, truncated } = capText(raw);
    const transactions = await callGemini([{ text }, promptPart]);
    return { transactions, truncated };
  }

  const raw = await file.text();
  if (!raw.trim()) throw new Error('That file looks empty');
  const clean = name.endsWith('.html') || name.endsWith('.htm') ? htmlToText(raw) : raw;
  const { text, truncated } = capText(clean);
  const transactions = await callGemini([{ text }, promptPart]);
  return { transactions, truncated };
}
