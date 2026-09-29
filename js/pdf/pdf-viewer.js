/* ============================================================
   PDF-VIEWER.JS — Rendering e controllo viewer PDF
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log, error, warn } from '../core/utils.js';

// Verifica che pdf.js sia caricato
if (typeof pdfjsLib === 'undefined') {
  console.error('[PDF] pdf.js non caricato! Verifica <script src="vendor/pdfjs/pdf.min.js">');
} else {
  // Configura worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  log('PDF.js worker configurato');
}

// Riferimenti DOM (popolati in init)
let canvas, ctx, container, filenameEl, pageInfoEl;

/**
 * Inizializza il modulo.
 */
export function init() {
  canvas = document.getElementById('pdfCanvas');
  container = document.getElementById('pdfCanvasContainer');
  filenameEl = document.querySelector('#pdfFilename .pdf-footer-name');
  pageInfoEl = document.getElementById('pdfPageInfo');

  if (!canvas || !container) {
    console.warn('[PDF] Canvas o container non trovati');
    return;
  }

  ctx = canvas.getContext('2d');

  // Binding bottoni toolbar
  bindToolbar();
  bindWheelZoom();
  bindKeyboard();

  // Ascolta richieste di caricamento dal modulo list
  bus.on('pdf:load-request', ({ idx }) => loadPdfByIndex(idx));

  log('Viewer PDF inizializzato');
}

// ============================================================
// CARICAMENTO PDF
// ============================================================

/**
 * Carica un PDF dato il suo indice nella lista.
 */
export async function loadPdfByIndex(idx) {
  const item = state.pdfItems[idx];
  if (!item) {
    warn('PDF non trovato per indice:', idx);
    return;
  }

  try {
    log('Caricamento PDF:', item.name);

    // Leggi il file
    const file = await item.handle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    // Carica con pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    // Salva nello stato
    state.currentPdf.pdfDoc = pdfDoc;
    state.currentPdf.pageNum = 1;
    state.currentPdf.panX = 0;
    state.currentPdf.panY = 0;

    // Aggiorna nome file nel footer
    if (filenameEl) filenameEl.textContent = item.name;

    // Render
    await renderPage(1);

    bus.emit(EVENTS.PDF_LOADED, { idx, name: item.name });
  } catch (err) {
    error('Errore caricamento PDF:', err);
    bus.emit(EVENTS.PDF_ERROR, { message: 'Errore caricamento PDF: ' + err.message });
  }
}

// ============================================================
// RENDERING
// ============================================================

/**
 * Renderizza una pagina del PDF corrente.
 */
export async function renderPage(num) {
  const pdfDoc = state.currentPdf.pdfDoc;
  if (!pdfDoc || !canvas) return;

  try {
    const page = await pdfDoc.getPage(num);
    const scale = state.currentPdf.scale;
    const viewport = page.getViewport({ scale });

    // Configura canvas
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Render canvas
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    await page.render(renderContext).promise;

    // Render text layer (delega a pdf-textlayer.js)
    bus.emit('pdf:render-textlayer', { page, viewport });

    // Aggiorna info pagina
    if (pageInfoEl) pageInfoEl.textContent = `${num}/${pdfDoc.numPages}`;

    bus.emit(EVENTS.PDF_PAGE_CHANGED, { pageNum: num, total: pdfDoc.numPages });
  } catch (err) {
    error('Errore rendering pagina:', err);
  }
}

// ============================================================
// NAVIGAZIONE
// ============================================================

export function changePage(delta) {
  const pdfDoc = state.currentPdf.pdfDoc;
  if (!pdfDoc) return;

  const next = state.currentPdf.pageNum + delta;
  if (next < 1 || next > pdfDoc.numPages) return;

  state.currentPdf.pageNum = next;
  renderPage(next);
}

// ============================================================
// ZOOM
// ============================================================

export function zoomPdf(delta) {
  if (!state.currentPdf.pdfDoc) return;

  const oldScale = state.currentPdf.scale;
  const newScale = Math.max(0.5, Math.min(4, oldScale + delta));
  if (newScale === oldScale) return;

  state.currentPdf.scale = newScale;
  log('Zoom:', newScale);

  renderPage(state.currentPdf.pageNum);
  bus.emit(EVENTS.PDF_ZOOM_CHANGED, { scale: newScale });
}

// ============================================================
// BINDING
// ============================================================

function bindToolbar() {
  const prev = document.getElementById('pdfPrevPage');
  const next = document.getElementById('pdfNextPage');
  const zoomIn = document.getElementById('pdfZoomIn');
  const zoomOut = document.getElementById('pdfZoomOut');
  const modeText = document.getElementById('pdfModeText');
  const modePan = document.getElementById('pdfModePan');

  prev?.addEventListener('click', () => changePage(-1));
  next?.addEventListener('click', () => changePage(1));
  zoomIn?.addEventListener('click', () => zoomPdf(0.2));
  zoomOut?.addEventListener('click', () => zoomPdf(-0.2));

  modeText?.addEventListener('click', () => bus.emit('pdf:set-mode', { mode: 'text' }));
  modePan?.addEventListener('click', () => bus.emit('pdf:set-mode', { mode: 'pan' }));
}

function bindWheelZoom() {
  if (!container) return;
  container.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      zoomPdf(delta);
    }
  }, { passive: false });
}

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (!state.currentPdf.pdfDoc) return;

    // Non intercettare se focus su input
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'ArrowUp' && e.ctrlKey) {
      e.preventDefault();
      changePage(-1);
    }
    if (e.key === 'ArrowDown' && e.ctrlKey) {
      e.preventDefault();
      changePage(1);
    }
  });
}

// ============================================================
// RESET
// ============================================================

export function clear() {
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }
  if (filenameEl) filenameEl.textContent = 'Nessun file selezionato';
  if (pageInfoEl) pageInfoEl.textContent = '0/0';
  state.currentPdf.pdfDoc = null;
}