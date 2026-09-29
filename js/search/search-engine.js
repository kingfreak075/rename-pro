/* ============================================================
   SEARCH-ENGINE.JS — Query sul database PARCO
   ============================================================ */

import { state } from '../core/state.js';
import { normalizeString, log } from '../core/utils.js';
import { normalizeMatricolaForSearch } from '../data/normalizer.js';

/**
 * Esegue una ricerca nel database PARCO.
 * @param {string} query
 * @param {Object} options - { zona: string, limit: number }
 * @returns {Array} - Array di oggetti impianto con score
 */
export function search(query, options = {}) {
  const { zona = '', limit = 50 } = options;

  if (!state.excelData.loaded) {
    return [];
  }

  const q = normalizeString(query);
  const qMatricola = normalizeMatricolaForSearch(query);

  if (!q || q.length < 2) {
    return [];
  }

  const results = [];

  for (const imp of state.excelData.parco) {
    // Filtro zona
    if (zona && imp.zona != zona) continue;

    const indirizzo = normalizeString(imp['Indirizzo impianto']);
    const localita = normalizeString(imp['Località impianto']);
    const codice = normalizeString(imp.impianto);
    const matricola = normalizeString(imp.matricola);
    const matricolaCompact = normalizeMatricolaForSearch(imp.matricola);
    const cliente = normalizeString(imp.Cliente);
    const zonaField = normalizeString(imp.zona);

    let matchedField = null;

    // Match su matricola (doppio: normale + compact)
    if (matricola.includes(q) || (qMatricola.length >= 2 && matricolaCompact.includes(qMatricola))) {
      matchedField = 'matricola';
    }
    else if (indirizzo.includes(q)) matchedField = 'indirizzo';
    else if (localita.includes(q)) matchedField = 'localita';
    else if (codice.includes(q)) matchedField = 'codice';
    else if (cliente.includes(q)) matchedField = 'cliente';
    else if (zonaField.includes(q)) matchedField = 'zona';

    if (matchedField) {
      let score = 10;
      const fieldValue =
        matchedField === 'indirizzo' ? indirizzo :
        matchedField === 'localita' ? localita :
        matchedField === 'codice' ? codice :
        matchedField === 'matricola' ? matricola :
        matchedField === 'cliente' ? cliente :
        zonaField;

      if (fieldValue === q) score = 100;
      else if (fieldValue.startsWith(q)) score = 50;

      // Match esatto di matricola = score massimo
      if (matchedField === 'matricola' && matricolaCompact === qMatricola) {
        score = 150;
      }

      results.push({ impianto: imp, score, matchedField });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => r.impianto);
}

/**
 * Restituisce i dettagli completi di un impianto.
 */
export function getImpiantoDetails(codice) {
  if (!state.excelData.loaded) return null;
  return state.excelData.parco.find((i) => i.impianto == codice) || null;
}

/**
 * Restituisce le annotazioni per un impianto.
 */
export function getAnnotazioni(codice, limit = 5) {
  if (!state.excelData.loaded) return [];
  return state.excelData.annotazioni
    .filter((a) => a.impianto_ann == codice)
    .slice(0, limit);
}

/**
 * Restituisce i documenti (ELENCO) per un impianto.
 */
export function getDocumenti(codice) {
  if (!state.excelData.loaded) return [];
  return state.excelData.elenco.filter((d) => d.IMPIANTO == codice);
}

/**
 * Restituisce il nome del commerciale (da mappature).
 */
export function getCommerciale(codice) {
  if (!state.excelData.loaded) return 'N/A';
  return state.excelData.mappature.commerciali[codice] || codice || 'N/A';
}

/**
 * Restituisce il nome del giro (da mappature).
 */
export function getGiro(codice) {
  if (!state.excelData.loaded) return 'N/A';
  return state.excelData.mappature.giri[codice] || codice || 'N/A';
}

/**
 * Genera il nome file finale da un impianto.
 */
export function buildFileName(impianto) {
  if (!impianto) return '';
  return `${impianto.impianto}_BIE.pdf`;
}