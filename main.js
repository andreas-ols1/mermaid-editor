import mermaid from 'mermaid';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import { registerMermaid } from './mermaid-language.js';
import { registerOneDarkPro } from './one-dark-pro.js';
import { registerCompletions } from './completions/index.js';
// Register icon packs here. Autocomplete uses the same list.
// Each pack is a loader that fetches the (large) JSON on first use, then reuses it.
const once = (f) => { let p; return () => (p ??= f()); };
const packs = {
  logos: once(() => import('@iconify-json/logos/icons.json').then((m) => m.default)),
  mdi: once(() => import('@iconify-json/mdi/icons.json').then((m) => m.default)),
};
mermaid.registerIconPacks(Object.entries(packs).map(([name, loader]) => ({ name, loader })));

// Theme: saved choice first, otherwise the OS setting.
let dark = (localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default' });
document.documentElement.dataset.theme = dark ? 'dark' : 'light';

const DEFAULT = `architecture-beta
    group api(cloud)[Backend]

    service client(internet)[Client]
    service gw(logos:aws-api-gateway)[API Gateway] in api
    service users(server)[User Service] in api
    service db(database)[Database] in api

    client:R --> L:gw
    gw:R --> L:users
    users:B --> T:db
`;

const out = document.getElementById('out');
const stage = document.getElementById('stage');
const msg = document.getElementById('msg');

// Monaco needs a worker. Only the base editor worker is used (no language workers).
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

registerMermaid(monaco);
registerOneDarkPro(monaco);
registerCompletions(monaco, packs);

const editor = monaco.editor.create(document.getElementById('src'), {
  value: localStorage.getItem('diagram') ?? DEFAULT,
  language: 'mermaid',
  theme: dark ? 'one-dark-pro' : 'vs',
  automaticLayout: true,
  wordBasedSuggestions: 'off', // only our own suggestions, no random words from the text
  quickSuggestions: { other: true, comments: true, strings: true }, // the tokenizer marks YAML values as strings
  minimap: { enabled: false },
  fontSize: 14,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  padding: { top: 12, bottom: 12 },
});

// --- Error markers ---------------------------------------------------------
// Mermaid errors name a line (and often a column). Show a red squiggle there.
// Errors without a line (for example layout errors) show only in the preview.
function errorLocation(e, text) {
  let line, column;
  const loc = e?.hash?.loc; // errors from the jison parsers (flowchart, sequence, ...)
  if (loc?.first_line) {
    line = loc.first_line;
    column = (loc.first_column ?? 0) + 1;
  } else {
    const m = /line (\d+)(?:,? column (\d+))?/i.exec(e?.message ?? '');
    if (!m) return null;
    line = Number(m[1]);
    column = m[2] ? Number(m[2]) : undefined;
  }
  // Mermaid counts lines after it removes the frontmatter block, so add that offset back.
  const fm = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  if (fm) line += fm[0].split('\n').length - 1;
  return { line, column };
}

function showMarker(e, text) {
  const model = editor.getModel();
  const at = errorLocation(e, text);
  if (!at || at.line < 1 || at.line > model.getLineCount()) return clearMarkers();
  const lineMax = model.getLineMaxColumn(at.line);
  const startColumn = Math.min(at.column ?? model.getLineFirstNonWhitespaceColumn(at.line) ?? 1, lineMax);
  const word = model.getWordAtPosition({ lineNumber: at.line, column: startColumn });
  monaco.editor.setModelMarkers(model, 'mermaid', [{
    severity: monaco.MarkerSeverity.Error,
    message: e.message.split('\n').filter((l) => !/^[-\s]*\^?$/.test(l)).join('\n'),
    startLineNumber: at.line,
    startColumn,
    endLineNumber: at.line,
    endColumn: at.column ? Math.max(word?.endColumn ?? startColumn + 1, startColumn + 1) : lineMax,
  }]);
}

function clearMarkers() {
  monaco.editor.setModelMarkers(editor.getModel(), 'mermaid', []);
}

let n = 0;
let timer;
let fitted = false;
async function render() {
  const ticket = ++n;
  const id = 'g' + ticket;
  const text = editor.getValue();
  // A newer edit or render (for example a theme toggle) exists, skip this result.
  const stale = () => ticket !== n || text !== editor.getValue();
  try {
    await mermaid.parse(text);
    const { svg } = await mermaid.render(id, text);
    if (stale()) return;
    msg.textContent = '';
    clearMarkers();
    stage.innerHTML = svg;
    stage.classList.remove('stale');
    prepareSvg();
    if (!fitted) { fit(); fitted = true; } // fit only the first time, so edits keep your zoom
  } catch (e) {
    if (stale()) return;
    stage.classList.add('stale'); // keep the last good diagram, dimmed, while the text has errors
    msg.textContent = e.message;
    showMarker(e, text);
  } finally {
    // Mermaid can leave a temp container (or an error "bomb" icon) in <body>.
    // Do not remove #id itself: after a good render it is the SVG in #out.
    document.getElementById('d' + id)?.remove();
  }
}

editor.onDidChangeModelContent(() => {
  localStorage.setItem('diagram', editor.getValue());
  clearTimeout(timer);
  timer = setTimeout(render, 250);
});
render();

// --- Copy / download -------------------------------------------------------
// Copy puts a PNG image on the clipboard. Download saves an SVG file.
function getSvg() {
  const svg = out.querySelector('svg');
  if (!svg) return null;
  const { width, height } = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true);
  clone.removeAttribute('style');
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { xml: new XMLSerializer().serializeToString(clone), width, height };
}

