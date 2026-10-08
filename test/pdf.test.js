import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { personalize } from '../src/pdf.js';
test('places single and CSV text on the selected page and preserves the template', async () => {
  const source = await PDFDocument.create(); source.addPage([400, 500]); source.addPage([400, 500]);
  const bytes = await source.save();
  const fields = [{ name: 'Name', value: 'Alice', page: 1, x: 50, y: 60, size: 16, color: '#172d43' }];
  for (const [values, expected] of [[null, 'Alice'], [{ Name: 'Bob' }, 'Bob']]) {
    const result = await personalize(bytes, fields, values);
    const parsed = await getDocument({ data: result.slice(), useSystemFonts: true }).promise;
    assert.equal(parsed.numPages, 2);
    assert.equal((await (await parsed.getPage(1)).getTextContent()).items.length, 0);
    const content = await (await parsed.getPage(2)).getTextContent();
    assert.equal(content.items[0].str, expected);
    assert.equal(content.items[0].transform[4], 50);
    assert.equal(content.items[0].transform[5], 424);
    await parsed.destroy();
  }
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2);
});
test('rejects rotated templates with an actionable message', async () => {
  const doc = await PDFDocument.create(); doc.addPage().setRotation(degrees(90));
  await assert.rejects(personalize(await doc.save(), [{ page: 0, x: 0, y: 0, size: 12, color: '#000000', value: 'Hi' }]), /Rotated/);
});
test('exports every font family with bold and italic and draws multiline underlines', async () => {
  const source = await PDFDocument.create(); source.addPage([500, 600]);
  const { fontName } = await import('../src/pdf.js');
  for (const family of ['Helvetica', 'Times', 'Courier']) {
    for (const bold of [false, true]) for (const italic of [false, true]) {
      const field = { name: 'Name', value: 'First\nSecond', page: 0, x: 30, y: 40, size: 18, color: '#993366', font: family, bold, italic, underline: true };
      const result = await personalize(await source.save(), [field]);
      const parsed = await getDocument({ data: result.slice(), useSystemFonts: true }).promise;
      const page = await parsed.getPage(1);
      const content = await page.getTextContent();
      assert.deepEqual(content.items.filter(i => i.str).map(i => i.str), ['First', 'Second']);
      assert.ok(Object.values(content.styles).some(style => style.fontFamily));
      const loaded = await PDFDocument.load(result);
      const fontResources = loaded.getPage(0).node.Resources().lookup((await import('pdf-lib')).PDFName.of('Font'));
      const { PDFName } = await import('pdf-lib');
      const embeddedFont = fontResources.lookup(fontResources.keys()[0]);
      assert.equal(embeddedFont.get(PDFName.of('BaseFont')).decodeText(), fontName(field));
      assert.match(fontName(field), new RegExp(family === 'Times' ? 'Times' : family));
      const ops = await page.getOperatorList();
      assert.ok(ops.fnArray.includes((await import('pdfjs-dist/legacy/build/pdf.mjs')).OPS.constructPath), 'underline drawing instructions exist');
      await parsed.destroy();
    }
  }
});

test('empty and missing CSV values never fall back to placeholder text', async () => {
  const source = await PDFDocument.create(); source.addPage();
  const field = { name: 'Name', value: 'Placeholder', page: 0, x: 20, y: 20, size: 16, color: '#000000', underline: true };
  for (const values of [{ Name: '' }, { Name: null }, {}]) {
    const result = await personalize(await source.save(), [field], values);
    const parsed = await getDocument({ data: result }).promise;
    const content = await (await parsed.getPage(1)).getTextContent();
    assert.equal(content.items.length, 0);
    await parsed.destroy();
  }
});
test('editable export contains writable fields, preserves existing forms and permits later edits', async () => {
  const source = await PDFDocument.create(); const page = source.addPage([500, 600]);
  const existing = source.getForm().createTextField('Name'); existing.setText('Original'); existing.addToPage(page);
  const field = { name: 'Name', value: 'Alice', page: 0, x: 30, y: 70, size: 18, color: '#112233', font: 'Times', bold: true, italic: true };
  const result = await personalize(await source.save(), [field], null, { mode: 'editable' });
  const loaded = await PDFDocument.load(result); const form = loaded.getForm();
  assert.equal(form.getTextField('Name').getText(), 'Original');
  const added = form.getTextField('Name_2'); assert.equal(added.getText(), 'Alice'); assert.equal(added.isReadOnly(), false);
  assert.equal(added.acroField.getWidgets().length, 1);
  added.setText('Changed later');
  const reopened = await PDFDocument.load(await loaded.save());
  assert.equal(reopened.getForm().getTextField('Name_2').getText(), 'Changed later');
});
test('editable CSV blank stays empty but remains a fillable field', async () => {
  const source = await PDFDocument.create(); source.addPage();
  const field = { name: 'Name', value: 'Example', page: 0, x: 20, y: 20, size: 16, color: '#000000' };
  const result = await personalize(await source.save(), [field], { Name: '' }, { mode: 'editable' });
  const loaded = await PDFDocument.load(result); const blank = loaded.getForm().getTextField('Name');
  assert.equal(blank.getText() ?? '', ''); assert.equal(blank.isReadOnly(), false);
});
