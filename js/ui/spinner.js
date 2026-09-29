/* ============================================================
   SPINNER.JS — Overlay di caricamento
   ============================================================ */

import { bus, EVENTS } from '../core/events.js';

/**
 * Mostra l'overlay di caricamento.
 * @param {string} label - Testo mostrato (default: "Caricamento...")
 */
export function show(label = 'Caricamento...') {
  const overlay = document.getElementById('spinnerOverlay');
  const labelEl = document.getElementById('spinnerLabel');
  if (!overlay) return;

  if (labelEl) labelEl.textContent = label;
  overlay.hidden = false;
}

/**
 * Nasconde l'overlay.
 */
export function hide() {
  const overlay = document.getElementById('spinnerOverlay');
  if (!overlay) return;
  overlay.hidden = true;
}

/**
 * Aggiorna il testo dell'overlay (senza nascondere).
 */
export function setLabel(label) {
  const labelEl = document.getElementById('spinnerLabel');
  if (labelEl) labelEl.textContent = label;
}

/**
 * Esegue una funzione asincrona mostrando lo spinner.
 * @param {Function} fn - Funzione async
 * @param {string} label - Etichetta
 */
export async function wrap(fn, label = 'Caricamento...') {
  show(label);
  try {
    return await fn();
  } finally {
    hide();
  }
}

/**
 * Inizializza il modulo.
 */
export function init() {
  bus.on(EVENTS.SPINNER_SHOW, ({ label }) => show(label));
  bus.on(EVENTS.SPINNER_HIDE, () => hide());
}