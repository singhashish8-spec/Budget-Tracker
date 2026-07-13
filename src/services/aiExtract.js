import { toBase64, htmlToText, capText, xlsxToText } from './fileParse';

// IMPORTANT: this never calls Claude/Gemini directly from the client — that
// would ship an LLM API key inside the installed app, extractable by anyone
// with the APK (this was flagged in the design review). Instead it posts to
// a backend endpoint *you* control, which holds the real API key server-side
// and enforces the JSON contract below. Until VITE_AI_PARSE_ENDPOINT is set,
// this throws instead of silently no-oping, so the gap is obvious in the UI
// rather than discovered at review time.
//
// Expected backend contract:
//   POST {endpoint}
//   body: { content: [{ type: 'image'|'document'|'text', mediaType?, data? }], categories: string[] }
//   response: { transactions: [{ merchant, date, amount, type: 'expense'|'income', category: string|null }] }

function endpoint() {
  return import.meta.env.VITE_AI_PARSE_ENDPOINT || '';
}

export function isConfigured() {
  return !!endpoint();
}

async function callBackend(content) {
  const url = endpoint();
  if (!url) {
    throw new Error('AI import isn’t configured yet — set VITE_AI_PARSE_ENDPOINT to your backend parsing endpoint');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`AI import failed (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data.transactions)) throw new Error('AI couldn’t find transactions in this file');
  return data.transactions;
}

// Returns { transactions, truncated } — `truncated` must be surfaced to the
// user (not swallowed) when a large statement got cut to the 60k-char cap,
// otherwise "N transactions found" reads as complete when it silently isn't.
export async function extractTransactions(file) {
  const name = file.name.toLowerCase();

  if (file.type.startsWith('image/')) {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ok.includes(file.type)) throw new Error('Use a JPG, PNG or WebP image');
    const data = await toBase64(file);
    const transactions = await callBackend([{ type: 'image', mediaType: file.type, data }]);
    return { transactions, truncated: false };
  }

  if (name.endsWith('.pdf')) {
    const data = await toBase64(file);
    const transactions = await callBackend([{ type: 'document', mediaType: 'application/pdf', data }]);
    return { transactions, truncated: false };
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const raw = await xlsxToText(file);
    const { text, truncated } = capText(raw);
    const transactions = await callBackend([{ type: 'text', data: text }]);
    return { transactions, truncated };
  }

  const raw = await file.text();
  if (!raw.trim()) throw new Error('That file looks empty');
  const clean = name.endsWith('.html') || name.endsWith('.htm') ? htmlToText(raw) : raw;
  const { text, truncated } = capText(clean);
  const transactions = await callBackend([{ type: 'text', data: text }]);
  return { transactions, truncated };
}
