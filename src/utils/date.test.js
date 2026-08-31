// Regression test for the month-end date-overflow bug: adding months to a
// date via the naive `d.setMonth(d.getMonth() + n)` pattern lets the day
// overflow into the following month whenever the target month is shorter
// (Jan 31 + 1 month rolled into Mar 3 instead of landing on Feb 28/29) —
// this threw off both warranty-expiry and EMI-payoff dates for anything
// starting on the 29th-31st. See docs/history/findings.md.
//
// Run with `npm test` (node:test, built into Node 22).

import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonthsClamped } from './date.js';

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('Jan 31 + 1 month clamps to the end of February (non-leap year)', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2026, 0, 31), 1)), '2026-02-28');
});

test('Jan 31 + 1 month clamps to Feb 29 in a leap year', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2024, 0, 31), 1)), '2024-02-29');
});

test('a mid-month date is unaffected — no clamping needed', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2026, 0, 15), 1)), '2026-02-15');
});

test('a date landing on a 30-day month clamps correctly (31st -> 30th)', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2026, 0, 31), 3)), '2026-04-30'); // Jan 31 + 3mo -> April (30 days)
});

test('a plain, non-edge addition still works normally', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2026, 5, 5), 4)), '2026-10-05');
});

test('crossing a year boundary works correctly', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2026, 10, 30), 3)), '2027-02-28'); // Nov 30 + 3mo -> Feb 2027 (28 days)
});

test('adding zero months returns the same day', () => {
  assert.equal(ymd(addMonthsClamped(new Date(2026, 0, 31), 0)), '2026-01-31');
});
