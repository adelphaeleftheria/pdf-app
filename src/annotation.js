import { PDFString, PDFHexString } from 'pdf-lib';
export function addMovableText(doc, page, field, value, font, color) {
  const lines = value.split(/\r?\n/);
  const width = Math.max(24, ...lines.map(line => font.widthOfTextAtSize(line, field.size) + 6));
  const height = lines.length * field.size * 1.2 + 4;
  const x = field.x, y = page.getHeight() - field.y - height;
  const commands = ['q', `${color.join(' ')} rg`, `${color.join(' ')} RG`];
  lines.forEach((line, i) => {
    const baseline = height - field.size - i * field.size * 1.2;
    commands.push(`BT /F0 ${field.size} Tf 1 0 0 1 0 ${baseline} Tm ${font.encodeText(line)} Tj ET`);
    if (field.underline && line) commands.push(`${Math.max(0.5, field.size / 18)} w 0 ${baseline - field.size * 0.12} m ${font.widthOfTextAtSize(line, field.size)} ${baseline - field.size * 0.12} l S`);
  });
  commands.push('Q');
  const appearance = doc.context.register(doc.context.flateStream(commands.join('\n'), {
    Type: 'XObject', Subtype: 'Form', BBox: [0, 0, width, height],
    Resources: { Font: { F0: font.ref } },
  }));
  const annotation = doc.context.obj({
    Type: 'Annot', Subtype: 'FreeText', Rect: [x, y, x + width, y + height],
    Contents: PDFHexString.fromText(value), T: PDFHexString.fromText('PDF Personalizer'),
    NM: PDFHexString.fromText(`personalizer-${field.page}-${page.node.Annots()?.size() || 0}`),
    DA: PDFString.of(`/F0 ${field.size} Tf ${color.join(' ')} rg`),
    DS: PDFString.of(`font: ${field.italic ? 'italic ' : ''}${field.bold ? 'bold ' : ''}${field.size}pt "${field.font === 'Times' ? 'Times New Roman' : field.font === 'Courier' ? 'Courier' : 'Helvetica'}"; color: ${field.color};`),
    Q: 0, F: 4, Border: [0, 0, 0], C: [], AP: { N: appearance }, P: page.ref,
  });
  page.node.addAnnot(doc.context.register(annotation));
}
