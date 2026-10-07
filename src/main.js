import './style.css';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { personalize } from './pdf.js';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
const $ = id => document.getElementById(id);
let bytes, pdf, pageIndex = 0, scale = 1, fields = [], rows = [], busy = false, selected = null, mode = 'single';
const status = text => $('status').textContent = text;
function save(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function validFields() { const names = fields.map(f => f.name); if (!names.length) throw new Error('Add at least one text field.'); if (names.some(n => !n.trim() || n !== n.trim()) || new Set(names).size !== names.length) throw new Error('Field names must be nonempty and unique.'); }
function controls() { $('add').disabled = !pdf || busy; $('download').disabled = !pdf || !fields.length || busy; $('batch').disabled = !pdf || !fields.length || !rows.length || busy; $('prev').disabled = !pdf || pageIndex === 0 || busy; $('next').disabled = !pdf || pageIndex >= pdf.numPages - 1 || busy; }
async function action(fn) { if (busy) return; busy = true; controls(); try { await fn(); } catch (e) { status(e.message.includes('WinAnsi') ? 'This font does not support one of your characters. Please use Latin text for this version.' : e.message); } finally { busy = false; controls(); } }
function markers() {
  $('overlay').replaceChildren();
  fields.filter(f => f.page === pageIndex).forEach(f => {
    const marker = document.createElement('div'); marker.className = 'marker' + (f === selected ? ' selected' : ''); marker.textContent = f.value || `{${f.name}}`; marker.style.cssText = `left:${f.x * scale}px;top:${f.y * scale}px;font-size:${f.size * scale}px;color:${f.color}`;
    marker.style.fontFamily = f.font === 'Times' ? '"Times New Roman", serif' : f.font === 'Courier' ? '"Courier New", monospace' : 'Arial, sans-serif';
    marker.style.fontWeight = f.bold ? 'bold' : 'normal'; marker.style.fontStyle = f.italic ? 'italic' : 'normal'; marker.style.textDecoration = f.underline ? 'underline' : 'none';
    marker.title = `Drag ${f.name} to move`; marker.addEventListener('pointerdown', e => { e.stopPropagation(); if (busy) return; selected = f; fieldEditor(); document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected')); marker.classList.add('selected'); marker.setPointerCapture(e.pointerId); const startX = e.clientX, startY = e.clientY, x = f.x, y = f.y; marker.onpointermove = event => { f.x = Math.max(0, Math.min($('canvas').width / scale - 5, x + (event.clientX - startX) / scale)); f.y = Math.max(0, Math.min($('canvas').height / scale - f.size, y + (event.clientY - startY) / scale)); marker.style.left = `${f.x * scale}px`; marker.style.top = `${f.y * scale}px`; }; marker.onpointerup = () => { marker.onpointermove = null; }; });
    $('overlay').append(marker);
  }); controls();
}
function current() { return selected; }
function fieldEditor() {
  $('fields').replaceChildren();
  fields.forEach(f => {
    const button = document.createElement('button'); button.className = 'field-chip' + (f === selected ? ' active' : '');
    button.textContent = `${f.value || f.name} · p${f.page + 1}`;
    button.onclick = () => action(async () => { selected = f; if (pageIndex !== f.page) { pageIndex = f.page; await render(); } fieldEditor(); markers(); });
    $('fields').append(button);
  });
  const f = current(); $('editor').hidden = !f;
  if (f) {
    $('text').value = f.value; $('font').value = f.font || 'Helvetica'; $('size').value = f.size; $('color').value = f.color; $('column').value = f.name;
    for (const key of ['bold', 'italic', 'underline']) { $(key).classList.toggle('active', !!f[key]); $(key).setAttribute('aria-pressed', String(!!f[key])); }
  }
  $('column-label').hidden = mode !== 'bulk'; controls();
}
function addField(x, y, source = {}) { let n = 1; while (fields.some(f => f.name === `field_${n}`)) n++; const f = { font: 'Helvetica', bold: false, italic: false, underline: false, value: '', size: 16, color: '#172d43', ...source, name: `field_${n}`, page: pageIndex, x, y }; fields.push(f); selected = f; fieldEditor(); markers(); $('text').focus(); }
for (const [id, key] of [['text','value'], ['font','font'], ['size','size'], ['color','color'], ['column','name']]) $(id).oninput = () => {
  const f = current(); if (!f || busy) return;
  f[key] = key === 'size' ? Math.max(6, Math.min(96, Number($(id).value) || 16)) : $(id).value;
  if (key === 'name') selected = f;
  markers();
  [...$('fields').children].forEach((button, i) => button.textContent = `${fields[i].value || fields[i].name} · p${fields[i].page + 1}`);
};
for (const key of ['bold', 'italic', 'underline']) $(key).onclick = () => { const f = current(); if (!f || busy) return; f[key] = !f[key]; fieldEditor(); markers(); };
$('remove').onclick = () => { if (busy) return; fields = fields.filter(f => f !== selected); selected = fields.at(-1) || null; fieldEditor(); markers(); };
$('duplicate').onclick = () => { const f = current(); if (f && !busy) addField(f.x + 12, f.y + 24, f); };
function setTheme(dark) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('theme').textContent = dark ? 'Light mode' : 'Dark mode'; $('theme').setAttribute('aria-pressed', String(dark)); }
let savedTheme; try { savedTheme = localStorage.getItem('pdf-theme'); } catch {}
setTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
$('theme').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; setTheme(dark); try { localStorage.setItem('pdf-theme', dark ? 'dark' : 'light'); } catch {} };
async function render() {
  const p = await pdf.getPage(pageIndex + 1); const base = p.getViewport({ scale: 1 }); scale = Math.min(1.4, Math.max(220, document.querySelector('article').clientWidth - 40) / base.width); const viewport = p.getViewport({ scale });
  $('canvas').width = viewport.width; $('canvas').height = viewport.height; $('page').style.width = `${viewport.width}px`; $('page').style.height = `${viewport.height}px`;
  await p.render({ canvasContext: $('canvas').getContext('2d'), viewport }).promise; $('empty').hidden = true; $('page').hidden = false; $('page-label').textContent = `Page ${pageIndex + 1} of ${pdf.numPages}`; markers();
}
$('pdf').onchange = () => action(async () => {
  const file = $('pdf').files[0]; if (!file) return;
  const candidate = new Uint8Array(await file.arrayBuffer()); const loaded = await pdfjs.getDocument({ data: candidate.slice() }).promise;
  for (let i = 1; i <= loaded.numPages; i++) if ((await loaded.getPage(i)).rotate !== 0) throw new Error('Rotated pages are not supported yet. Please upload an unrotated PDF.');
  bytes = candidate; pdf = loaded; fields = []; selected = null; rows = []; $('csv').value = ''; $('csv-info').textContent = ''; pageIndex = 0; fieldEditor(); await render(); $('filename').textContent = file.name; status('Click the PDF to place your first text field.');
});
$('overlay').onpointerdown = e => { if (!busy && e.target === $('overlay')) { const rect = $('overlay').getBoundingClientRect(); addField((e.clientX - rect.left) / scale, Math.max(0, (e.clientY - rect.top) / scale)); } };
$('add').onclick = () => addField(50, 50);
$('prev').onclick = () => action(async () => { pageIndex--; await render(); }); $('next').onclick = () => action(async () => { pageIndex++; await render(); });
for (const nextMode of ['single','bulk']) $(`${nextMode}-tab`).onclick = () => { mode = nextMode; fieldEditor(); $('single').hidden = mode !== 'single'; $('bulk').hidden = mode !== 'bulk'; $('single-tab').classList.toggle('active', mode === 'single'); $('bulk-tab').classList.toggle('active', mode === 'bulk'); };
$('download').onclick = () => action(async () => { validFields(); save(await personalize(bytes, fields), 'personalized.pdf', 'application/pdf'); status('Your personalized PDF is ready.'); });
$('sample').onclick = () => { try { validFields(); save(Papa.unparse([Object.fromEntries(fields.map(f => [f.name, f.value || 'Example text']))]), 'template.csv', 'text/csv'); } catch(e) { status(e.message); } };
$('csv').onchange = async () => { rows = []; controls(); const file = $('csv').files[0]; if (!file) return; const result = Papa.parse(await file.text(), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() }); const errors = result.errors.filter(error => error.code !== 'UndetectableDelimiter'); if (errors.length) { status(`CSV error: ${errors[0].message}`); return; } rows = result.data; $('csv-info').textContent = `${rows.length} rows loaded. Columns: ${(result.meta.fields || []).join(', ')}`; controls(); };
$('batch').onclick = () => action(async () => { validFields(); const missing = fields.filter(f => !Object.hasOwn(rows[0], f.name)); if (missing.length) throw new Error(`Missing CSV columns: ${missing.map(f => f.name).join(', ')}`); const zip = new JSZip(); for (let i = 0; i < rows.length; i++) { status(`Creating PDF ${i + 1} of ${rows.length}…`); zip.file(`personalized-${String(i + 1).padStart(4, '0')}.pdf`, await personalize(bytes, fields, rows[i])); } save(await zip.generateAsync({ type: 'uint8array' }), 'personalized-pdfs.zip', 'application/zip'); status(`Created ${rows.length} PDFs in a ZIP file.`); });

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdf && !busy) action(render); }, 150); });
