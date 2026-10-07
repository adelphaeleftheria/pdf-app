import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export function parseColor(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
export function fontName(field) {
  if (field.font === 'Times') return field.bold ? (field.italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : (field.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman);
  const family = field.font === 'Courier' ? 'Courier' : 'Helvetica';
  return StandardFonts[family + (field.bold ? (field.italic ? 'BoldOblique' : 'Bold') : (field.italic ? 'Oblique' : ''))];
}
export async function personalize(bytes, fields, values = {}) {
  const doc = await PDFDocument.load(bytes);
  const fonts = new Map();
  for (const field of fields) {
    const name = fontName(field);
    if (!fonts.has(name)) fonts.set(name, await doc.embedFont(name));
    const font = fonts.get(name);
    const page = doc.getPage(field.page);
    if (page.getRotation().angle !== 0) throw new Error('Rotated PDF pages are not supported yet. Please upload a PDF with unrotated pages.');
    const value = String(values[field.name] ?? field.value ?? '');
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
