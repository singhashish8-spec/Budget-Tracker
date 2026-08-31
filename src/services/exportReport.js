import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fmtInr } from '../utils/currency';
import { printHtmlAsPdf } from './nativeTools';
import { buildTransactionsCsv, categoryLabel } from './csvFormat';

// csvCell/csvNumber/buildCsv used to be defined here directly, duplicating
// zipExport.js's independent copy of the same logic — which is exactly how
// a negative-amount formula-guard bug (every expense amount turned into a
// text cell, so a spreadsheet's own SUM() silently skipped it) shipped in
// both places at once. Now shared from ./csvFormat.
export function buildCsv(txns, categories) {
  return buildTransactionsCsv(txns, categories);
}

async function writeAndShare(filename, data, mimeType) {
  const result = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    encoding: 'utf8',
  });
  await Share.share({ title: filename, url: result.uri });
}

export async function exportCsv(txns, categories) {
  const csv = buildCsv(txns, categories);
  await writeAndShare(`budget-tracker-${Date.now()}.csv`, csv, 'text/csv');
}

function escHtml(x) {
  return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function buildReportHtml(txns, categories) {
  const spend = txns.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const income = txns.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const rows = txns
    .map(
      (t) =>
        `<tr><td>${escHtml(t.date)}</td><td>${escHtml(t.merchant)}</td><td>${escHtml(categoryLabel(categories, t.cat))}</td><td style="text-align:right">${t.type === 'income' ? '+' : '−'}${escHtml(fmtInr(t.amount))}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Budget Tracker report</title><style>body{font-family:sans-serif;color:#1B1F23;padding:32px;max-width:720px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}td,th{padding:8px 6px;border-bottom:1px solid #E7E2D9;text-align:left}.sum{display:flex;gap:24px;font-size:14px}</style></head><body><h1>Budget Tracker</h1><div class="sum"><div>Income <b>${fmtInr(income)}</b></div><div>Spent <b>${fmtInr(spend)}</b></div><div>Net <b>${fmtInr(income - spend)}</b></div></div><table><tr><th>Date</th><th>Merchant</th><th>Category</th><th style="text-align:right">Amount</th></tr>${rows}</table></body></html>`;
}

// True on-device PDF rendering needs a dedicated library; this exports a
// self-contained HTML report instead (shareable, opens/prints-to-PDF in any
// browser) rather than pulling in a heavy PDF dependency for an MVP feature.
export async function exportHtmlReport(txns, categories) {
  const html = buildReportHtml(txns, categories);
  await writeAndShare(`budget-tracker-report-${Date.now()}.html`, html, 'text/html');
}

// A real PDF via Android's native PrintManager (its "Save as PDF" virtual
// printer is backed by android.graphics.pdf.PdfDocument) — an alternative to
// the HTML report above for anyone who specifically wants a .pdf file.
export async function exportPdfReport(txns, categories) {
  const html = buildReportHtml(txns, categories);
  await printHtmlAsPdf(html, `Budget Tracker report ${new Date().toLocaleDateString('en-IN')}`);
}
