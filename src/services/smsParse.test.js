// Tests for the SMS parsing engine — the app's single most important piece of
// logic, and until now the only one with no test at all.
//
// Run with `npm test` (node:test, built into Node 22 — no new dependency).
//
// The message bodies below are real-world Indian bank/UPI/NBFC templates with
// account numbers and names changed. Two categories matter most:
//
//   * REJECTIONS — reminders, scheduled debits, offers and failed payments that
//     the old parser imported as real spending. This was the reported bug:
//     "I receive a reminder message from banks and EMI companies and the app
//     registers it as a transaction."
//   * RECURRING — EMI / SIP / subscription auto-debits, which should file
//     themselves into the right category without being told.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSms, rejectionReason, extractAmount, detectRecurring, looksLikeMoney } from './smsParse.js';

// ── Real transactions: these MUST be imported ──────────────────────────────
const REAL = [
  {
    name: 'AU Bank UPI debit',
    body: 'Dr INR 4,000.00 - AU A/c X3456 UPI/DR/230209515165/ASHISH SINGH Bal INR 1,429.16',
    expect: { type: 'expense', amount: 4000 },
  },
  {
    name: 'HDFC UPI debit with merchant',
    body: 'Rs.450.00 debited from A/c XX1234 on 02-08-26 to VPA swiggy@ybl. Ref 512345678901. Not you? Call 18002586161',
    expect: { type: 'expense', amount: 450 },
  },
  {
    name: 'salary credit via NEFT',
    body: 'INR 85,000.00 credited to A/c XX1234 on 01-08-26. Ref NEFT CR-HDFCN52026080112345678 -ACME PVT LTD. Bal INR 92,431.55',
    expect: { type: 'income', amount: 85000 },
  },
  {
    name: 'card spend',
    body: 'Rs 1,299.00 spent on your ICICI Bank Credit Card XX9012 at AMAZON on 02-Aug-26. Avl Lmt Rs 48,701',
    expect: { type: 'expense', amount: 1299 },
  },
  {
    name: 'ATM withdrawal',
    body: 'Rs.10,000 withdrawn from A/c XX1234 at SBI ATM on 02-08-26. Avl Bal Rs.25,000',
    expect: { type: 'expense', amount: 10000 },
  },
  {
    name: 'refund credited',
    body: 'Rs.799.00 refunded to your A/c XX1234 on 02-08-26 by AMAZON. Bal Rs.26,000',
    expect: { type: 'income', amount: 799 },
  },
  {
    name: 'balance quoted BEFORE the amount that moved',
    body: 'Avl Bal Rs.12,345.00 after debit of Rs.500.00 at BIGBAZAAR on 02-08-26',
    expect: { type: 'expense', amount: 500 },
  },
  {
    name: 'suffix currency form',
    body: '2,500.00 INR debited from your account XX1234 towards ELECTRICITY BILL on 02-08-26',
    expect: { type: 'expense', amount: 2500 },
  },
];

for (const c of REAL) {
  test(`imports: ${c.name}`, () => {
    const r = parseSms(c.body);
    assert.ok(r, `expected a transaction, got null (reason: ${rejectionReason(c.body)})`);
    assert.equal(r.type, c.expect.type);
    assert.equal(r.amount, c.expect.amount);
  });
}

// ── Non-transactions: these MUST be rejected ───────────────────────────────
// Every one of these was imported as real spending by the previous parser.
const REJECT = [
  {
    name: 'EMI reminder (the reported bug)',
    body: 'Dear Customer, your EMI of Rs.5,000 for Loan A/c LN12345 is due on 05-Aug-26. Please maintain sufficient balance.',
    reason: 'reminder',
  },
  {
    name: 'scheduled future debit',
    body: 'Rs.2,499.00 will be debited from your A/c XX1234 on 05-Aug-26 towards your NETFLIX subscription.',
    reason: 'scheduled',
  },
  {
    name: 'SIP due reminder',
    body: 'Your SIP instalment of Rs.10,000 is due on 05-Aug-26 for folio 12345678. Please ensure funds are available.',
    reason: 'reminder',
  },
  {
    name: 'credit card bill reminder',
    body: 'Your HDFC Credit Card bill of Rs.24,500 is due by 18-Aug-26. Pay now to avoid late payment charges.',
    reason: 'reminder',
  },
  {
    name: 'loan offer',
    body: 'Congratulations! You are eligible for a pre-approved personal loan of Rs.5,00,000 at lowest interest. Apply now!',
    reason: 'promotional',
  },
  {
    name: 'failed transaction',
    body: 'Your transaction of Rs.1,500.00 at FLIPKART has failed. The amount will be reversed within 5 working days.',
    reason: 'failed',
  },
  {
    name: 'declined card',
    body: 'Transaction of Rs.3,200 on your Card XX9012 was declined due to insufficient balance.',
    reason: 'failed',
  },
  {
    name: 'UPI collect request',
    body: 'RAHUL KUMAR has requested Rs.500.00 via UPI. Approve in your app before 02-08-26 18:00.',
    reason: 'payment-request',
  },
  {
    name: 'mandate registration',
    body: 'Your e-mandate for Rs.2,499.00 towards NETFLIX has been successfully registered for A/c XX1234.',
    reason: 'mandate-setup',
  },
  {
    name: 'OTP quoting an amount',
    body: '123456 is the OTP for your transaction of Rs.4,999.00 at AMAZON. Do not share this OTP with anyone.',
    reason: 'otp',
  },
  {
    name: 'balance enquiry only',
    body: 'Available balance in your A/c XX1234 as on 02-08-26 is Rs.26,431.55',
    reason: 'no-transaction-verb',
  },
  {
    name: 'statement generated',
    body: 'Your account statement for Jul-26 is ready. Total spends Rs.42,150. Minimum amount due Rs.2,100 by 18-Aug-26.',
    reason: 'reminder',
  },
  {
    name: 'spend-and-get offer (imperative verb, not past tense)',
    body: 'Spend Rs.2,000 on your Card XX9012 and get cashback upto Rs.500. Offer valid till 31-Aug-26. T&C apply.',
    reason: 'promotional',
  },
];

