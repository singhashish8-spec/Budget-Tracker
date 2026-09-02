// Tests for the natural-language quick-add parser ("500 groceries", "got
// 5000 salary"). Added when a codebase-wide audit found it could silently
// log the wrong amount (grabbing an incidental number like a year instead
// of the real one), the wrong category (matching a keyword as a substring —
// "cab" inside "cabbage"), or the wrong direction ("credit card bill"
// treated as income) — see docs/history/findings.md.
//
// Run with `npm test` (node:test, built into Node 22).

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickEntry } from './quickAdd.js';

const CATS = [
  'income', 'groceries', 'food', 'transport', 'health', 'subscriptions',
  'entertainment', 'utilities', 'rent', 'shopping', 'emi', 'invest', 'transfer',
];

test('the original, already-working cases still work', () => {
  assert.equal(parseQuickEntry('500 groceries', CATS).amount, 500);
  assert.equal(parseQuickEntry('500 groceries', CATS).cat, 'groceries');
  assert.equal(parseQuickEntry('1200 petrol', CATS).amount, 1200);
  assert.equal(parseQuickEntry('1200 petrol', CATS).cat, 'transport');
  const salary = parseQuickEntry('got 5000 salary', CATS);
  assert.equal(salary.amount, 5000);
  assert.equal(salary.type, 'income');
});

test('an incidental year no longer wins over the real amount', () => {
  const r = parseQuickEntry('diwali 2025 shopping 500', CATS);
  assert.equal(r.amount, 500, 'should pick 500, not the year 2025');
});

test('an incidental house/flat number no longer wins over the real amount', () => {
  const r = parseQuickEntry('flat 502 rent 15000', CATS);
  assert.equal(r.amount, 15000, 'should pick 15000, not the flat number 502');
});

test('a currency-marked number is preferred over any other number present', () => {
  assert.equal(parseQuickEntry('2 coffees Rs 500', CATS).amount, 500);
  assert.equal(parseQuickEntry('₹1200 fuel for 3 trips', CATS).amount, 1200);
});

test('category keywords only match whole words, not substrings', () => {
  assert.notEqual(parseQuickEntry('bought cabbage 500', CATS).cat, 'transport');
  assert.notEqual(parseQuickEntry('cola 40', CATS).cat, 'transport');
});

test('a credit-card bill is an expense, not income', () => {
  assert.equal(parseQuickEntry('credit card bill 5000', CATS).type, 'expense');
});

test('"credited"/"credit" used genuinely still reads as income', () => {
  assert.equal(parseQuickEntry('5000 credited to account', CATS).type, 'income');
  assert.equal(parseQuickEntry('credit 500 refund', CATS).type, 'income');
  assert.equal(parseQuickEntry('got 5000 salary', CATS).type, 'income');
});

test('no amount at all is a clean error, not a crash', () => {
  const r = parseQuickEntry('groceries no number here', CATS);
  assert.ok(r.error);
});
