// Builds a redacted "what did I get wrong?" report from the corrections the
// user has already made on their phone, so the parser can be improved against
// real messages instead of invented ones.
//
// ── Why this exists ────────────────────────────────────────────────────────
// The app never talks to a server, so every correction the user makes — this
// message wasn't a transaction, this one is Food, ignore this template forever
// — stays on the device and can never inform the code. That feedback is the
// single most valuable input for `smsParse.js`, and it was being thrown away.
//
// Nothing here is automatic and nothing is uploaded. The user taps a button,
// gets a text file, reads it, and decides whether to share it. That keeps the
// app's "your data never leaves this device unless you send it" promise intact
// — see PROJECT_HISTORY §1.
//
// ── Where the signals come from (all already recorded, no schema change) ────
//   false positives  sms_log rows whose txn_id is NULL. deleteTransaction()
//                    detaches the log row rather than deleting it, so a
//                    message that was imported and then deleted leaves exactly
//                    this trace.
//   rejections       sms_ignores — templates explicitly muted forever.
//   categorisations  merchant_rules, plus sms_log→transactions.cat for the
//                    category a message's transaction actually ended up in.
//   mis-classified   re-running parseSms on a stored body and comparing its
//                    suggestion to where the user actually filed it.

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import * as repo from '../db/repo';
import { parseSms, rejectionReason, smsSignature } from './smsParse';
import { redact } from './trainingRedact';

// Cap the report so a long-lived inbox can't produce an unshareable wall of
// text. Newest-first, since recent corrections reflect current behaviour.
const MAX_PER_SECTION = 60;

// One line per case, in a shape that is easy to read AND easy for an assistant
// to turn into a test case.
function formatCase(entry) {
  const lines = [`  MESSAGE: ${entry.body}`];
  if (entry.parsed) {
    lines.push(`  PARSER SAID: ${entry.parsed.type} ₹${entry.parsed.amount}` +
      (entry.parsed.kind ? ` [${entry.parsed.kind}]` : '') +
      (entry.parsed.autoCat ? ` → filed as ${entry.parsed.autoCat}` : ''));
  } else {
    lines.push(`  PARSER SAID: not a transaction (${entry.reason || 'unknown'})`);
  }
  lines.push(`  YOU SAID: ${entry.verdict}`);
  return lines.join('\n');
}

