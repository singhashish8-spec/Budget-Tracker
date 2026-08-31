// Regression test for the CSV export formula-injection guard incorrectly
// treating every expense amount (always a negative number) as a formula-
// injection attempt and turning it into a text cell — which made a
// spreadsheet's own SUM()/AutoSum silently skip every expense, undercounting
// real spending to near zero. This logic used to be duplicated independently
// in exportReport.js and zipExport.js; both now share this module.
// See docs/history/findings.md.
//
// Run with `npm test` (node:test, built into Node 22).

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransactionsCsv, csvCell, csvNumber } from './csvFormat.js';

const CATEGORIES = [{ id: 'food', label: 'Food' }];

function amountCell(csvLine) {
  const cells = csvLine.split(',');
  return cells[cells.length - 1];
}

test('an expense amount is a plain unquoted number, not a formula-guarded text cell', () => {
  const csv = buildTransactionsCsv(
    [{ date: '1 Aug', merchant: 'Swiggy', account: '', cat: 'food', type: 'expense', amount: 450 }],
    CATEGORIES,
  );
  const line = csv.split('\n')[1];
  const cell = amountCell(line);
  assert.equal(cell, '-450', 'should be a bare number, not a quoted string');
  assert.ok(!cell.startsWith('"'), 'must not be quoted as text');
  assert.ok(!cell.includes("'"), 'must not carry the formula-guard apostrophe prefix');
});

test('a whole CSV of expenses and income sums correctly like a spreadsheet would', () => {
  const csv = buildTransactionsCsv(
    [
      { date: '1 Aug', merchant: 'Swiggy', account: '', cat: 'food', type: 'expense', amount: 450 },
      { date: '2 Aug', merchant: 'Rent', account: '', cat: 'food', type: 'expense', amount: 15000 },
      { date: '3 Aug', merchant: 'Salary', account: '', cat: 'food', type: 'income', amount: 50000 },
    ],
    CATEGORIES,
  );
  const lines = csv.replace('﻿', '').split('\n').slice(1); // drop header
  const total = lines.reduce((sum, l) => sum + Number(amountCell(l)), 0);
  assert.equal(total, 34550); // -450 - 15000 + 50000
});

test('a merchant name starting with = is still guarded (real formula-injection risk, unaffected by this fix)', () => {
  const csv = buildTransactionsCsv(
    [{ date: '1 Aug', merchant: '=cmd|"/c calc"!A1', account: '', cat: 'food', type: 'expense', amount: 10 }],
    CATEGORIES,
  );
  const line = csv.split('\n')[1];
  const merchantCell = line.split(',')[1];
  assert.ok(merchantCell.includes("'="), 'a genuinely risky text field must still get the apostrophe guard');
});

test('csvCell/csvNumber directly, for good measure', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('Swiggy'), '"Swiggy"');
  assert.equal(csvNumber(-450), '-450');
  assert.equal(csvNumber(50000), '50000');
});