for (const c of REJECT) {
  test(`rejects: ${c.name}`, () => {
    assert.equal(parseSms(c.body), null, 'should NOT be imported as a transaction');
    assert.equal(rejectionReason(c.body), c.reason);
  });
}

// ── Recurring detection: EMI / SIP / subscription auto-debits ───────────────
const RECURRING = [
  {
    name: 'EMI auto-debit',
    body: 'Rs.12,500.00 debited from A/c XX1234 on 05-08-26 towards EMI for Loan A/c LN12345. Bal Rs.14,000',
    kind: 'emi',
    cat: 'emi',
  },
  {
    name: 'NACH loan repayment',
    body: 'INR 8,750.00 debited via NACH from A/c XX1234 towards loan repayment on 05-08-26.',
    kind: 'emi',
    cat: 'emi',
  },
  {
    name: 'SIP debit',
    body: 'Rs.10,000.00 debited from A/c XX1234 on 05-08-26 towards SIP for folio 12345678 - AXIS BLUECHIP FUND.',
    kind: 'sip',
    cat: 'invest',
  },
  {
    name: 'Netflix auto-renewal',
    body: 'Rs.2,499.00 debited from A/c XX1234 on 05-08-26 for NETFLIX subscription auto-renewal.',
    kind: 'subscription',
    cat: 'subscriptions',
  },
  {
    name: 'known subscription merchant with no keyword',
    body: 'Rs.1,499.00 spent on Card XX9012 at SPOTIFY on 05-Aug-26.',
    kind: 'subscription',
    cat: 'subscriptions',
  },
];

for (const c of RECURRING) {
  test(`classifies recurring: ${c.name}`, () => {
    const r = parseSms(c.body);
    assert.ok(r, `expected a transaction, got null (reason: ${rejectionReason(c.body)})`);
    assert.equal(r.type, 'expense');
    assert.equal(r.kind, c.kind);
    assert.equal(r.autoCat, c.cat, 'should auto-file into the right category');
  });
}

// ── Amount picking: never mistake a balance for the amount ─────────────────
test('never picks the balance as the amount', () => {
  assert.equal(extractAmount('Rs.500 debited. Avl Bal Rs.1,23,456.78'), 500);
  assert.equal(extractAmount('Avl Bal Rs.99,999 after debit of Rs.250'), 250);
  assert.equal(extractAmount('Available limit Rs.48,701. Rs.1,299 spent'), 1299);
});

test('parses paise-bearing amounts to whole rupees', () => {
  assert.equal(extractAmount('Rs.1,234.56 debited'), 1235);
  assert.equal(extractAmount('INR 99.49 debited'), 99);
});

// ── Guards on the supporting helpers ───────────────────────────────────────
test('income is never auto-filed as EMI or subscription', () => {
  const r = parseSms('Rs.12,500.00 credited to A/c XX1234 towards EMI refund for Loan A/c LN12345.');
  assert.ok(r);
  assert.equal(r.type, 'income');
  assert.equal(r.autoCat, null);
});

test('BNPL is flagged and never auto-categorised', () => {
  const r = parseSms('Rs.1,200.00 debited via Simpl for your SWIGGY order on 02-08-26.');
  assert.ok(r);
  assert.equal(r.bnpl, 'Simpl');
  assert.equal(r.autoCat, null);
});

test('detectRecurring returns null for ordinary spending', () => {
  assert.equal(detectRecurring('Rs.450 debited to VPA swiggy@ybl'), null);
});

test('looksLikeMoney excludes OTPs but keeps unparsed money texts', () => {
  assert.equal(looksLikeMoney('123456 is the OTP for Rs.500'), false);
  assert.equal(looksLikeMoney('Your EMI of Rs.5,000 is due on 05-Aug'), true);
  assert.equal(looksLikeMoney('Hello, how are you?'), false);
});

test('empty and junk input never throws', () => {
  for (const v of [null, undefined, '', '   ', 'hello', '12345']) {
    assert.equal(parseSms(v), null);
  }
});
