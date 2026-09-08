import './styles/main.css';
import { toLetters, PALETTE } from './modes/transforms';
import { findGrid, findText, type Match } from './search/search';
import { PixelRenderer } from './pixel/PixelRenderer';
import { exportText } from './export/exportText';
import type { WorkerResponse } from './pi/types';

type Mode = 'normal' | 'search' | 'letters' | 'pixels' | 'binary' | 'god';
const MAX_DIGITS = 1_000_000;
const GODMOD3_PASSWORD_HASH = '67e9a0db5ddca0f5222f8242df5a136cb6d7e56c5529addd06f3ad30a9f68de2';
const app = document.querySelector<HTMLDivElement>('#app')!;
let mode: Mode = 'normal';
let digits = '';
let worker: Worker | undefined;
let iterations = 0;
let elapsed = 0;
let requested = 0;
let completedTerms = 0;
let totalTerms = 0;
let paused = false;
let digitsPerLine = 30;
let matches: Match[] = [];
let selected = 0;
let width = 128;
let colorPattern = '';
let binarySize = 4;
let binaryPattern: string[] = [];
let godUnlocked = false;
try { godUnlocked = localStorage.getItem('piexplorer_godmod3_unlocked') === 'true'; } catch { /* Storage can be unavailable in private browser contexts. */ }

app.innerHTML = `
  <header class="header">
    <div class="brand"><b>π</b> PI EXPLORER</div>
    <nav class="mode-nav" aria-label="Exploration modes">
      <button data-mode="normal" class="active">NORMAL PI</button><button data-mode="search">SEARCH</button><button data-mode="letters">LETTERS</button><button data-mode="pixels">PIXEL</button><button data-mode="binary">BINARY GRID</button>${godUnlocked ? '<button data-mode="god">GODMOD3</button>' : ''}
    </nav>
    <button id="create" class="primary">CREATE DIGITS</button>
  </header>
  <main class="workspace">
    <section class="result-area">
      <div class="result-toolbar">
        <label>DIGITS PER LINE <select id="lineCount"><option>10</option><option>20</option><option selected>30</option><option>50</option><option>100</option><option value="custom">Custom…</option></select></label>
        <input id="customLineCount" type="number" min="1" max="1000" hidden aria-label="Custom digits per line" />
        <button id="export">EXPORT .TXT</button>
      </div>
      <section id="display" class="digit-display" aria-live="polite"></section>
      <section id="canvasPanel" class="canvas-panel" hidden><canvas id="canvas" aria-label="Pi digit pixel canvas"></canvas></section>
      <section class="metadata" aria-label="Calculation metadata">
        <span>REQUESTED <b id="requested">—</b></span><span>CALCULATED <b id="calculated">0</b></span><span>ITERATIONS <b id="iterations">0</b></span><span>ELAPSED <b id="elapsed">0.00s</b></span><span>SPEED <b id="rate">—</b></span>
      </section>
    </section>
    <aside id="toolPanel" class="tool-panel"></aside>
  </main>
  <section id="createModal" class="creation-modal" aria-modal="true" role="dialog" aria-labelledby="createTitle" aria-hidden="true" hidden>
    <div class="modal-content">
      <div class="modal-heading"><p class="eyebrow">CHUDNOVSKY / BIGINT / WEB WORKER</p><h1 id="createTitle">CREATE PI DIGITS</h1><p>Choose how many digits of Pi you want to calculate.</p></div>
      <div id="setupFields"><label class="large-input">DIGITS TO CALCULATE<input id="count" type="number" min="1" max="1000000" value="1000" inputmode="numeric" /></label><div class="presets" aria-label="Digit count presets"><button data-preset="100">100</button><button data-preset="1000">1,000</button><button data-preset="10000">10,000</button><button data-preset="100000">100,000</button><button data-preset="1000000">1,000,000</button></div><label class="speed-control">DELIVERY SPEED <input id="speed" type="range" min="1" max="10" value="7"/><span id="speedValue">7 / 10</span></label><p id="largeWarning" class="warning" hidden>Large calculations can require substantial memory and time. Only start if your computer has sufficient resources.</p></div>
      <div id="calculationStatus" class="calculation-status" hidden><h2 id="calculationTitle">CALCULATING EXACT PI DIGITS</h2><div class="progress-track"><i id="progressBar"></i></div><div class="modal-stats"><span>PROGRESS <b id="modalProgress">0.00%</b></span><span>CALCULATED <b id="modalCalculated">0</b></span><span>ITERATION <b id="modalIteration">0</b></span><span>ELAPSED <b id="modalElapsed">0.00s</b></span><span>SPEED <b id="modalSpeed">—</b></span></div><pre id="modalDigits" class="modal-digits">π = awaiting calculation…</pre></div>
      <div class="modal-actions"><button id="cancel">CANCEL</button><button id="start" class="primary">START CALCULATION</button><button id="continue" class="primary" hidden>VIEW RESULT</button></div>
    </div>
  </section>
  <section id="unlockModal" class="unlock-modal" role="dialog" aria-modal="true" aria-labelledby="unlockTitle" hidden><div class="unlock-content"><h2 id="unlockTitle">Open GODMOD3?</h2><p>Type correct password</p><input id="unlockPassword" type="password" autocomplete="off" aria-label="GODMOD3 password"/><p id="unlockError" class="warning" hidden>Incorrect password.</p><button id="unlockConfirm" class="primary">UNLOCK</button><button id="unlockCancel">CANCEL</button></div></section>`;

