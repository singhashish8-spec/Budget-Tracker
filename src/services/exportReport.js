import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fmt } from '../utils/currency';

// CSV formula/injection guard (CWE-1236): a merchant or date string that
// originates from AI-extracted, attacker-influenceable file content (a
// doctored receipt, a modified bank-statement HTML) could start with
// =, +, -, or @ and get interpreted as a live formula when the exported
// file is opened in Excel/Sheets — quoting the cell alone does NOT stop
// this. Prefixing with a literal `'` neutralizes it. Flagged in the design
// review; this is the fix.
function csvCell(value) {
  let v = String(value ?? '');
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

function categoryLabel(categories, catId) {
  return categories.find((c) => c.id === catId)?.label ?? 'Uncategorised';
}

function buildCsv(txns, categories) {
  const rows = [['Date', 'Merchant', 'Account', 'Category', 'Type', 'Amount (INR)']];
  txns.forEach((t) => {
    rows.push([t.date, t.merchant, t.account || '', categoryLabel(categories, t.cat), t.type, t.type === 'income' ? t.amount : -t.amount]);
  });
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
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
        `<tr><td>${escHtml(t.date)}</td><td>${escHtml(t.merchant)}</td><td>${escHtml(categoryLabel(categories, t.cat))}</td><td style="text-align:right">${t.type === 'income' ? '+' : '−'}${escHtml(fmt(t.amount))}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Budget Tracker report</title><style>body{font-family:sans-serif;color:#1B1F23;padding:32px;max-width:720px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}td,th{padding:8px 6px;border-bottom:1px solid #E7E2D9;text-align:left}.sum{display:flex;gap:24px;font-size:14px}</style></head><body><h1>Budget Tracker</h1><div class="sum"><div>Income <b>${fmt(income)}</b></div><div>Spent <b>${fmt(spend)}</b></div><div>Net <b>${fmt(income - spend)}</b></div></div><table><tr><th>Date</th><th>Merchant</th><th>Category</th><th style="text-align:right">Amount</th></tr>${rows}</table></body></html>`;
}

// True on-device PDF rendering needs a dedicated library; this exports a
// self-contained HTML report instead (shareable, opens/prints-to-PDF in any
// browser) rather than pulling in a heavy PDF dependency for an MVP feature.
export async function exportHtmlReport(txns, categories) {
  const html = buildReportHtml(txns, categories);
  await writeAndShare(`budget-tracker-report-${Date.now()}.html`, html, 'text/html');
}
