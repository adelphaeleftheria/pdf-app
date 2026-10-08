import './style.css';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { personalize } from './pdf.js';
import { createLayout, readLayout } from './layout.js';
import { parseCSV } from './csv.js';
import { batchFilename } from './filename.js';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
const $ = id => document.getElementById(id);
let bytes, pdf, pageIndex = 0, scale = 1, fields = [], rows = [], busy = false, selected = null, mode = 'single';
let savedSet = null;
try { const raw = localStorage.getItem('pdf-saved-set'); if (raw) savedSet = JSON.parse(raw); } catch {}
const status = text => $('status').textContent = text;
function save(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function validFields() { const names = fields.map(f => f.name); if (!names.length) throw new Error('Add at least one text field.'); if (names.some(n => !n.trim() || n !== n.trim()) || new Set(names).size !== names.length) throw new Error('Field names must be nonempty and unique.'); }
function controls() { $('reuse-set').disabled = !pdf || !savedSet || busy; $('save-layout').disabled = !pdf || !fields.length || busy; $('load-layout').disabled = !pdf || busy; $('add').disabled = !pdf || busy; $('download').disabled = !pdf || !fields.length || busy; $('batch').disabled = !pdf || !fields.length || !rows.length || busy; $('prev').disabled = !pdf || pageIndex === 0 || busy; $('next').disabled = !pdf || pageIndex >= pdf.numPages - 1 || busy; }
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
  let restored = [], note = 'Click the PDF to place your first text field.';
  if (fields.length) {
    // Validate before replacing the document so a mismatch cannot discard current work.
    try { restored = readLayout(JSON.parse(createLayout(fields, await pageSizes())), await pageSizes(loaded)); }
    catch (error) { await loaded.destroy(); throw new Error('Your current set was kept. Choose a PDF with matching page count and sizes to reuse it. ' + error.message); }
    note = `Reused all ${restored.length} placeholders on the new PDF. CSV data was kept too.`;
  } else if (savedSet) {
    try { restored = readLayout(savedSet, await pageSizes(loaded)); applyFilenameSettings(savedSet); note = `Restored all ${restored.length} placeholders from your saved set.`; }
    catch { note = 'PDF loaded. Your saved set is still available, but needs matching page count and sizes.'; }
  }
  const previousPDF = pdf;
  bytes = candidate; pdf = loaded; fields = restored; selected = fields[0] || null; pageIndex = selected?.page || 0;
  fieldEditor(); await render(); $('filename').textContent = file.name; status(note);
  if (previousPDF) await previousPDF.destroy();
});
$('overlay').onpointerdown = e => { if (!busy && e.target === $('overlay')) { const rect = $('overlay').getBoundingClientRect(); addField((e.clientX - rect.left) / scale, Math.max(0, (e.clientY - rect.top) / scale)); } };
$('add').onclick = () => addField(50, 50);
$('prev').onclick = () => action(async () => { pageIndex--; await render(); }); $('next').onclick = () => action(async () => { pageIndex++; await render(); });
for (const nextMode of ['single','bulk']) $(`${nextMode}-tab`).onclick = () => { mode = nextMode; fieldEditor(); $('single').hidden = mode !== 'single'; $('bulk').hidden = mode !== 'bulk'; $('single-tab').classList.toggle('active', mode === 'single'); $('bulk-tab').classList.toggle('active', mode === 'bulk'); };
$('download').onclick = () => action(async () => { validFields(); save(await personalize(bytes, fields, null, { mode: $('export-mode').value }), 'personalized.pdf', 'application/pdf'); status('Your personalized PDF is ready.'); });
$('sample').onclick = () => { try { validFields(); save(Papa.unparse([Object.fromEntries(fields.map(f => [f.name, f.value || 'Example text']))]), 'template.csv', 'text/csv'); } catch(e) { status(e.message); } };
$('csv').onchange = async () => { rows = []; $('csv-info').textContent = ''; filenameOptions([]); controls(); const file = $('csv').files[0]; if (!file) return; let result; try { result = parseCSV(await file.text()); } catch (error) { status(error.message); return; } rows = result.data; filenameOptions(result.meta.fields || []); $('csv-info').textContent = `${rows.length} rows loaded. Columns: ${(result.meta.fields || []).join(', ')}`; controls(); };
$('batch').onclick = () => action(async () => { validFields(); const missing = fields.filter(f => !Object.hasOwn(rows[0], f.name)); if (missing.length) throw new Error(`Missing CSV columns: ${missing.map(f => f.name).join(', ')}`); const zip = new JSZip(); const used = new Set(); for (let i = 0; i < rows.length; i++) { status(`Creating PDF ${i + 1} of ${rows.length}…`); const column = $('filename-column').value; const value = column ? rows[i][column] : String(i + 1).padStart(4, '0'); zip.file(batchFilename($('filename-prefix').value, value, i, used), await personalize(bytes, fields, rows[i], { mode: $('export-mode').value })); } save(await zip.generateAsync({ type: 'uint8array' }), 'personalized-pdfs.zip', 'application/zip'); status(`Created ${rows.length} PDFs in a ZIP file.`); });

