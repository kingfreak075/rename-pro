/* ============================================================
   PDF-PAN.JS — Modalità pan del PDF
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log } from '../core/utils.js';

let container = null;
let canvas = null;
let bound = false;

/**
 * Inizializza il modulo.
 */
export function init() {
  container = document.getElementById('pdfCanvasContainer');
  canvas = document.getElementById('pdfCanvas');

  if (!container) {
    console.warn('[Pan] Container non trovato');
    return;
  }

  if (!bound) {
    container.addEventListener('mousedown', startPan);
    document.addEventListener('mousemove', onPan);
    document.addEventListener('mouseup', endPan);
    document.addEventListener('mouseleave', endPan);
    bound = true;
  }

  // Reagisci a cambio modalità: reset pan quando si passa a text
  bus.on('pdf:set-mode', ({ mode }) => {
    if (mode === 'text') {
      state.currentPdf.panX = 0;
      state.currentPdf.panY = 0;
      applyTransform();
    }
  });

  log('Pan PDF inizializzato');
}

function startPan(e) {
  if (state.currentPdf.mode !== 'pan' || e.button !== 0) return;

  state.currentPdf.isPanning = true;
  state.currentPdf.startPanX = e.clientX - state.currentPdf.panX;
  state.currentPdf.startPanY = e.clientY - state.currentPdf.panY;

  container.classList.add('cursor-grabbing');
  container.classList.remove('cursor-grab');

  e.preventDefault();
}

function onPan(e) {
  if (!state.currentPdf.isPanning || state.currentPdf.mode !== 'pan') return;

  state.currentPdf.panX = e.clientX - state.currentPdf.startPanX;
  state.currentPdf.panY = e.clientY - state.currentPdf.startPanY;

  applyTransform();
}

function endPan() {
  if (state.currentPdf.mode !== 'pan') return;
  state.currentPdf.isPanning = false;

  if (container) {
    container.classList.remove('cursor-grabbing');
    container.classList.add('cursor-grab');
  }
}

function applyTransform() {
  const transform = `translate(${state.currentPdf.panX}px, ${state.currentPdf.panY}px)`;

  const canvasEl = document.getElementById('pdfCanvas');
  if (canvasEl) canvasEl.style.transform = transform;

  const textLayer = document.getElementById('textLayer');
  if (textLayer) textLayer.style.transform = transform;
}

/**
 * Reset del pan.
 */
export function resetPan() {
  state.currentPdf.panX = 0;
  state.currentPdf.panY = 0;
  applyTransform();
}