async function svgToPng({ xml, width, height }, scale = 2) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = dark ? '#282c34' : '#fff'; // same as the page background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}

const ICONS = {
  copy: 'M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12z',
  download: 'M5 20h14v-2H5m14-9h-4V3H9v6H5l7 7z',
  svg: 'M5.13 10.71h3.74L6.22 8.06c-1.01 0-1.83-.82-1.83-1.84a1.83 1.83 0 0 1 1.83-1.83c1.02 0 1.84.82 1.84 1.83l2.65 2.65V5.13a1.84 1.84 0 0 1 0-2.59a1.81 1.81 0 0 1 2.58 0c.71.71.71 1.87 0 2.59v3.74l2.66-2.65a1.83 1.83 0 0 1 3.66 0c0 1.02-.82 1.84-1.83 1.84l-2.65 2.65h3.74a1.84 1.84 0 0 1 2.59 0c.72.71.72 1.87 0 2.58c-.71.71-1.87.71-2.59 0h-3.74l2.65 2.66c1.01 0 1.83.81 1.83 1.83a1.83 1.83 0 0 1-1.83 1.83c-1.02 0-1.83-.82-1.83-1.83l-2.66-2.65v3.74c.71.72.71 1.88 0 2.59c-.71.72-1.87.72-2.58 0a1.84 1.84 0 0 1 0-2.59v-3.74l-2.65 2.65c0 1.01-.82 1.83-1.84 1.83a1.83 1.83 0 0 1 0-3.66l2.65-2.66H5.13c-.72.71-1.88.71-2.59 0a1.81 1.81 0 0 1 0-2.58a1.84 1.84 0 0 1 2.59 0',
  check: 'M21 7L9 19l-5.5-5.5l1.41-1.41L9 16.17L19.59 5.59z',
  moon: 'm17.75 4.09l-2.53 1.94l.91 3.06l-2.63-1.81l-2.63 1.81l.91-3.06l-2.53-1.94L12.44 4l1.06-3l1.06 3zm3.5 6.91l-1.64 1.25l.59 1.98l-1.7-1.17l-1.7 1.17l.59-1.98L15.75 11l2.06-.05L18.5 9l.69 1.95zm-2.28 4.95c.83-.08 1.72 1.1 1.19 1.85c-.32.45-.66.87-1.08 1.27C15.17 23 8.84 23 4.94 19.07c-3.91-3.9-3.91-10.24 0-14.14c.4-.4.82-.76 1.27-1.08c.75-.53 1.93.36 1.85 1.19c-.27 2.86.69 5.83 2.89 8.02a9.96 9.96 0 0 0 8.02 2.89m-1.64 2.02a12.08 12.08 0 0 1-7.8-3.47c-2.17-2.19-3.33-5-3.49-7.82c-2.81 3.14-2.7 7.96.31 10.98c3.02 3.01 7.84 3.12 10.98.31',
  sun: 'm3.55 19.09l1.41 1.41l1.8-1.79l-1.42-1.42M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6s6-2.69 6-6c0-3.32-2.69-6-6-6m8 7h3v-2h-3m-2.76 7.71l1.8 1.79l1.41-1.41l-1.79-1.8M20.45 5l-1.41-1.4l-1.8 1.79l1.42 1.42M13 1h-2v3h2M6.76 5.39L4.96 3.6L3.55 5l1.79 1.81zM1 13h3v-2H1m12 9h-2v3h2',
  fit: 'M17 4h3c1.1 0 2 .9 2 2v2h-2V6h-3zM4 8V6h3V4H4c-1.1 0-2 .9-2 2v2zm16 8v2h-3v2h3c1.1 0 2-.9 2-2v-2zM7 18H4v-2H2v2c0 1.1.9 2 2 2h3zm9-8v4H8v-4zm2-2H6v8h12z',
  open: 'M6.1 10L4 18V8h17a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15c.9 0 1.7-.6 1.9-1.5l2.3-8.5zM19 18H6l1.6-6h13z',
  save: 'M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7zm2 16H5V5h11.17L19 7.83zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3M6 6h9v4H6z',
  fail: 'M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8',
};
const icon = (name) =>
  `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="${ICONS[name]}"/></svg>`;

