// Tests for the redaction pass on the parser-feedback export.
//
// This is the one piece of code in the app that produces a file explicitly
// intended to leave the device, so what it strips is a privacy guarantee, not
// a nicety. Each test below asserts a specific class of personal data is gone
// AND that the message still resembles its original template — a redactor that
// destroys the shape produces useless test cases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { redact } from './trainingRedact.js';
import { parseSms } from './smsParse.js';

test('strips balances — a balance discloses net worth', () => {
  const out = redact('Dr INR 4,000.00 - AU A/c X3456 UPI/DR/230209515165/ASHISH SINGH Bal INR 1,429.16');
  assert.ok(!out.includes('1,429.16'), `balance leaked: ${out}`);
  assert.ok(out.includes('<BAL>'));
  // The amount that moved must survive — a test case needs it.
  assert.ok(out.includes('4,000.00'), `transaction amount was destroyed: ${out}`);
});

test('strips every balance phrasing', () => {
  for (const s of [
    'Avl Bal Rs.12,345.00',
    'Available balance is Rs 26,431.55',
    'Avl Lmt Rs 48,701',
    'Outstanding Rs.24,500',
  ]) {
    const out = redact(s);
    assert.ok(/<BAL>/.test(out), `no <BAL> in: ${out}`);
    assert.ok(!/[\d,]{4,}/.test(out.replace(/<[A-Z]+>/g, '')), `figure leaked: ${out}`);
  }
});

test('strips account and card numbers', () => {
  assert.ok(redact('debited from A/c XX1234 on 02-08-26').includes('<ACCT>'));
  assert.ok(!redact('debited from A/c XX1234').includes('1234'));
  assert.ok(!redact('Card XXXXXX7890 used').includes('7890'));
  assert.ok(!redact('A/c no 123456789012 credited').includes('123456789012'));
});

test('strips reference ids', () => {
  assert.ok(!redact('Ref 512345678901. Not you?').includes('512345678901'));
  assert.ok(!redact('Ref NEFT CR-HDFCN52026080112345678 -ACME').includes('HDFCN52026080112345678'));
  assert.ok(!redact('UPI/DR/230209515165/SOMEONE').includes('230209515165'));
});

test('strips phone numbers, including helplines', () => {
  assert.ok(!redact('Fraud? Call 18001200120').includes('18001200120'));
  assert.ok(!redact('Call 9876543210 for help').includes('9876543210'));
});

test('strips the counterparty name on a P2P transfer', () => {
  const out = redact('Dr INR 4,000.00 - AU A/c X3456 UPI/DR/230209515165/ASHISH SINGH Bal INR 1,429.16');
  assert.ok(!out.includes('ASHISH SINGH'), `name leaked: ${out}`);
  assert.ok(out.includes('<NAME>'));
});

test('keeps the UPI provider but drops the handle id', () => {
  const out = redact('paid to VPA ashish.singh@okaxis');
  assert.ok(!out.includes('ashish.singh'), `handle leaked: ${out}`);
  assert.ok(out.includes('@okaxis'), 'provider is a useful parsing signal and should survive');
});

test('keeps merchant names — they are what categorisation is about', () => {
  const out = redact('Rs 1,299.00 spent on your ICICI Bank Credit Card XX9012 at AMAZON on 02-Aug-26');
  assert.ok(out.includes('AMAZON'));
  assert.ok(out.includes('1,299.00'));
});

test('a redacted message still parses the same way', () => {
  // The whole point: the shared file has to reproduce the bug being reported.
  const cases = [
    'Rs.450.00 debited from A/c XX1234 on 02-08-26 to VPA swiggy@ybl. Ref 512345678901.',
    'Rs.12,500.00 debited from A/c XX1234 on 05-08-26 towards EMI for Loan A/c LN12345. Bal Rs.14,000',
    'Rs.2,499.00 will be debited from your A/c XX1234 on 05-Aug-26 towards your NETFLIX subscription.',
    'INR 85,000.00 credited to A/c XX1234 on 01-08-26. Ref NEFT CR-HDFCN52026080112345678 -ACME PVT LTD. Bal INR 92,431.55',
  ];
  for (const body of cases) {
    const before = parseSms(body);
    const after = parseSms(redact(body));
    if (before === null) {
      assert.equal(after, null, `redaction changed a rejection into an import: ${body}`);
      continue;
    }
    assert.ok(after, `redaction broke parsing of: ${redact(body)}`);
    assert.equal(after.type, before.type, `type changed for: ${redact(body)}`);
    assert.equal(after.amount, before.amount, `amount changed for: ${redact(body)}`);
    assert.equal(after.kind, before.kind, `kind changed for: ${redact(body)}`);
  }
});

test('never throws on junk input', () => {
  for (const v of [null, undefined, '', '   ', 12345]) {
    assert.equal(typeof redact(v), 'string');
  }
});
