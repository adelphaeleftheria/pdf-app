export function batchFilename(prefix, value, rowIndex, used) {
  const raw = `${prefix}${value ?? ''}`.normalize('NFC');
  let base = raw.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').trim().replace(/[. ]+$/, '').slice(0, 150).replace(/[. ]+$/, '');
  if (!base) base = `personalized-${String(rowIndex + 1).padStart(4, '0')}`;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `_${base}`;
  let name = `${base}.pdf`, suffix = 2;
  while (used.has(name.toLowerCase())) name = `${base}-${suffix++}.pdf`;
  used.add(name.toLowerCase());
  return name;
}
