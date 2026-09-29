/* ============================================================
   MATCHER.JS — Matching nome file IA ↔ PDF
   ============================================================ */

import { state } from '../core/state.js';
import { log, warn } from '../core/utils.js';

/**
 * Cerca il record IA corrispondente a un nome file PDF.
 * @param {string} pdfFileName - Nome file del PDF (es. "verbale.pdf")
 * @returns {Object|null} - Record IA o null
 */
export function findIaRecord(pdfFileName) {
  if (!state.iaData.loaded || !pdfFileName) return null;

  const key = pdfFileName.toLowerCase().trim();
  const record = state.iaData.byFilename.get(key);

  if (record) {
    log(`Match IA trovato per "${pdfFileName}"`);
  }

  return record || null;
}

/**
 * Verifica se un record IA è utilizzabile per il suggerimento.
 * Un record è utilizzabile se:
 * - Ha esito "Positivo"
 * - Ha almeno un indirizzo o una matricola
 */
export function isIaRecordUsable(record) {
  if (!record) return false;
  if (record.esito !== 'Positivo') return false;
  if (!record.indirizzo && !record.matricola) return false;
  return true;
}

/**
 * Restituisce l'indirizzo IA pulito (senza civico) per la ricerca.
 * Usato per precompilare il campo di ricerca.
 */
export function getIaSearchQuery(record) {
  if (!record || !record.indirizzo) return '';
  return record.indirizzo.trim();
}

/**
 * Restituisce l'indirizzo completo con civico (per mostrare nel pannello).
 */
export function getIaFullAddress(record) {
  if (!record) return '';
  const parts = [record.indirizzo, record.civico].filter((p) => p && p.trim());
  return parts.join(' ').trim();
}