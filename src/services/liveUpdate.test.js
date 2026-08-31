// Regression test for the OTA update-check comparing versions by plain
// equality ("is this different?") instead of "is this actually newer?" — a
// rolled-back or corrupted manifest publish would look like a valid update
// to every device already on the newer version, and get silently
// downgraded. See docs/history/findings.md.
//
// Run with `npm test` (node:test, built into Node 22).

import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion } from './liveUpdate.js';

test('a genuinely newer version is recognized as newer', () => {
  assert.equal(isNewerVersion('1.7.1', '1.7.0'), true);
  assert.equal(isNewerVersion('1.8.0', '1.7.9'), true);
  assert.equal(isNewerVersion('2.0.0', '1.9.9'), true);
});

test('multi-digit segments compare numerically, not lexicographically', () => {
  assert.equal(isNewerVersion('1.10.0', '1.9.0'), true, '1.10.0 must read as newer than 1.9.0');
  assert.equal(isNewerVersion('1.9.0', '1.10.0'), false);
});

test('an older or rolled-back publish is not treated as an update', () => {
  assert.equal(isNewerVersion('1.6.0', '1.7.0'), false, 'must not silently downgrade');
  assert.equal(isNewerVersion('1.7.0', '1.7.0'), false, 'identical version is not an update');
});

test('no OTA bundle downloaded yet ("builtin") always accepts the published version', () => {
  assert.equal(isNewerVersion('1.0.0', 'builtin'), true);
});
