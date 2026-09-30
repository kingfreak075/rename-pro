/* ============================================================
   SEARCH-ENGINE.JS — Query sul database PARCO
   ============================================================ */

import { state } from '../core/state.js';
import { normalizeString, log } from '../core/utils.js';
import { normalizeMatricolaForSearch } from '../data/normalizer.js';

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

  const variants = generateQueryVariants(query);
  log(`Varianti per "${query}":`, variants);

  // ============================================================
  // APPROCCIO EARLY-STOP:
  // Prova le varianti dalla più specifica alla più generica.
  // Appena una variante trova risultati "buoni", usa SOLO quelli.
  // ============================================================

  const allResults = [];
  const seen = new Set();

  for (const variant of variants) {
    if (!variant || variant.length < 2) continue;
    const v = normalizeString(variant);
    if (!v) continue;

    // Cerca questa variante in TUTTI gli impianti
    const variantResults = [];

    for (const imp of state.excelData.parco) {
      if (zona && imp.zona != zona) continue;

      const id = String(imp.impianto);
      if (seen.has(id)) continue; // Già trovato in una variante precedente

      const indirizzo = normalizeString(imp['Indirizzo impianto']);
      const localita = normalizeString(imp['Località impianto']);
      const codice = normalizeString(imp.impianto);
      const matricola = normalizeString(imp.matricola);
      const matricolaCompact = normalizeMatricolaForSearch(imp.matricola);
      const cliente = normalizeString(imp.Cliente);
      const zonaField = normalizeString(imp.zona);

      let matchedField = null;
      let score = 10;

      // Match matricola (priorità assoluta)
      if (matricola.includes(q) || (qMatricola.length >= 2 && matricolaCompact.includes(qMatricola))) {
        matchedField = 'matricola';
        score = (matricolaCompact === qMatricola) ? 200 : 100;
      }
      // Match indirizzo
      else if (indirizzo.includes(v)) {
        matchedField = 'indirizzo';
        score = 80;
        if (indirizzo === v) score = 150;
        else if (indirizzo.startsWith(v)) score = 120;
      }
      // Match località
      else if (localita.includes(v)) {
        matchedField = 'localita';
        score = 40;
      }
      // Match codice
      else if (codice.includes(v)) {
        matchedField = 'codice';
        score = 60;
      }
      // Match cliente
      else if (cliente.includes(v)) {
        matchedField = 'cliente';
        score = 30;
      }
      // Match zona
      else if (zonaField.includes(v)) {
        matchedField = 'zona';
        score = 20;
      }

      if (matchedField) {
        variantResults.push({ impianto: imp, score, matchedField });
      }
    }

    // Se questa variante ha trovato risultati, usa SOLO questi
    if (variantResults.length > 0) {
      log(`Variante "${variant}" → ${variantResults.length} risultati. STOP.`);
      
      for (const r of variantResults) {
        const id = String(r.impianto.impianto);
        seen.add(id);
        allResults.push(r);
      }
      
      // EARLY STOP: non provare varianti più generiche
      break;
    }
  }

  allResults.sort((a, b) => b.score - a.score);
  return allResults.slice(0, limit).map((r) => r.impianto);
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