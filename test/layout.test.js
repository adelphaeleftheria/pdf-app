import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLayout, readLayout } from '../src/layout.js';
const pages = [{ width: 500, height: 600 }, { width: 500, height: 600 }];
const fields = [{ name: 'Name', value: 'Example\nName', page: 1, x: 50.5, y: 72, size: 18, color: '#112233', font: 'Times', bold: true, italic: true, underline: true }];
test('saved layout restores positions, pages, CSV names, text and formatting exactly', () => {
  assert.deepEqual(readLayout(JSON.parse(createLayout(fields, pages)), pages), fields);
});
test('rejects incompatible PDF dimensions and invalid fields without changing the original layout', () => {
  const data = JSON.parse(createLayout(fields, pages));
  assert.throws(() => readLayout(data, [pages[0]]), /same page count/);
  assert.throws(() => readLayout(data, [{ width: 400, height: 600 }, pages[1]]), /same page count/);
  for (const changes of [{ page: 8 }, { font: 'invalid' }, { x: null }, { size: -2 }, { color: 'invalid' }]) {
    assert.throws(() => readLayout({ ...data, fields: [{ ...fields[0], ...changes }] }, pages), /Invalid layout/);
  }
  assert.throws(() => readLayout({ ...data, fields: [fields[0], fields[0]] }, pages), /Invalid layout/);
  assert.deepEqual(data.fields, fields);
});
