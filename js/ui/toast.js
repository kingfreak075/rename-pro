/* ============================================================
   TOAST.JS — Notifiche non bloccanti
   ============================================================ */

import { bus, EVENTS } from '../core/events.js';
import { escapeHtml, uuid } from '../core/utils.js';

const DEFAULT_DURATION = 3500; // ms

const ICONS = {
  success: 'fa-circle-check',
  error:   'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info:    'fa-circle-info',
};

/**
 * Mostra un toast.
 * @param {string} message - Testo del messaggio
 * @param {'success'|'error'|'warning'|'info'} type - Tipo
 * @param {number} duration - Durata in ms (0 = permanente)
 */
export function show(message, type = 'info', duration = DEFAULT_DURATION) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.warn('[Toast] Container #toastContainer non trovato');
    return;
  }

  const id = uuid();
  const icon = ICONS[type] || ICONS.info;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.dataset.toastId = id;
  el.innerHTML = `
    <i class="fas ${icon}"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(el);

  // Auto-rimozione
  if (duration > 0) {
    setTimeout(() => hide(id), duration);
  }

  return id;
}

/**
 * Nasconde un toast specifico con animazione.
 */
export function hide(id) {
  const el = document.querySelector(`[data-toast-id="${id}"]`);
  if (!el) return;

  el.classList.add('toast-leaving');
  setTimeout(() => {
    el.remove();
  }, 300);
}

/**
 * Nasconde tutti i toast.
 */
export function clear() {
  const container = document.getElementById('toastContainer');
  if (container) container.innerHTML = '';
}

// ---------- Scorciatoie ----------
export const success = (msg, duration) => show(msg, 'success', duration);
export const error   = (msg, duration) => show(msg, 'error', duration);
export const warning = (msg, duration) => show(msg, 'warning', duration);
export const info    = (msg, duration) => show(msg, 'info', duration);

/**
 * Inizializza il modulo (ascolta eventi globali).
 */
export function init() {
  // Ascolta l'evento TOAST_SHOW
  bus.on(EVENTS.TOAST_SHOW, ({ message, type, duration }) => {
    show(message, type, duration);
  });

  // Ascolta gli errori globali
  bus.on(EVENTS.DATA_ERROR, ({ message }) => {
    error(message || 'Errore durante il caricamento dei dati');
  });

  bus.on(EVENTS.PDF_ERROR, ({ message }) => {
    error(message || 'Errore nel PDF');
  });
}