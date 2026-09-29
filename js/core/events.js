/* ============================================================
   EVENTS.JS — EventBus pub/sub interno
   ============================================================ */

import { warn } from './utils.js';

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * Registra un listener per un evento.
   * @param {string} event - Nome evento (es. 'pdf:loaded')
   * @param {Function} handler - Callback
   * @returns {Function} - Funzione per rimuovere il listener
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      warn('EventBus.on: handler non è una funzione', event);
      return () => {};
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);

    // Ritorna funzione di unsubscribe
    return () => this.off(event, handler);
  }

  /**
   * Registra un listener che si auto-rimuove dopo il primo trigger.
   */
  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Rimuove un listener specifico.
   */
  off(event, handler) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emette un evento verso tutti i listener.
   */
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    // Copia per evitare mutazioni durante l'iterazione
    [...set].forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Errore in handler per "${event}":`, err);
      }
    });
  }

  /**
   * Rimuove tutti i listener (utile per reset).
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Debug: elenca tutti gli eventi registrati.
   */
  debug() {
    const summary = {};
    this.listeners.forEach((set, event) => {
      summary[event] = set.size;
    });
    console.table(summary);
  }
}

// Singleton
export const bus = new EventBus();

/**
 * Catalogo degli eventi usati nell'app.
 * Usare costanti evita errori di battitura.
 */
export const EVENTS = {
  // Stato app
  APP_READY: 'app:ready',
  STATE_CHANGED: 'state:changed',

  // Cartelle
  SOURCE_FOLDER_SELECTED: 'folder:source-selected',
  DEST_FOLDER_SELECTED: 'folder:dest-selected',

  // Dati
  DB_LOADED: 'data:db-loaded',
  IA_LOADED: 'data:ia-loaded',
  DATA_ERROR: 'data:error',

  // PDF
  PDF_LIST_UPDATED: 'pdf:list-updated',
  PDF_SELECTED: 'pdf:selected',
  PDF_LOADED: 'pdf:loaded',
  PDF_PAGE_CHANGED: 'pdf:page-changed',
  PDF_ZOOM_CHANGED: 'pdf:zoom-changed',
  PDF_MODE_CHANGED: 'pdf:mode-changed',
  PDF_ERROR: 'pdf:error',

  // Ricerca
  SEARCH_OPENED: 'search:opened',
  SEARCH_CLOSED: 'search:closed',
  SEARCH_QUERY_CHANGED: 'search:query-changed',
  SEARCH_RESULTS: 'search:results',
  SEARCH_IA_MATCH: 'search:ia-match',
  SEARCH_NO_MATCH: 'search:no-match',

  // Rinomina
  RENAME_APPLIED: 'rename:applied',
  RENAME_MANUAL: 'rename:manual',
  RENAME_RESET: 'rename:reset',
  RENAME_BATCH_START: 'rename:batch-start',
  RENAME_BATCH_PROGRESS: 'rename:batch-progress',
  RENAME_BATCH_END: 'rename:batch-end',

  // Sessione
  SESSION_SAVED: 'session:saved',
  SESSION_LOADED: 'session:loaded',

  // UI
  TOAST_SHOW: 'ui:toast',
  SPINNER_SHOW: 'ui:spinner-show',
  SPINNER_HIDE: 'ui:spinner-hide',
  MODAL_OPEN: 'ui:modal-open',
  MODAL_CLOSE: 'ui:modal-close',
};