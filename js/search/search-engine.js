/* ============================================================
   SEARCH-ENGINE.JS — Query sul database PARCO
   ============================================================ */

import { state } from '../core/state.js';
import { normalizeString, log } from '../core/utils.js';
import { normalizeMatricolaForSearch } from '../data/normalizer.js';

export function search(query, options = {}) {
  const { zona = '', limit = 50 } = options;

  if (!state.excelData.loaded) return [];

  const q = normalizeString(query);
  const qMatricola = normalizeMatricolaForSearch(query);

  if (!q || q.length < 2) return [];

  const variants = generateQueryVariants(query);
  log(`Varianti per "${query}":`, variants);

  const results = [];
  const seen = new Set();

  for (const imp of state.excelData.parco) {
    if (zona && imp.zona != zona) continue;

    const indirizzo = normalizeString(imp['Indirizzo impianto']);
    const localita = normalizeString(imp['Località impianto']);
    const codice = normalizeString(imp.impianto);
    const matricola = normalizeString(imp.matricola);
    const matricolaCompact = normalizeMatricolaForSearch(imp.matricola);
    const cliente = normalizeString(imp.Cliente);
    const zonaField = normalizeString(imp.zona);

    let matchedField = null;
    let matchedVariant = null;
    let matchedQuality = 'low';

    // 1. Match matricola (priorità alta)
    if (matricola.includes(q) || (qMatricola.length >= 2 && matricolaCompact.includes(qMatricola))) {
      matchedField = 'matricola';
      matchedQuality = 'exact';
    }
    // 2. Match con varianti
    else {
      for (const variant of variants) {
        if (!variant || variant.length < 2) continue;
        const v = normalizeString(variant);
        if (!v) continue;

        // Prova match con parola intera
        if (matchWholeWord(v, indirizzo)) {
          matchedField = 'indirizzo'; matchedVariant = v; matchedQuality = 'word'; break;
        }
        if (matchWholeWord(v, localita)) {
          matchedField = 'localita'; matchedVariant = v; matchedQuality = 'word'; break;
        }
        if (matchWholeWord(v, codice)) {
          matchedField = 'codice'; matchedVariant = v; matchedQuality = 'word'; break;
        }
        if (matchWholeWord(v, cliente)) {
          matchedField = 'cliente'; matchedVariant = v; matchedQuality = 'word'; break;
        }
        if (matchWholeWord(v, zonaField)) {
          matchedField = 'zona'; matchedVariant = v; matchedQuality = 'word'; break;
        }

        // Fallback: match semplice (includes)
        if (indirizzo.includes(v)) { matchedField = 'indirizzo'; matchedVariant = v; matchedQuality = 'low'; break; }
        if (localita.includes(v)) { matchedField = 'localita'; matchedVariant = v; matchedQuality = 'low'; break; }
        if (codice.includes(v)) { matchedField = 'codice'; matchedVariant = v; matchedQuality = 'low'; break; }
        if (cliente.includes(v)) { matchedField = 'cliente'; matchedVariant = v; matchedQuality = 'low'; break; }
        if (zonaField.includes(v)) { matchedField = 'zona'; matchedVariant = v; matchedQuality = 'low'; break; }
      }
    }

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
      else if (matchedQuality === 'word') score = 40;
      else if (matchedVariant && matchedVariant !== q) {
        score = Math.min(80, 20 + matchedVariant.length * 2);
      }

      // Pesi per campo (moderati)
      const fieldWeights = {
        matricola: 1.5,
        codice: 1.2,
        indirizzo: 1.0,
        localita: 0.8,   // ← meno penalizzante di prima
        cliente: 0.9,
        zona: 0.7,
      };
      score = Math.round(score * (fieldWeights[matchedField] || 1.0));

      if (matchedQuality === 'word') score += 10;

      if (matchedField === 'matricola' && matricolaCompact === qMatricola) {
        score = 200;
      }

      const id = String(imp.impianto);
      if (!seen.has(id)) {
        seen.add(id);
        results.push({ impianto: imp, score, matchedField });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => r.impianto);
}

/**
 * Verifica se una stringa matcha una PAROLA INTERA (non sottostringa).
 * Es: "maggiore" matcha "VIA MAGGIORE 1" ma NON "MAGGIORELLI"
 * Supporta anche query multi-parola: "santa maria" matcha "VIA SANTA MARIA 1"
 */
function matchWholeWord(query, fieldValue) {
  if (!query || !fieldValue) return false;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b prima e dopo la query → garantisce confini di parola
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(fieldValue);
}

function generateQueryVariants(query) {
  const variants = [query];
  const seen = new Set([query.toLowerCase().trim()]);

  const add = (v) => {
    const clean = String(v).trim();
    if (clean.length >= 3 && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      variants.push(clean);
    }
  };

  add(query.replace(/\./g, ' ').replace(/\s+/g, ' '));
  add(query.replace(/\./g, '').replace(/\s+/g, ' '));
  add(query.replace(/\b[A-ZÀÈÉÌÒÙ]\.\s*/gi, '').trim());

  const withoutPrefix = query
    .replace(/^(VIA|VIALE|CORSO|PIAZZA|PIAZZETTA|LARGO|VICOLO|STRADA|C\.SO|V\.|V)\s+/i, '')
    .trim();
  add(withoutPrefix);

  const source = withoutPrefix || query;
  const longWords = source
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9àèéìòù']/gi, ''))
    .filter((w) => w.length >= 4);

  if (longWords.length > 0) add(longWords.join(' '));
  if (longWords.length > 1) {
    const longest = longWords.reduce((a, b) => (a.length >= b.length ? a : b));
    add(longest);
    add(longWords[longWords.length - 1]);
    add(longWords[0] + ' ' + longWords[longWords.length - 1]);
  }

  return variants;
}

export function getImpiantoDetails(codice) {
  if (!state.excelData.loaded) return null;
  return state.excelData.parco.find((i) => i.impianto == codice) || null;
}

export function getAnnotazioni(codice, limit = 5) {
  if (!state.excelData.loaded) return [];
  return state.excelData.annotazioni.filter((a) => a.impianto_ann == codice).slice(0, limit);
}

export function getDocumenti(codice) {
  if (!state.excelData.loaded) return [];
  return state.excelData.elenco.filter((d) => d.IMPIANTO == codice);
}

export function getCommerciale(codice) {
  if (!state.excelData.loaded) return 'N/A';
  return state.excelData.mappature.commerciali[codice] || codice || 'N/A';
}

export function getGiro(codice) {
  if (!state.excelData.loaded) return 'N/A';
  return state.excelData.mappature.giri[codice] || codice || 'N/A';
}

export function buildFileName(impianto) {
  if (!impianto) return '';
  return `${impianto.impianto}_BIE.pdf`;
}