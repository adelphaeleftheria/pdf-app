import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../src/csv.js';
test('keeps blank cells and all-empty rows without creating an extra row for the ending newline', () => {
  assert.deepEqual(parseCSV('Name,Date\r\nAlice,\r\n,\r\n').data, [{ Name: 'Alice', Date: '' }, { Name: '', Date: '' }]);
  assert.deepEqual(parseCSV('Name\n""\nBob\n').data, [{ Name: '' }, { Name: 'Bob' }]);
  assert.deepEqual(parseCSV('Name\n').data, []);
});
