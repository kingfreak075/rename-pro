/* ============================================================
   UTILS.JS — Funzioni di utilità pura
   ============================================================ */

/**
 * Debounce: ritarda l'esecuzione di una funzione
 * finché non passano `delay` ms dall'ultima chiamata.
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle: esegue al massimo una volta ogni `limit` ms.
 */
export function throttle(fn, limit = 100) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Genera un UUID v4 (semplice, non crittografico).
 */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Escape HTML: previene XSS quando si inietta testo in innerHTML.
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape per attributi HTML.
 */
export function escapeAttr(str) {
  return escapeHtml(str);
}

/**
 * Normalizza una stringa per confronti case-insensitive e accent-insensitive.
 * Es: "Forlì" → "forli"
 */
export function normalizeString(str) {
  if (str == null) return '';
  return String(str)
    .normalize('NFD')                    // Decompone accenti
    .replace(/[\u0300-\u036f]/g, '')     // Rimuove i segni diacritici
    .toLowerCase()
    .trim();
}

/**
 * Converte un valore in numero sicuro.
 */
export function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Formatta una data Excel (seriale) o stringa in formato italiano.
 * Gestisce: numeri seriali Excel, stringhe ISO, oggetti Date, stringhe generiche.
 */
export function formatDate(value) {
  if (value == null || value === '') return 'N/A';

  // Già un oggetto Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? 'N/A' : value.toLocaleDateString('it-IT');
  }

  // Numero (seriale Excel)
  if (typeof value === 'number') {
    // Excel: 1 = 01/01/1900 (con bug del 1900)
    // Conversione: 25569 = giorni tra 1900-01-01 e 1970-01-01
    try {
      const ms = Math.round((value - 25569) * 86400 * 1000);
      const date = new Date(ms);
      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('it-IT');
    } catch {
      return 'N/A';
    }
  }

  // Stringa: prova parsing
  const str = String(value).trim();
  if (!str) return 'N/A';

  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('it-IT');
  }

  // Prova formato italiano dd/mm/yyyy
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [_, d, m, y] = match;
    const year = y.length === 2 ? '20' + y : y;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${year}`;
  }

  return str;
}

/**
 * Ritarda l'esecuzione (promise).
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chiede conferma all'utente (wrapper di confirm, per future sostituzioni con modal).
 */
export function confirmAction(message) {
  return window.confirm(message);
}

/**
 * Rimuove caratteri non validi per nomi file.
 * Sostituisce con trattino.
 */
export function sanitizeFilename(name, replacement = '-') {
  if (!name) return '';
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, replacement)  // Caratteri vietati
    .replace(/\s+/g, ' ')                             // Spazi multipli → singolo
    .replace(new RegExp(`\\${replacement}+`, 'g'), replacement) // Trattini multipli
    .replace(new RegExp(`^\\${replacement}|\\${replacement}$`, 'g'), '') // Trim
    .trim();
}

/**
 * Rimuove l'estensione .pdf da un nome file.
 */
export function stripPdfExtension(name) {
  return String(name || '').replace(/\.pdf$/i, '');
}

/**
 * Assicura che il nome termini con .pdf.
 */
export function ensurePdfExtension(name) {
  const clean = String(name || '').trim();
  if (!clean) return '';
  return /\.pdf$/i.test(clean) ? clean : clean + '.pdf';
}

/**
 * Clona in profondità un oggetto semplice (JSON-safe).
 */
export function deepClone(obj) {
  if (obj == null) return obj;
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * Raggruppa un array per chiave.
 */
export function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

/**
 * Rimuove duplicati da un array (per valore primitivo).
 */
export function unique(array) {
  return [...new Set(array)];
}

/**
 * Log condizionale (solo se DEBUG attivo).
 */
export const DEBUG = true;

export function log(...args) {
  if (DEBUG) console.log('[RenamePro]', ...args);
}

export function warn(...args) {
  if (DEBUG) console.warn('[RenamePro]', ...args);
}

export function error(...args) {
  console.error('[RenamePro]', ...args);
}