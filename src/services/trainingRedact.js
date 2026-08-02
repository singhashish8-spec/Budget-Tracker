// The redaction pass for the parser-feedback export (services/trainingExport).
//
// Split into its own module for one reason: it is pure (string in, string out)
// and it is the only code in the app that shapes a file explicitly meant to
// leave the device, so it has to be directly testable. trainingExport.js talks
// to the database and therefore drags in Capacitor, which a plain `node --test`
// run cannot load — keeping this side of it dependency-free is what makes
// trainingRedact.test.js possible at all.

// ── Redaction ───────────────────────────────────────────────────────────────
// The goal is a message that still PARSES THE SAME WAY while carrying nothing
// that identifies the person or their finances beyond the one amount that makes
// the test case meaningful.
//
// Deliberately kept: the transaction amount and the merchant token — without
// those a test case can't assert anything useful.
// Deliberately removed: account numbers, reference ids, phone numbers, card
// numbers, and every balance figure (a balance discloses net worth, which is
// far more sensitive than one purchase, and no test needs its real value).
export function redact(body) {
  let s = String(body || '');

  // Balances first, before the generic number rules can touch them. Covers
  // "Bal INR 1,429.16", "Avl Bal Rs.12,345", "Available limit Rs 48,701".
  s = s.replace(
    // The separator allows a short connector word, because templates say both
    // "Avl Bal Rs.12,345" and "Available balance is Rs 26,431.55".
    /\b(avl\s*bal|available\s*bal(?:ance)?|avbl\s*bal|bal(?:ance)?|avl\s*lmt|available\s*limit|limit|outstanding)\b([:\s.]*(?:is|was|of)?[:\s.]*)(?:rs|inr|₹)?\.?\s*[\d,]+(?:\.\d{1,2})?/gi,
    (_m, word, sep) => `${word}${sep || ' '}<BAL>`,
  );

  // Masked and unmasked account/card numbers: "A/c XX1234", "XXXXXX7890",
  // "A/c no 123456789012".
  s = s.replace(/\b((?:a\/?c|acct|account|card)\s*(?:no\.?|number)?[:\s.]*)[Xx*]*\d{3,}/gi, '$1<ACCT>');
  s = s.replace(/\b[Xx*]{2,}\d{2,}\b/g, '<ACCT>');

  // Reference / transaction ids, including the bank-prefixed forms.
  s = s.replace(/\b(ref(?:erence)?(?:\s*(?:no|id))?\.?[:\s#]*)\w{6,}/gi, '$1<REF>');
  s = s.replace(/\b((?:NEFT|IMPS|RTGS|UPI)\s*(?:CR|DR)?-?)\w{8,}/gi, '$1<REF>');
  s = s.replace(/\bUPI\/(CR|DR)\/\d+/gi, 'UPI/$1/<REF>');

  // Phone numbers (helpline and personal alike) and long bare digit runs.
  s = s.replace(/\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g, '<PHONE>');
  s = s.replace(/\b1800[-\s]?\d{3,}[-\s]?\d*\b/g, '<PHONE>');
  s = s.replace(/\b\d{8,}\b/g, '<NUM>');

  // The person on the other end of a P2P transfer. Their name is theirs, not
  // the user's to share. Kept as a placeholder so the template shape survives.
  s = s.replace(/(\bUPI\/(?:CR|DR)\/<REF>\/)[A-Za-z][A-Za-z0-9 .*&_-]{2,}/g, '$1<NAME>');
  s = s.replace(/((?:NEFT|IMPS|RTGS)\s+(?:CR|DR)-<REF>\s*-\s*)[A-Za-z][A-Za-z0-9 .&_-]{2,}/g, '$1<NAME>');
  // UPI handles: keep the provider (it's a useful parsing signal), drop the id.
  s = s.replace(/\b[\w.-]+@([\w.-]+)\b/g, '<VPA>@$1');

  return s.trim();
}
