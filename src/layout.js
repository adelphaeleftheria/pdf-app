const fail = () => { throw new Error('Invalid layout file. Choose a layout saved by PDF Personalizer.'); };
export function readLayout(data, pages) {
  if (!data || data.type !== 'pdf-personalizer-layout' || data.version !== 1 || !Array.isArray(data.pages) || !Array.isArray(data.fields)) fail();
  if (data.pages.length !== pages.length || data.pages.some((p, i) => !p || Math.abs(p.width - pages[i].width) > 0.1 || Math.abs(p.height - pages[i].height) > 0.1 || !Number.isFinite(p.width) || !Number.isFinite(p.height))) throw new Error('This layout needs a PDF with the same page count and page sizes as the original template.');
  const names = new Set();
  return data.fields.map(f => {
    if (!f || typeof f.name !== 'string' || !f.name.trim() || f.name !== f.name.trim() || names.has(f.name) || typeof f.value !== 'string' || !Number.isInteger(f.page) || !pages[f.page] || !Number.isFinite(f.x) || !Number.isFinite(f.y) || f.x < 0 || f.y < 0 || !Number.isFinite(f.size) || f.size < 6 || f.size > 96 || !/^#[0-9a-f]{6}$/i.test(f.color) || !['Helvetica', 'Times', 'Courier'].includes(f.font) || ['bold', 'italic', 'underline'].some(k => typeof f[k] !== 'boolean')) fail();
    names.add(f.name);
    return Object.fromEntries(['name','value','page','x','y','size','color','font','bold','italic','underline'].map(k => [k, f[k]]));
  });
}
export function createLayout(fields, pages) {
  const data = { type: 'pdf-personalizer-layout', version: 1, pages, fields };
  data.fields = readLayout(data, pages);
  return JSON.stringify(data, null, 2);
}