const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');
const downloadSvgBtn = document.getElementById('download-svg');
copyBtn.innerHTML = icon('copy');
downloadBtn.innerHTML = icon('download');
downloadSvgBtn.innerHTML = icon('svg');
document.getElementById('fit').innerHTML = icon('fit');
document.getElementById('open').innerHTML = icon('open');
document.getElementById('save').innerHTML = icon('save');

// Dark mode toggle: page, Monaco and Mermaid theme all change together.
const themeBtn = document.getElementById('theme');
function applyTheme() {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  monaco.editor.setTheme(dark ? 'one-dark-pro' : 'vs');
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default' });
  themeBtn.innerHTML = icon(dark ? 'sun' : 'moon');
  themeBtn.title = themeBtn.ariaLabel = dark ? 'Switch to light mode' : 'Switch to dark mode';
}
themeBtn.addEventListener('click', () => {
  dark = !dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme();
  render();
});
applyTheme();

// Show a check (ok) or alert (fail) icon for a moment, then restore the original icon.
function flash(btn, name, ok) {
  btn.innerHTML = icon(ok ? 'check' : 'fail');
  setTimeout(() => (btn.innerHTML = icon(name)), 1200);
}

copyBtn.addEventListener('click', async () => {
  const data = getSvg();
  if (!data) return flash(copyBtn, 'copy', false);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': svgToPng(data) })]);
    flash(copyBtn, 'copy', true);
  } catch (err) {
    console.error(err);
    flash(copyBtn, 'copy', false);
  }
});

// Save a Blob as a file.
function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url)); // revoking right away can cancel the download in Firefox
}

// --- Open / save the diagram as a file -------------------------------------
// Save button or Ctrl+S downloads the text. Open button or dropping a file opens it (Ctrl+Z undoes that).
let fileName = 'diagram.mmd';
const saveFile = () => save(new Blob([editor.getValue()], { type: 'text/plain' }), fileName);
async function openFile(file) {
  fileName = file.name;
  fitted = false;
  editor.executeEdits('open-file', [{ range: editor.getModel().getFullModelRange(), text: await file.text() }]);
  editor.pushUndoStop();
}

document.getElementById('save').addEventListener('click', saveFile);
const picker = document.getElementById('picker');
document.getElementById('open').addEventListener('click', () => picker.click());
picker.addEventListener('change', () => {
  if (picker.files[0]) openFile(picker.files[0]);
  picker.value = ''; // so picking the same file again still fires "change"
});
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveFile();
  }
});
// Capture phase, so Monaco's own drop handling does not insert the file into the text.
addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); }
}, true);
addEventListener('drop', async (e) => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  e.preventDefault();
  e.stopPropagation();
  openFile(file);
}, true);

