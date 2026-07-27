import { zipSync, strToU8 } from 'fflate';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { gatherData } from './backup';

// Bundles everything exportable into one file via a browser-side zip
// (fflate) rather than a server-side library (archiver is Node-only and
// can't run in the WebView): the CSV, the HTML report, the full JSON backup,
// and every warranty document (bills, warranty cards, PDFs) — which live in
// the database as base64 data URLs and are otherwise only viewable one at a
// time inside the app.
const CSV_BOM = String.fromCharCode(0xfeff);
// Same formula-injection guard as exportReport.js's csvCell (CWE-1236): a
// merchant/note starting with = + - or @ gets quoted with a leading ' so
// Excel/Sheets never treats it as a live formula.
const CSV_FORMULA_LEAD = new RegExp(`^[\\s${CSV_BOM}\\xA0]*[=+\\-@]`);

function buildCsvText(txns, categories) {
  function csvCell(value) {
    let v = String(value ?? '');
    if (CSV_FORMULA_LEAD.test(v)) v = `'${v}`;
    return `"${v.replace(/"/g, '""')}"`;
  }
  const catLabel = (id) => categories.find((c) => c.id === id)?.label ?? 'Uncategorised';
  const rows = [['Date', 'Merchant', 'Account', 'Category', 'Type', 'Amount (INR)']];
  txns.forEach((t) => {
    rows.push([t.date, t.merchant, t.account || '', catLabel(t.cat), t.type, t.type === 'income' ? t.amount : -t.amount]);
  });
  return CSV_BOM + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function escHtml(x) {
  return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function buildReportHtml(txns, categories) {
  const catLabel = (id) => categories.find((c) => c.id === id)?.label ?? 'Uncategorised';
  const spend = txns.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const income = txns.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const rows = txns
    .map((t) => `<tr><td>${escHtml(t.date)}</td><td>${escHtml(t.merchant)}</td><td>${escHtml(catLabel(t.cat))}</td><td style="text-align:right">${t.type === 'income' ? '+' : '−'}${escHtml(t.amount)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Budget Tracker report</title><style>body{font-family:sans-serif;color:#1B1F23;padding:32px;max-width:720px;margin:0 auto}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}td,th{padding:8px 6px;border-bottom:1px solid #E7E2D9;text-align:left}</style></head><body><h1>Budget Tracker</h1><div>Income ${income} · Spent ${spend} · Net ${income - spend}</div><table><tr><th>Date</th><th>Merchant</th><th>Category</th><th style="text-align:right">Amount</th></tr>${rows}</table></body></html>`;
}

const EXT_BY_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function extFor(mime) {
  return EXT_BY_MIME[mime] || (mime || '').split('/')[1] || 'bin';
}

// A data: URL ("data:image/jpeg;base64,...") to raw bytes, for zipping —
// documents are stored this way so they ride along in the JSON backup too.
function dataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl || '').split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Filesystem-safe name: strip anything that isn't alphanumeric/space/dash,
// so a product name with slashes or emoji can't produce a bad path.
function safeName(s, fallback) {
  const cleaned = String(s ?? '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  return cleaned || fallback;
}

export async function exportAllAsZip() {
  const data = await gatherData();
  const csv = buildCsvText(data.transactions, data.categories);
  const html = buildReportHtml(data.transactions, data.categories);
  const json = JSON.stringify(data, null, 2);

  const stamp = new Date().toISOString().slice(0, 10);
  const files = {
    [`transactions-${stamp}.csv`]: strToU8(csv),
    [`report-${stamp}.html`]: strToU8(html),
    [`backup-${stamp}.json`]: strToU8(json),
  };

  // Every warranty document, grouped under documents/<product>/ so a
  // household with several products doesn't get one flat pile of bills.
  const warrantyById = Object.fromEntries((data.warranties ?? []).map((w) => [w.id, w]));
  const usedNames = new Set();
  for (const doc of data.warrantyDocuments ?? []) {
    if (!doc?.data) continue;
    const product = safeName(warrantyById[doc.warranty_id]?.product, 'Unlinked');
    const docName = safeName(doc.name, 'Document');
    let path = `documents/${product}/${docName}.${extFor(doc.mime)}`;
    let n = 1;
    while (usedNames.has(path)) path = `documents/${product}/${docName}-${++n}.${extFor(doc.mime)}`;
    usedNames.add(path);
    try {
      files[path] = dataUrlToBytes(doc.data);
    } catch {
      // A corrupt data URL costs only itself, not the whole export.
    }
  }

  const zipped = zipSync(files, { level: 6 });

  // Filesystem.writeFile expects base64 for binary content.
  let binary = '';
  for (let i = 0; i < zipped.length; i++) binary += String.fromCharCode(zipped[i]);
  const base64 = btoa(binary);

  const filename = `budget-tracker-export-${stamp}.zip`;
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({ title: filename, url: result.uri });
}