let preferredFilenameColumn = '';
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdf && !busy) action(render); }, 150); });

async function pageSizes(document = pdf) {
  const pages = [];
  for (let i = 1; i <= document.numPages; i++) {
    const viewport = (await document.getPage(i)).getViewport({ scale: 1 });
    pages.push({ width: viewport.width, height: viewport.height });
  }
  return pages;
}
$('save-layout').onclick = () => action(async () => {
  validFields();
  const layout = JSON.parse(createLayout(fields, await pageSizes()));
  layout.exportMode = $('export-mode').value;
  layout.filename = { prefix: $('filename-prefix').value, column: preferredFilenameColumn || $('filename-column').value };
  const persisted = rememberSet(layout);
  save(JSON.stringify(layout, null, 2), 'pdf-layout.json', 'application/json');
  status(`Saved all ${fields.length} placeholders and filename settings. ${persisted ? 'They will restore automatically when you upload a compatible PDF next time.' : 'Browser storage is unavailable; keep the downloaded set file for reuse.'}`);
});
$('load-layout').onclick = () => $('layout-file').click();
$('layout-file').onchange = () => action(async () => {
  const file = $('layout-file').files[0];
  $('layout-file').value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Cannot read this layout. Choose a valid PDF Personalizer JSON file.'); }
  const restored = readLayout(data, await pageSizes());
  if (fields.length && !window.confirm('Replace the current text fields with this saved layout?')) return;
  applyFilenameSettings(data); rememberSet(data);
  fields = restored; selected = fields[0] || null; pageIndex = selected?.page || 0;
  fieldEditor(); await render();
  status(`Loaded ${fields.length} text fields. Positions, text, CSV names, and formatting restored.`);
});

function filenameOptions(columns) {
  const previous = preferredFilenameColumn || $('filename-column').value;
  $('filename-column').replaceChildren(new Option('Row number', ''));
  for (const column of columns) $('filename-column').add(new Option(column, column));
  if (columns.includes(previous)) $('filename-column').value = previous;
  filenamePreview();
}
function filenamePreview() {
  const column = $('filename-column').value;
  const value = column ? rows[0]?.[column] ?? '' : '0001';
  $('filename-preview').textContent = 'Example: ' + batchFilename($('filename-prefix').value, value, 0, new Set());
}
$('filename-prefix').oninput = filenamePreview;
$('filename-column').onchange = () => { preferredFilenameColumn = $('filename-column').value; filenamePreview(); };

function rememberSet(data) {
  savedSet = data;
  try { localStorage.setItem('pdf-saved-set', JSON.stringify(data)); return true; } catch { return false; }
}
function applyFilenameSettings(data) {
  if (['regular', 'editable'].includes(data.exportMode)) { $('export-mode').value = data.exportMode; exportHelp(); }
  if (data.filename && typeof data.filename.prefix === 'string' && typeof data.filename.column === 'string') {
    $('filename-prefix').value = data.filename.prefix; preferredFilenameColumn = data.filename.column;
    filenameOptions(rows.length ? Object.keys(rows[0]) : []);
  }
}
$('reuse-set').onclick = () => action(async () => {
  const restored = readLayout(savedSet, await pageSizes());
  if (fields.length && !window.confirm('Replace all current placeholders with the entire saved set?')) return;
  fields = restored; selected = fields[0] || null; pageIndex = selected?.page || 0;
  applyFilenameSettings(savedSet); fieldEditor(); await render();
  status(`Reused the entire set: ${fields.length} placeholders.`);
});
controls();

function exportHelp() {
  const editable = $('export-mode').value === 'editable';
  $('export-help').textContent = editable ? 'Creates fillable fields you can change later in Acrobat or a compatible PDF viewer. Font, bold, italic, size and color are kept; underline is available only with regular text.' : 'Adds text to the PDF page, including underline. Changing it later requires a PDF content editor.';
}
$('export-mode').onchange = exportHelp;
