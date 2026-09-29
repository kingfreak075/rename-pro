/* ============================================================
   PDF-TEXTLAYER.JS — Text layer e selezione PDF
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log, error } from '../core/utils.js';

let container = null;

/**
 * Inizializza il modulo.
 */
export function init() {
  container = document.getElementById('pdfCanvasContainer');
  if (!container) {
    console.warn('[TextLayer] Container non trovato');
    return;
  }

  // Reagisci a richieste di render text layer
  bus.on('pdf:render-textlayer', ({ page, viewport }) => {
    renderTextLayer(page, viewport);
  });

  // Reagisci a cambio modalità
  bus.on('pdf:set-mode', ({ mode }) => {
    setMode(mode);
  });

  log('Text layer inizializzato');
}

/**
 * Renderizza il text layer per una pagina.
 */
export async function renderTextLayer(page, viewport) {
  if (!container) {
    container = document.getElementById('pdfCanvasContainer');
    if (!container) return;
  }

  try {
    // Rimuovi layer precedente
    const old = document.getElementById('textLayer');
    if (old) old.remove();

    // Crea nuovo layer
    const textLayer = document.createElement('div');
    textLayer.id = 'textLayer';
    textLayer.className = 'text-layer';
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;
    textLayer.style.pointerEvents = state.currentPdf.mode === 'text' ? 'auto' : 'none';
    container.appendChild(textLayer);

    // Estrai contenuto testo
    const textContent = await page.getTextContent();

    // Usa pdf.js per renderizzare il text layer
    pdfjsLib.renderTextLayer({
      textContent,
      container: textLayer,
      viewport,
      textDivs: [],
    });

    log('Text layer renderizzato');
  } catch (err) {
    error('Errore rendering text layer:', err);
  }
}

/**
 * Imposta la modalità (text = selezione, pan = trascinamento).
 */
export function setMode(mode) {
  state.currentPdf.mode = mode;

  const canvasContainer = document.getElementById('pdfCanvasContainer');
  const textLayer = document.getElementById('textLayer');

  if (!canvasContainer) return;

  // Rimuovi tutte le classi cursore
  canvasContainer.classList.remove('cursor-text', 'cursor-grab', 'cursor-grabbing');

  // Aggiorna bottoni toolbar
  const btnText = document.getElementById('pdfModeText');
  const btnPan = document.getElementById('pdfModePan');
  btnText?.classList.toggle('active', mode === 'text');
  btnPan?.classList.toggle('active', mode === 'pan');

  if (mode === 'text') {
    canvasContainer.classList.add('cursor-text');
    if (textLayer) textLayer.style.pointerEvents = 'auto';
  } else {
    canvasContainer.classList.add('cursor-grab');
    if (textLayer) textLayer.style.pointerEvents = 'none';
  }

  bus.emit(EVENTS.PDF_MODE_CHANGED, { mode });
  log('Modalità PDF:', mode);
}

/**
 * Ottieni il testo selezionato dall'utente.
 */
export function getSelection() {
  return window.getSelection().toString().trim();
}