const $ = <T extends HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
const display = $('#display');
const canvasPanel = $('#canvasPanel');
const canvas = $<HTMLCanvasElement>('#canvas');
const renderer = new PixelRenderer(canvas);
const modal = $('#createModal');
const unlockModal = $('#unlockModal');

function escapeHtml(value: string): string { return value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]!)); }
function formatDigits(): string {
  if (!digits) return `<div class="empty-state"><span>π</span><p>Create a real Pi dataset to begin exploration.</p></div>`;
  const highlighted = new Set<number>();
  for (const match of matches) for (let i = match.index; i < match.index + match.length; i++) highlighted.add(i);
  let output = '<div class="pi-prefix">π = </div><div class="pi-lines">';
  for (let i = 0; i < digits.length; i++) {
    if (i === 1) output += '.';
    output += highlighted.has(i) ? `<mark>${digits[i]}</mark>` : escapeHtml(digits[i]);
    if (i > 0 && (i % digitsPerLine === 0) && i < digits.length - 1) output += '\n';
  }
  return `${output}</div>`;
}
function render(): void {
  canvasPanel.hidden = mode !== 'pixels' && mode !== 'binary';
  if (mode === 'letters') {
    display.innerHTML = `<div class="letter-source">SOURCE DIGITS<br>${formatDigits()}</div><div class="letter-result">CONVERTED LETTERS<br>${escapeHtml(toLetters(digits)) || '—'}</div><p class="mapping-note">Pairs 01–26 map to A–Z; 27 and above wrap cyclically; 00 maps to a space.</p>`;
  } else if (mode === 'god') {
    display.innerHTML = `<div class="god-display"><p class="eyebrow">ARBITRARY-PRECISION EXPRESSION LABORATORY</p><pre id="godResult">Enter an expression and calculate it in the dedicated worker.</pre><p id="godStatus" class="mapping-note">Ready.</p></div>`;
  } else if (mode === 'pixels' || mode === 'binary') {
    display.innerHTML = `<p class="canvas-description">${mode === 'pixels' ? 'Every calculated digit is shown with its deterministic palette color.' : 'Digits 0–4 are black; digits 5–9 are white.'} Index i → x = i mod ${width}, y = floor(i / ${width}). Use wheel to zoom and drag to pan.</p>`;
    renderer.render(digits, width, mode === 'binary', matches);
  } else display.innerHTML = formatDigits();
}
function updateMetadata(): void {
  const rate = elapsed ? `${Math.round(digits.length / (elapsed / 1000)).toLocaleString()} d/s` : '—';
  $('#requested').textContent = requested ? requested.toLocaleString() : '—'; $('#calculated').textContent = digits.length.toLocaleString(); $('#iterations').textContent = iterations.toLocaleString(); $('#elapsed').textContent = `${(elapsed / 1000).toFixed(2)}s`; $('#rate').textContent = rate;
  const progress = digits.length === requested && requested > 0 ? 100 : totalTerms > 0 ? Math.min(99.99, completedTerms / totalTerms * 100) : 0;
  $('#modalProgress').textContent = `${progress.toFixed(2)}%`; $('#modalCalculated').textContent = digits.length.toLocaleString(); $('#modalIteration').textContent = iterations.toLocaleString(); $('#modalElapsed').textContent = `${(elapsed / 1000).toFixed(2)}s`; $('#modalSpeed').textContent = rate; $<HTMLElement>('#progressBar').style.width = `${progress}%`;
  $('#modalDigits').textContent = digits ? `π = ${digits.slice(0, 180)}${digits.length > 180 ? '…' : ''}` : 'π = calculating exact terms…';
}
function setMode(next: Mode): void { mode = next; matches = []; selected = 0; app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode)); renderTools(); render(); }
function renderTools(): void {
  const panel = $('#toolPanel');
  if (mode === 'god') { renderGodTools(panel); return; }
  if (mode === 'normal') { panel.innerHTML = `<h2>NORMAL PI</h2><p>Exact Chudnovsky digits calculated in a dedicated Web Worker. Set the line length above without recalculating.</p>`; return; }
  if (mode === 'search') { panel.innerHTML = `<h2>SEARCH CALCULATED DIGITS</h2><input id="query" inputmode="numeric" aria-label="Digit sequence" placeholder="e.g. 1415"/><button id="search" class="primary">SEARCH</button><p id="searchResult">Searches only the digits that have actually been calculated. Overlapping matches are included.</p>`; const query = $<HTMLInputElement>('#query'); const search = () => { if (!/^\d+$/.test(query.value)) { $('#searchResult').textContent = 'Enter a non-empty digit sequence.'; return; } matches = findText(digits, query.value); $('#searchResult').textContent = matches.length ? `Matches: ${matches.length}. Positions: ${matches.map(item => item.index).join(', ')}` : 'Not found in calculated digits.'; render(); }; $('#search').onclick = search; query.onkeydown = event => { if (event.key === 'Enter') search(); }; return; }
  if (mode === 'letters') { panel.innerHTML = `<h2>NUMBER → LETTER</h2><p>Two digits form a letter. This mode preserves the calculated source above and provides selectable converted text.</p><button id="exportLetters">EXPORT LETTERS</button>`; $('#exportLetters').onclick = () => exportText(toLetters(digits), 'pi-letters.txt'); return; }
  if (mode === 'pixels') { panel.innerHTML = `<h2>BUILD COLOR PATTERN</h2><div class="legend">${PALETTE.map((color, digit) => `<button class="swatch" data-digit="${digit}" style="background:${color}" aria-label="Add digit ${digit}">${digit}</button>`).join('')}</div><p>Pattern: <b id="patternValue">${colorPattern || '—'}</b></p><button id="patternSearch" class="primary">SEARCH PATTERN</button><button id="patternClear">CLEAR</button><p id="patternResult">Choose colors to search the exact underlying Pi digits.</p>`; panel.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(button => button.onclick = () => { colorPattern += button.dataset.digit!; renderTools(); }); $('#patternClear').onclick = () => { colorPattern = ''; renderTools(); }; $('#patternSearch').onclick = () => { matches = colorPattern ? findText(digits, colorPattern).map(match => ({ ...match, x: match.index % width, y: Math.floor(match.index / width), spanWidth: match.length, spanHeight: 1 })) : []; showPixelResults(); render(); }; return; }
  binaryPattern = Array.from({ length: binarySize }, (_, y) => binaryPattern[y]?.padEnd(binarySize, '0').slice(0, binarySize) ?? '0'.repeat(binarySize));
  panel.innerHTML = `<h2>DRAW BINARY PATTERN</h2><label>GRID SIZE <select id="gridSize">${[3, 4, 5, 6, 8].map(size => `<option value="${size}" ${size === binarySize ? 'selected' : ''}>${size} × ${size}</option>`).join('')}</select></label><div class="pattern-grid" style="grid-template-columns:repeat(${binarySize}, 24px)">${binaryPattern.join('').split('').map((value, index) => `<button data-cell="${index}" class="cell" style="background:${value === '1' ? '#ffffff' : '#000000'}" aria-label="${value === '1' ? 'White' : 'Black'} cell"></button>`).join('')}</div><p>Black requires 0–4. White requires 5–9.</p><button id="binarySearch" class="primary">SEARCH PATTERN</button><button id="binaryClear">CLEAR</button><p id="patternResult">Draw a pattern and search exact digit ranges.</p>`;
  $<HTMLSelectElement>('#gridSize').onchange = event => { binarySize = Number((event.target as HTMLSelectElement).value); binaryPattern = []; renderTools(); };
  panel.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(button => button.onclick = () => { const index = Number(button.dataset.cell); const y = Math.floor(index / binarySize), x = index % binarySize; binaryPattern[y] = binaryPattern[y].slice(0, x) + (binaryPattern[y][x] === '0' ? '1' : '0') + binaryPattern[y].slice(x + 1); renderTools(); });
  $('#binaryClear').onclick = () => { binaryPattern = []; renderTools(); }; $('#binarySearch').onclick = () => { if (binarySize === 4 && binaryPattern.join('') === '1010010110100101') { openUnlockModal(); return; } matches = findGrid(digits, width, binaryPattern, true); showPixelResults(); render(); };
}

