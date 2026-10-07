import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchFilename } from '../src/filename.js';
test('combines prefix and CSV value, handles invalid Windows characters and prevents duplicates', () => {
  const used = new Set();
  assert.equal(batchFilename('Certificate_', 'Alice', 0, used), 'Certificate_Alice.pdf');
  assert.equal(batchFilename('Certificate_', 'alice', 1, used), 'Certificate_alice-2.pdf');
  assert.equal(batchFilename('Certificate_', 'A/B:C?', 2, used), 'Certificate_A_B_C_.pdf');
  assert.equal(batchFilename('', '', 3, used), 'personalized-0004.pdf');
  assert.equal(batchFilename('', 'CON', 4, used), '_CON.pdf');
});