// Assembles the whole report. Returns { text, counts } so the caller can show a
// summary without re-deriving it.
export async function buildTrainingReport() {
  const [logs, txns, ignores, rules, cats] = await Promise.all([
    repo.listAllSmsLog(),
    repo.listTransactions(),
    repo.listSmsIgnores(),
    repo.listMerchantRules(),
    repo.listCategories(),
  ]);

  const catLabel = Object.fromEntries((cats || []).map((c) => [c.id, c.label]));
  const txnById = Object.fromEntries((txns || []).map((t) => [t.id, t]));
  const newestFirst = (a, b) => (b.created_at || 0) - (a.created_at || 0);

  // 1. FALSE POSITIVES — imported, then deleted by the user.
  const falsePositives = [];
  for (const log of [...(logs || [])].sort(newestFirst)) {
    if (log.txn_id) continue; // still attached to a live transaction
    const body = redact(log.raw_sms);
    const parsed = parseSms(log.raw_sms);
    falsePositives.push({
      body,
      parsed,
      reason: parsed ? null : rejectionReason(log.raw_sms),
      verdict: 'NOT a transaction — I deleted it',
    });
    if (falsePositives.length >= MAX_PER_SECTION) break;
  }

  // 2. REJECTED TEMPLATES — muted forever via "ignore this message".
  // Only the signature is stored (numbers already collapsed to #), which is
  // itself a redacted form, so it ships as-is.
  const rejected = (ignores || []).slice(0, MAX_PER_SECTION).map((sig) => ({
    body: String(sig),
    parsed: null,
    reason: 'user-ignored',
    verdict: 'NOT a transaction — I muted this template',
  }));

  // 3. MISCATEGORISED — the parser's suggestion disagrees with where the
  // transaction actually ended up. Only meaningful when the parser had an
  // opinion at all.
  const miscategorised = [];
  for (const log of [...(logs || [])].sort(newestFirst)) {
    if (!log.txn_id) continue;
    const txn = txnById[log.txn_id];
    if (!txn || !txn.cat) continue;
    const parsed = parseSms(log.raw_sms);
    if (!parsed) {
      // Imported once, but today's parser would reject it — a regression or a
      // template the rewrite made stricter about. Very much worth seeing.
      miscategorised.push({
        body: redact(log.raw_sms),
        parsed: null,
        reason: rejectionReason(log.raw_sms),
        verdict: `IS a transaction — I have it as ${catLabel[txn.cat] || txn.cat}`,
      });
    } else if (parsed.autoCat && parsed.autoCat !== txn.cat) {
      miscategorised.push({
        body: redact(log.raw_sms),
        parsed,
        verdict: `WRONG category — it belongs in ${catLabel[txn.cat] || txn.cat}`,
      });
    } else if (parsed.amount !== Math.abs(txn.amount)) {
      miscategorised.push({
        body: redact(log.raw_sms),
        parsed,
        verdict: `WRONG amount — it should be ₹${Math.abs(txn.amount)}`,
      });
    }
    if (miscategorised.length >= MAX_PER_SECTION) break;
  }

  // 4. TAUGHT CATEGORIES — merchant→category rules the user set by hand. These
  // say "the parser should have known this merchant", which is exactly how the
  // built-in merchant dictionary grows.
  const taught = (rules || []).slice(0, MAX_PER_SECTION).map((r) => ({
    merchant: r.signature,
    cat: catLabel[r.category_id] || r.category_id,
  }));

  const counts = {
    falsePositives: falsePositives.length,
    rejected: rejected.length,
    miscategorised: miscategorised.length,
    taught: taught.length,
  };

  const section = (title, blurb, items) =>
    items.length
      ? [`## ${title} (${items.length})`, blurb, '', ...items.map(formatCase), ''].join('\n')
      : '';

  const text = [
    '# Budget Tracker — parser feedback',
    '',
    `Generated ${new Date().toISOString()}`,
    '',
    'Account numbers, reference ids, phone numbers, names and ALL balance',
    'figures have been replaced with placeholders. Transaction amounts and',
    'merchant names are kept, because a test case cannot assert anything',
    'without them. Read this file before sharing it.',
    '',
    'Every case below is something the app got wrong, judged by what you did',
    'about it afterwards. Each one can become a regression test.',
    '',
    section(
      'Imported but deleted — false positives',
      'The parser treated these as real spending; you deleted them. These are the highest-priority fixes.',
      falsePositives,
    ),
    section(
      'Templates you muted',
      'You told the app to never import these again.',
      rejected,
    ),
    section(
      'Wrong category, wrong amount, or newly rejected',
      "Where today's parser disagrees with how the transaction actually ended up.",
      miscategorised,
    ),
    taught.length
      ? [
          `## Merchants you categorised by hand (${taught.length})`,
          'Each of these is a merchant the parser could have recognised on its own.',
          '',
          ...taught.map((t) => `  ${t.merchant} → ${t.cat}`),
          '',
        ].join('\n')
      : '',
    counts.falsePositives + counts.rejected + counts.miscategorised + counts.taught === 0
      ? '_No corrections recorded yet — nothing to report. Use the app for a while and check back._'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { text, counts };
}

// Writes the report to a shareable .txt and opens the system share sheet, so
// it can go to Drive, WhatsApp, email — wherever the user chooses. Deliberately
// a share, never an upload: the app has no server to send it to, and that is
// the point (PROJECT_HISTORY §1).
//
// Returns the counts so the caller can tell the user what they just shared.
export async function shareTrainingReport() {
  const { text, counts } = await buildTrainingReport();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `budget-tracker-parser-feedback-${stamp}.txt`;

  // Preferred path: a real file through the system share sheet, which is the
  // only form that survives a long report intact.
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, url: result.uri });
    return { ...counts, via: 'share' };
  } catch (err) {
    // A cancelled share sheet is the user's decision, not a failure — don't
    // silently re-deliver the report by another route behind their back.
    if (/cancel/i.test(err?.message || '')) throw err;
  }

  // Fallback: the clipboard. Reached when there's no native filesystem or no
  // share target (a browser, a stripped-down device). Degrading to a paste
  // beats losing the report, per the project's native-call convention.
  await Clipboard.write({ string: text });
  return { ...counts, via: 'clipboard' };
}

export { redact };

// Convenience for the "ignore this message" flow, so a caller can record a
// rejection using the same signature the report reads back.
export { smsSignature };
