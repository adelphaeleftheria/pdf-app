import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export function parseColor(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
export async function personalize(bytes, fields, values = {}) {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const field of fields) {
    const page = doc.getPage(field.page);
    if (page.getRotation().angle !== 0) throw new Error('Rotated PDF pages are not supported yet. Please upload a PDF with unrotated pages.');
    const value = String(values[field.name] ?? field.value ?? '');
    const lines = value.split(/\r?\n/);
    lines.forEach((text, index) => page.drawText(text, { x: field.x, y: page.getHeight() - field.y - field.size - index * field.size * 1.2, size: field.size, font, color: rgb(...parseColor(field.color)) }));
  }
  return doc.save();
}
