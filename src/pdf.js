import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { addMovableText } from './annotation.js';
export function parseColor(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
export function fontName(field) {
  if (field.font === 'Times') return field.bold ? (field.italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : (field.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman);
  const family = field.font === 'Courier' ? 'Courier' : 'Helvetica';
  return StandardFonts[family + (field.bold ? (field.italic ? 'BoldOblique' : 'Bold') : (field.italic ? 'Oblique' : ''))];
}
export async function personalize(bytes, fields, values = null, options = {}) {
  const doc = await PDFDocument.load(bytes);
  const fonts = new Map();
  const editable = options.mode === 'editable';
  const form = editable ? doc.getForm() : null;
  const usedNames = new Set(form ? form.getFields().map(f => f.getName()) : []);
  for (const field of fields) {
    const name = fontName(field);
    if (!fonts.has(name)) fonts.set(name, await doc.embedFont(name));
    const font = fonts.get(name);
    const page = doc.getPage(field.page);
    if (page.getRotation().angle !== 0) throw new Error('Rotated PDF pages are not supported yet. Please upload a PDF with unrotated pages.');
    const value = String(values === null ? (field.value ?? '') : (values[field.name] ?? ''));
    if (options.mode === 'movable') {
      if (value) addMovableText(doc, page, field, value, font, parseColor(field.color));
      continue;
    }
    if (editable) {
      let fieldName = field.name, suffix = 2;
      while (usedNames.has(fieldName) || [...usedNames].some(existing => existing.startsWith(fieldName + '.') || fieldName.startsWith(existing + '.'))) fieldName = `${field.name.replaceAll('.', '_')}_${suffix++}`;
      usedNames.add(fieldName);
      const textField = form.createTextField(fieldName);
      const lines = value.split(/\r?\n/);
      const width = Math.min(page.getWidth() - field.x, Math.max(180, ...lines.map(line => font.widthOfTextAtSize(line, field.size) + 6)));
      const height = Math.min(page.getHeight() - field.y, Math.max(field.size * 1.5, lines.length * field.size * 1.2 + 6));
      if (width <= 2 || height < field.size) throw new Error(`Move ${field.name} further inside the page to create an editable field.`);
      if (lines.length > 1) textField.enableMultiline();
      textField.setText(value);
      textField.addToPage(page, { x: field.x - 1, y: page.getHeight() - field.y - height, width, height, font, textColor: rgb(...parseColor(field.color)), borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
      textField.setFontSize(field.size);
      textField.updateAppearances(font);
      continue;
    }
    if (!value) continue;
    const lines = value.split(/\r?\n/);
    lines.forEach((text, index) => {
      const y = page.getHeight() - field.y - field.size - index * field.size * 1.2;
      const color = rgb(...parseColor(field.color));
      page.drawText(text, { x: field.x, y, size: field.size, font, color });
      if (field.underline && text) page.drawLine({ start: { x: field.x, y: y - field.size * 0.12 }, end: { x: field.x + font.widthOfTextAtSize(text, field.size), y: y - field.size * 0.12 }, thickness: Math.max(0.5, field.size / 18), color });
    });
  }
  return doc.save();
}