function renderGodTools(panel: HTMLElement): void {
  panel.innerHTML = `<h2>GODMOD3</h2><textarea id="godExpression" rows="4" aria-label="Mathematical expression" placeholder="sqrt(2) + sqrt(3)"></textarea><label>PRECISION <input id="godPrecision" type="number" min="1" max="1000" value="50"/></label><div class="god-actions"><button id="godCalculate" class="primary">CALCULATE</button><button id="godClear">CLEAR</button><button id="godCopy">COPY RESULT</button></div><div class="math-keyboard">${[{ label: '0', value: '0' },{ label: '1', value: '1' },{ label: '2', value: '2' },{ label: '3', value: '3' },{ label: '4', value: '4' },{ label: '5', value: '5' },{ label: '6', value: '6' },{ label: '7', value: '7' },{ label: '8', value: '8' },{ label: '9', value: '9' },{ label: '+', value: ' + ' },{ label: '−', value: ' - ' },{ label: '×', value: ' × ' },{ label: '÷', value: ' ÷ ' },{ label: '.', value: '.' },{ label: '(', value: '(' },{ label: ')', value: ')' },{ label: '^', value: '^' },{ label: '√', value: 'sqrt()' },{ label: '³√', value: 'root(3,)' },{ label: 'nth root', value: 'root()' },{ label: 'a/b', value: '/' },{ label: 'sin()', value: 'sin()' },{ label: 'cos()', value: 'cos()' },{ label: 'tan()', value: 'tan()' },{ label: 'π', value: 'pi' },{ label: 'e', value: 'e' }].map(key => `<button data-key="${key.value}">${key.label}</button>`).join('')}</div><p class="mapping-note">Supports arithmetic, parentheses, integer powers, sqrt(), root(degree,value), π, e, sin(), cos(), and tan(). Precision is limited to 1,000 digits.</p>`;
  const expression = $<HTMLTextAreaElement>('#godExpression');
  panel.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => button.onclick = () => insertAtCursor(expression, button.dataset.key!));
  $('#godClear').onclick = () => { expression.value = ''; const result = app.querySelector<HTMLElement>('#godResult'); if (result) result.textContent = 'Enter an expression and calculate it in the dedicated worker.'; };
  $('#godCopy').onclick = async () => { const result = app.querySelector<HTMLElement>('#godResult')?.textContent ?? ''; try { await navigator.clipboard.writeText(result); const status = app.querySelector<HTMLElement>('#godStatus'); if (status) status.textContent = 'Result copied.'; } catch { const status = app.querySelector<HTMLElement>('#godStatus'); if (status) status.textContent = 'Copy is unavailable in this browser context.'; } };
  $('#godCalculate').onclick = () => calculateGod(expression.value, Number($<HTMLInputElement>('#godPrecision').value));
}
function insertAtCursor(input: HTMLTextAreaElement, text: string): void { const start = input.selectionStart, end = input.selectionEnd; input.setRangeText(text, start, end, 'end'); const cursor = start + text.length - (text.endsWith('()') ? 1 : 0); input.setSelectionRange(cursor, cursor); input.focus(); }
function calculateGod(expression: string, precision: number): void { const result = app.querySelector<HTMLElement>('#godResult'), status = app.querySelector<HTMLElement>('#godStatus'); if (!result || !status) return; if (!expression.trim()) { status.textContent = 'Enter an expression.'; return; } if (!Number.isSafeInteger(precision) || precision < 1 || precision > 1000) { status.textContent = 'Precision must be from 1 to 1,000.'; return; } status.textContent = 'Calculating in worker…'; result.textContent = '…'; const godWorker = new Worker(new URL('./workers/god.worker.ts', import.meta.url), { type: 'module' }); godWorker.onmessage = (event: MessageEvent<{ type: 'done'; value: string; elapsedMs: number } | { type: 'error'; message: string }>) => { godWorker.terminate(); if (event.data.type === 'done') { result.textContent = event.data.value; status.textContent = `Completed in ${event.data.elapsedMs.toFixed(2)} ms.`; } else { result.textContent = '—'; status.textContent = event.data.message; } }; godWorker.onerror = () => { godWorker.terminate(); result.textContent = '—'; status.textContent = 'Expression worker failed.'; }; godWorker.postMessage({ type: 'calculate', expression, precision }); }
function openUnlockModal(): void { unlockModal.hidden = false; $('#unlockError').hidden = true; const password = $<HTMLInputElement>('#unlockPassword'); password.value = ''; password.focus(); }
function closeUnlockModal(): void { $<HTMLInputElement>('#unlockPassword').value = ''; unlockModal.hidden = true; }
async function hashPassword(value: string): Promise<string> { const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function unlockGod(): Promise<void> { const password = $<HTMLInputElement>('#unlockPassword'); let matches = false; try { matches = (await hashPassword(password.value)) === GODMOD3_PASSWORD_HASH; } catch { $('#unlockError').textContent = 'Password verification is unavailable.'; $('#unlockError').hidden = false; return; } if (!matches) { password.value = ''; $('#unlockError').textContent = 'Incorrect password.'; $('#unlockError').hidden = false; password.focus(); return; } godUnlocked = true; try { localStorage.setItem('piexplorer_godmod3_unlocked', 'true'); } catch { /* The current session remains unlocked. */ } closeUnlockModal(); const nav = app.querySelector<HTMLElement>('.mode-nav')!; if (!nav.querySelector('[data-mode="god"]')) { const button = document.createElement('button'); button.dataset.mode = 'god'; button.textContent = 'GODMOD3'; button.onclick = () => setMode('god' as Mode); nav.append(button); } setMode('god' as Mode); }

function showPixelResults(): void { const result = $('#patternResult'); result.innerHTML = matches.length ? `Matches: ${matches.length}. ${matches.map((match, index) => `#${index + 1} (${match.x}, ${match.y})`).join(' ')}<br><button id="previous">PREVIOUS</button> <button id="next">NEXT</button>` : 'Not found in calculated digits.'; $('#previous')?.addEventListener('click', () => navigate(-1)); $('#next')?.addEventListener('click', () => navigate(1)); }
function navigate(delta: number): void { if (!matches.length) return; selected = (selected + delta + matches.length) % matches.length; renderer.focus(matches[selected]); render(); }
function openModal(): void { modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); modal.dataset.state = 'setup'; document.body.classList.add('modal-open'); $('#setupFields').hidden = false; $('#calculationStatus').hidden = true; $('#start').hidden = false; $('#continue').hidden = true; $('#cancel').hidden = false; $('#cancel').textContent = 'CANCEL'; $<HTMLInputElement>('#count').focus(); }
function closeModal(): void { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); delete modal.dataset.state; document.body.classList.remove('modal-open'); $('#create').focus(); }
function startCalculation(): void {
  const count = Number($<HTMLInputElement>('#count').value);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DIGITS) { $('#largeWarning').hidden = false; $('#largeWarning').textContent = `Enter a whole number between 1 and ${MAX_DIGITS.toLocaleString()}.`; return; }
  requested = count; digits = ''; matches = []; iterations = 0; elapsed = 0; completedTerms = 0; totalTerms = 0; paused = false;
  modal.dataset.state = 'calculating'; $('#calculationTitle').textContent = 'CALCULATING EXACT PI DIGITS'; $('#setupFields').hidden = true; $('#calculationStatus').hidden = false; $('#start').hidden = true; $('#cancel').textContent = 'STOP'; updateMetadata(); render();
  worker?.terminate(); worker = new Worker(new URL('./workers/pi.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => { const message = event.data; if (message.type === 'progress') { iterations = message.iteration; completedTerms = message.iteration; totalTerms = message.totalIterations; elapsed = message.elapsedMs; } else if (message.type === 'chunk') { digits += message.digits; } else if (message.type === 'done') { iterations = message.iterations; completedTerms = message.iterations; totalTerms = message.iterations; elapsed = message.elapsedMs; worker?.terminate(); worker = undefined; modal.dataset.state = 'complete'; $('#calculationTitle').textContent = 'CALCULATION COMPLETE'; $('#continue').hidden = false; $('#cancel').hidden = true; } else { worker?.terminate(); worker = undefined; $('#largeWarning').hidden = false; $('#largeWarning').textContent = message.message; $('#setupFields').hidden = false; $('#calculationStatus').hidden = true; $('#start').hidden = false; } updateMetadata(); render(); };
  worker.onerror = () => { worker?.terminate(); worker = undefined; $('#largeWarning').hidden = false; $('#largeWarning').textContent = 'The calculation worker failed.'; };
  worker.onmessageerror = () => { worker?.terminate(); worker = undefined; $('#largeWarning').hidden = false; $('#largeWarning').textContent = 'The application received an invalid calculation-worker message.'; };
  worker.postMessage({ type: 'start', digits: count, updateEvery: Math.max(250, Math.round(2500 / Number($<HTMLInputElement>('#speed').value))) });
}
function stopCalculation(): void { worker?.postMessage({ type: 'cancel' }); worker?.terminate(); worker = undefined; closeModal(); updateMetadata(); }

app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.onclick = () => setMode(button.dataset.mode as Mode));
$('#create').onclick = openModal; $('#unlockCancel').onclick = closeUnlockModal; $('#unlockConfirm').onclick = () => { void unlockGod(); }; $<HTMLInputElement>('#unlockPassword').onkeydown = event => { if (event.key === 'Enter') void unlockGod(); }; $('#cancel').onclick = () => worker ? stopCalculation() : closeModal(); $('#continue').onclick = closeModal; $('#start').onclick = startCalculation;
app.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.onclick = () => { $<HTMLInputElement>('#count').value = button.dataset.preset!; $('#largeWarning').hidden = Number(button.dataset.preset) <= 100_000; });
$<HTMLInputElement>('#count').oninput = () => { $('#largeWarning').hidden = Number($<HTMLInputElement>('#count').value) <= 100_000; };
$('#speed').oninput = () => $('#speedValue').textContent = `${$<HTMLInputElement>('#speed').value} / 10`;
$<HTMLSelectElement>('#lineCount').onchange = event => { const value = (event.target as HTMLSelectElement).value; const custom = $<HTMLInputElement>('#customLineCount'); custom.hidden = value !== 'custom'; if (value !== 'custom') { digitsPerLine = Number(value); render(); } else custom.focus(); };
$<HTMLInputElement>('#customLineCount').oninput = event => { const value = Number((event.target as HTMLInputElement).value); if (Number.isSafeInteger(value) && value > 0 && value <= 1000) { digitsPerLine = value; render(); } };
$('#export').onclick = () => { if (mode === 'pixels' || mode === 'binary') { alert('Export is unavailable in Pixel mode.'); return; } exportText(mode === 'letters' ? toLetters(digits) : digits ? `${digits[0]}.${digits.slice(1)}` : '', mode === 'letters' ? 'pi-letters.txt' : 'pi-digits.txt'); };
canvas.addEventListener('wheel', event => { event.preventDefault(); renderer.zoom = Math.max(.25, Math.min(30, renderer.zoom * (event.deltaY < 0 ? 1.15 : .87))); render(); }, { passive: false });
let drag: { x: number; y: number } | undefined; canvas.onpointerdown = event => { drag = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); }; canvas.onpointermove = event => { if (!drag) return; renderer.panX += event.clientX - drag.x; renderer.panY += event.clientY - drag.y; drag = { x: event.clientX, y: event.clientY }; render(); }; canvas.onpointerup = () => { drag = undefined; };
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden && !worker) closeModal(); });
window.addEventListener('resize', render); renderTools(); render(); updateMetadata();
