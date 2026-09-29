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
 * @returns {Array} - Array di oggetti impianto
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

  // Genera varianti della query (fallback progressivo)
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

    // 1. Match matricola (priorità alta)
    if (matricola.includes(q) || (qMatricola.length >= 2 && matricolaCompact.includes(qMatricola))) {
      matchedField = 'matricola';
    }
    // 2. Match con varianti
    else {
      for (const variant of variants) {
        if (!variant || variant.length < 2) continue;
        const v = normalizeString(variant);
        if (!v) continue;

        if (indirizzo.includes(v)) { matchedField = 'indirizzo'; matchedVariant = v; break; }
        if (localita.includes(v)) { matchedField = 'localita'; matchedVariant = v; break; }
        if (codice.includes(v)) { matchedField = 'codice'; matchedVariant = v; break; }
        if (cliente.includes(v)) { matchedField = 'cliente'; matchedVariant = v; break; }
        if (zonaField.includes(v)) { matchedField = 'zona'; matchedVariant = v; break; }
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

      // Match esatto con query originale
      if (fieldValue === q) score = 100;
      else if (fieldValue.startsWith(q)) score = 50;
      // Match con variante (meno preciso)
      else if (matchedVariant && matchedVariant !== q) {
        score = Math.min(80, 20 + matchedVariant.length * 2);
      }

      // Match esatto matricola = score massimo
      if (matchedField === 'matricola' && matricolaCompact === qMatricola) {
        score = 150;
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
 * Genera varianti della query per fallback progressivo.
 * Gestisce:
 * - Punti (A. MENGANTI → A MENGANTI → AMENGANTI)
 * - Iniziali (A. MENGANTI → MENGANTI)
 * - Parole lunghe (solo il cognome)
 */
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

  // 1. Rimuovi punti → "a menganti"
  add(query.replace(/\./g, ' ').replace(/\s+/g, ' '));

  // 2. Rimuovi punti senza spazio → "amenganti"
  add(query.replace(/\./g, '').replace(/\s+/g, ' '));

  // 3. Rimuovi iniziali puntate (singola lettera + punto)
  //    Es: "A. MENGANTI" → "MENGANTI"
  add(query.replace(/\b[A-ZÀÈÉÌÒÙ]\.\s*/gi, '').trim());

  // 4. Rimuovi prefisso stradale
  const withoutPrefix = query
    .replace(/^(VIA|VIALE|CORSO|PIAZZA|PIAZZETTA|LARGO|VICOLO|STRADA|C\.SO|V\.|V)\s+/i, '')
    .trim();
  add(withoutPrefix);

  // 5. Solo parole lunghe (≥4 caratteri)
  const source = withoutPrefix || query;
  const longWords = source
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9àèéìòù']/gi, ''))
    .filter((w) => w.length >= 4);

  if (longWords.length > 0) {
    add(longWords.join(' '));
  }

  // 6. Solo la parola più lunga
  if (longWords.length > 1) {
    const longest = longWords.reduce((a, b) => (a.length >= b.length ? a : b));
    add(longest);
  }

  // 7. Solo l'ultima parola lunga (cognome)
  if (longWords.length > 1) {
    add(longWords[longWords.length - 1]);
  }

  // 8. Prima + ultima parola lunga
  if (longWords.length >= 2) {
    add(longWords[0] + ' ' + longWords[longWords.length - 1]);
  }

  return variants;
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