// Download PNG (default, 2x scale).
downloadBtn.addEventListener('click', async () => {
  const data = getSvg();
  if (!data) return flash(downloadBtn, 'download', false);
  try {
    save(await svgToPng(data), 'diagram.png');
    flash(downloadBtn, 'download', true);
  } catch (err) {
    console.error(err);
    flash(downloadBtn, 'download', false);
  }
});

// Download SVG.
downloadSvgBtn.addEventListener('click', () => {
  const data = getSvg();
  if (!data) return flash(downloadSvgBtn, 'svg', false);
  save(new Blob([data.xml], { type: 'image/svg+xml' }), 'diagram.svg');
  flash(downloadSvgBtn, 'svg', true);
});

// --- Resizable split -------------------------------------------------------
// Drag the divider to change the editor width. Double-click resets to 50%.
const divider = document.getElementById('divider');
const MIN = 15; // percent
const MAX = 85;
const setLeft = (pct) => document.body.style.setProperty('--left', pct + '%');

setLeft(Number(localStorage.getItem('split')) || 50);

divider.addEventListener('pointerdown', (e) => {
  divider.setPointerCapture(e.pointerId);
  divider.classList.add('dragging');
  document.body.classList.add('dragging');
});
divider.addEventListener('pointermove', (e) => {
  if (!divider.hasPointerCapture(e.pointerId)) return;
  const pct = Math.min(MAX, Math.max(MIN, (e.clientX / window.innerWidth) * 100));
  setLeft(pct);
  localStorage.setItem('split', pct);
});
const stopDrag = (e) => {
  if (divider.hasPointerCapture(e.pointerId)) divider.releasePointerCapture(e.pointerId);
  divider.classList.remove('dragging');
  document.body.classList.remove('dragging');
};
divider.addEventListener('pointerup', stopDrag);
divider.addEventListener('pointercancel', stopDrag);
divider.addEventListener('dblclick', () => {
  setLeft(50);
  localStorage.setItem('split', 50);
});

// --- Pan and zoom ----------------------------------------------------------
// Wheel (or pinch) zooms around the cursor. Drag pans. Double-click fits to view.
const view = { x: 0, y: 0, k: 1 };
const K_MIN = 0.1;
const K_MAX = 8;

function applyView() {
  stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
}

// Mermaid sets width="100%" and a max-width style. Use the real size (viewBox) instead.
function prepareSvg() {
  const svg = stage.querySelector('svg');
  if (!svg) return;
  const { width, height } = svg.viewBox.baseVal;
  svg.removeAttribute('style');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
}

function fit() {
  const svg = stage.querySelector('svg');
  if (!svg) return;
  const pad = 24;
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const k = Math.min((out.clientWidth - pad * 2) / w, (out.clientHeight - pad * 2) / h, 1);
  view.k = Math.max(K_MIN, k);
  view.x = (out.clientWidth - w * view.k) / 2;
  view.y = (out.clientHeight - h * view.k) / 2;
  applyView();
}

function zoomAt(cx, cy, factor) {
  const k = Math.min(K_MAX, Math.max(K_MIN, view.k * factor));
  const ratio = k / view.k;
  view.x = cx - (cx - view.x) * ratio;
  view.y = cy - (cy - view.y) * ratio;
  view.k = k;
  applyView();
}

out.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = out.getBoundingClientRect();
  const speed = e.ctrlKey ? 0.01 : 0.0015; // ctrlKey is set by trackpad pinch
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * speed));
}, { passive: false });

let drag = null;
out.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || msg.contains(e.target)) return; // let the error text be selected
  out.setPointerCapture(e.pointerId);
  out.classList.add('panning');
  drag = { x: e.clientX, y: e.clientY };
});
out.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.x += e.clientX - drag.x;
  view.y += e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  applyView();
});
const endPan = (e) => {
  if (out.hasPointerCapture(e.pointerId)) out.releasePointerCapture(e.pointerId);
  out.classList.remove('panning');
  drag = null;
};
out.addEventListener('pointerup', endPan);
out.addEventListener('pointercancel', endPan);

out.addEventListener('dblclick', fit);
document.getElementById('fit').addEventListener('click', fit);
