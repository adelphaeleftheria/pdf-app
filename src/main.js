import './style.css';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { personalize } from './pdf.js';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
const $ = id => document.getElementById(id);
let bytes, pdf, pageIndex = 0, scale = 1, fields = [], rows = [], busy = false;
const status = text => $('status').textContent = text;
function save(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function validFields() { const names = fields.map(f => f.name.trim()); if (!names.length) throw new Error('Add at least one text field.'); if (names.some(n => !n) || new Set(names).size !== names.length) throw new Error('Field names must be nonempty and unique.'); }
function controls() { $('add').disabled = !pdf || busy; $('download').disabled = !pdf || !fields.length || busy; $('batch').disabled = !pdf || !fields.length || !rows.length || busy; $('prev').disabled = !pdf || pageIndex === 0 || busy; $('next').disabled = !pdf || pageIndex >= pdf.numPages - 1 || busy; }
async function action(fn) { if (busy) return; busy = true; controls(); try { await fn(); } catch (e) { status(e.message.includes('WinAnsi') ? 'This font does not support one of your characters. Please use Latin text for this version.' : e.message); } finally { busy = false; controls(); } }
function markers() {
  $('overlay').replaceChildren();
  fields.filter(f => f.page === pageIndex).forEach(f => {
    const marker = document.createElement('div'); marker.className = 'marker'; marker.textContent = f.value || `{${f.name}}`; marker.style.cssText = `left:${f.x * scale}px;top:${f.y * scale}px;font-size:${f.size * scale}px;color:${f.color}`;
    marker.title = `Drag ${f.name} to move`; marker.addEventListener('pointerdown', e => { e.stopPropagation(); marker.setPointerCapture(e.pointerId); const startX = e.clientX, startY = e.clientY, x = f.x, y = f.y; marker.onpointermove = event => { f.x = Math.max(0, Math.min($('canvas').width / scale - 5, x + (event.clientX - startX) / scale)); f.y = Math.max(0, Math.min($('canvas').height / scale - f.size, y + (event.clientY - startY) / scale)); marker.style.left = `${f.x * scale}px`; marker.style.top = `${f.y * scale}px`; }; marker.onpointerup = () => { marker.onpointermove = null; }; });
    $('overlay').append(marker);
  }); controls();
}
function fieldEditor() {
  $('fields').replaceChildren();
  fields.forEach(f => {
    const box = document.createElement('div'); box.className = 'field';
    const title = document.createElement('div'); title.className = 'field-title'; title.textContent = `Page ${f.page + 1}`;
    const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.onclick = () => { fields = fields.filter(item => item !== f); fieldEditor(); markers(); }; title.append(remove); box.append(title);
    for (const [key, label, type] of [['name','Field / CSV column','text'],['value','Text','text'],['size','Font size','number'],['color','Text color','color']]) {
      const wrap = document.createElement('label'); wrap.textContent = label; const input = document.createElement('input'); input.type = type; input.value = f[key]; if (key === 'size') { input.min = 6; input.max = 96; }
      input.oninput = () => { f[key] = key === 'size' ? Math.max(6, Math.min(96, Number(input.value) || 12)) : input.value; markers(); }; wrap.append(input); box.append(wrap);
    }
    $('fields').append(box);
  }); controls();
}
function addField(x, y) { let n = 1; while (fields.some(f => f.name === `field_${n}`)) n++; fields.push({ name: `field_${n}`, value: '', page: pageIndex, x, y, size: 16, color: '#172d43' }); fieldEditor(); markers(); }
async function render() {
  const p = await pdf.getPage(pageIndex + 1); const base = p.getViewport({ scale: 1 }); scale = Math.min(1.4, 760 / base.width); const viewport = p.getViewport({ scale });
  $('canvas').width = viewport.width; $('canvas').height = viewport.height; $('page').style.width = `${viewport.width}px`; $('page').style.height = `${viewport.height}px`;
  await p.render({ canvasContext: $('canvas').getContext('2d'), viewport }).promise; $('empty').hidden = true; $('page').hidden = false; $('page-label').textContent = `Page ${pageIndex + 1} of ${pdf.numPages}`; markers();
}
$('pdf').onchange = () => action(async () => {
  const file = $('pdf').files[0]; if (!file) return;
  const candidate = new Uint8Array(await file.arrayBuffer()); const loaded = await pdfjs.getDocument({ data: candidate.slice() }).promise;
  for (let i = 1; i <= loaded.numPages; i++) if ((await loaded.getPage(i)).rotate !== 0) throw new Error('Rotated pages are not supported yet. Please upload an unrotated PDF.');
  bytes = candidate; pdf = loaded; fields = []; pageIndex = 0; fieldEditor(); await render(); $('filename').textContent = file.name; status('Click the PDF to place your first text field.');
});
$('overlay').onpointerdown = e => { if (!busy && e.target === $('overlay')) { const rect = $('overlay').getBoundingClientRect(); addField((e.clientX - rect.left) / scale, Math.max(0, (e.clientY - rect.top) / scale)); } };
$('add').onclick = () => addField(50, 50);
$('prev').onclick = () => action(async () => { pageIndex--; await render(); }); $('next').onclick = () => action(async () => { pageIndex++; await render(); });
for (const mode of ['single','bulk']) $(`${mode}-tab`).onclick = () => { $('single').hidden = mode !== 'single'; $('bulk').hidden = mode !== 'bulk'; $('single-tab').classList.toggle('active', mode === 'single'); $('bulk-tab').classList.toggle('active', mode === 'bulk'); };
$('download').onclick = () => action(async () => { validFields(); save(await personalize(bytes, fields), 'personalized.pdf', 'application/pdf'); status('Your personalized PDF is ready.'); });
$('sample').onclick = () => { try { validFields(); save(Papa.unparse([Object.fromEntries(fields.map(f => [f.name, f.value || 'Example text']))]), 'template.csv', 'text/csv'); } catch(e) { status(e.message); } };
$('csv').onchange = async () => { rows = []; controls(); const file = $('csv').files[0]; if (!file) return; const result = Papa.parse(await file.text(), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() }); if (result.errors.length) { status(`CSV error: ${result.errors[0].message}`); return; } rows = result.data; $('csv-info').textContent = `${rows.length} rows loaded. Columns: ${(result.meta.fields || []).join(', ')}`; controls(); };
$('batch').onclick = () => action(async () => { validFields(); const missing = fields.filter(f => !Object.hasOwn(rows[0], f.name)); if (missing.length) throw new Error(`Missing CSV columns: ${missing.map(f => f.name).join(', ')}`); const zip = new JSZip(); for (let i = 0; i < rows.length; i++) { status(`Creating PDF ${i + 1} of ${rows.length}…`); zip.file(`personalized-${String(i + 1).padStart(4, '0')}.pdf`, await personalize(bytes, fields, rows[i])); } save(await zip.generateAsync({ type: 'uint8array' }), 'personalized-pdfs.zip', 'application/zip'); status(`Created ${rows.length} PDFs in a ZIP file.`); });
