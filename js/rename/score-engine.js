/* ============================================================
   SCORE-ENGINE.JS — Calcolo score di confidenza (0-3)
   ============================================================ */

import { state } from '../core/state.js';
import { log, warn } from '../core/utils.js';
import * as matcher from '../data/matcher.js';
import * as normalizer from '../data/normalizer.js';
import * as searchEngine from '../search/search-engine.js';

/**
 * Calcola lo score per un singolo PDF.
 *
 * Ordine di priorità:
 *   1. Matricola esatta → score 3
 *   2. Civico univoco → score 3 (NUOVO)
 *   3. Matricola parziale → score 3
 *   4. Indirizzo Ciclo 1 → score 3/2/1
 *   5. Nessun match → score 0
 *
 * @param {Object} pdfItem - Item dalla lista PDF
 * @returns {Object} - { score: 0-3, reason: string, matchCount: number, matchedBy: string }
 */
export function computeScoreForPdf(pdfItem) {
  if (!pdfItem) return { score: 0, reason: 'PDF non valido', matchCount: 0 };

  if (!state.iaData.loaded) {
    return { score: 0, reason: 'IA non caricata', matchCount: 0 };
  }
  if (!state.excelData.loaded) {
    return { score: 0, reason: 'DB non caricato', matchCount: 0 };
  }

  // 1. Trova record IA
  const iaRecord = matcher.findIaRecord(pdfItem.name);
  if (!iaRecord) {
    return { score: 0, reason: 'Nessun match IA per il nome file', matchCount: 0 };
  }

  // 2. Verifica esito
  if (iaRecord.esito !== 'Positivo') {
    return { score: 0, reason: `Esito IA: ${iaRecord.esito || 'sconosciuto'}`, matchCount: 0 };
  }

  // 3. Verifica presenza dati utili
  if (!iaRecord.indirizzo && !iaRecord.matricola) {
    return { score: 0, reason: 'Record IA senza indirizzo né matricola', matchCount: 0 };
  }

  // 4. PRIORITÀ 1: MATRICOLA ESATTA
  const matricolaResult = tryMatricolaMatch(iaRecord);
  if (matricolaResult.matched && matricolaResult.quality === 'exact' && matricolaResult.count === 1) {
    return {
      score: 3,
      reason: 'Matricola esatta univoca',
      matchCount: 1,
      matchedBy: 'matricola',
    };
  }

  // 5. PRIORITÀ 2: CIVICO UNIVOCO (NUOVO)
  const civicoResult = tryCivicoSearch(iaRecord);
  if (civicoResult) {
    return civicoResult;
  }

  // 6. PRIORITÀ 3: MATRICOLA PARZIALE
  if (matricolaResult.matched) {
    if (matricolaResult.count === 1) {
      return {
        score: 3,
        reason: 'Matricola univoca (parziale)',
        matchCount: 1,
        matchedBy: 'matricola',
      };
    }
    if (matricolaResult.count >= 2 && matricolaResult.count <= 3) {
      return {
        score: 2,
        reason: `Matricola con ${matricolaResult.count} match`,
        matchCount: matricolaResult.count,
        matchedBy: 'matricola',
      };
    }
    if (matricolaResult.count > 3) {
      return {
        score: 1,
        reason: `Matricola con ${matricolaResult.count} match`,
        matchCount: matricolaResult.count,
        matchedBy: 'matricola',
      };
    }
  }

  // 7. PRIORITÀ 4: INDIRIZZO (Ciclo 1)
  if (iaRecord.indirizzo) {
    const indirizzoQuery = normalizer.extractSearchableAddress(iaRecord.indirizzo);
    if (indirizzoQuery.length >= 3) {
      const indirizzoMatches = searchEngine.search(indirizzoQuery, { limit: 50 });
      const n = indirizzoMatches.length;

      if (n === 1) {
        return {
          score: 3,
          reason: 'Indirizzo univoco',
          matchCount: 1,
          matchedBy: 'indirizzo',
        };
      }
      if (n >= 2 && n <= 3) {
        return {
          score: 2,
          reason: `Indirizzo con ${n} match`,
          matchCount: n,
          matchedBy: 'indirizzo',
        };
      }
      if (n > 3) {
        return {
          score: 1,
          reason: `Indirizzo con ${n} match`,
          matchCount: n,
          matchedBy: 'indirizzo',
        };
      }
    }
  }

  return { score: 0, reason: 'Nessun match trovato nel PARCO', matchCount: 0 };
}

/**
 * Prova un match per matricola.
 * @returns {Object} - { matched, count, quality: 'exact'|'short'|'none' }
 */
function tryMatricolaMatch(iaRecord) {
  if (!iaRecord.matricola) return { matched: false, count: 0, quality: 'none' };

  const iaKeys = normalizer.getMatricolaKeys(iaRecord.matricola);
  if (!iaKeys.compact || iaKeys.compact.length < 3) {
    return { matched: false, count: 0, quality: 'none' };
  }

  let exactCount = 0;
  let shortCount = 0;

  for (const imp of state.excelData.parco) {
    const parcoKeys = normalizer.getMatricolaKeys(imp.matricola);
    if (!parcoKeys.compact) continue;

    if (parcoKeys.compact === iaKeys.compact) {
      exactCount++;
    } else if (
      (iaKeys.short.length >= 3 && parcoKeys.compact === iaKeys.short) ||
      (parcoKeys.short.length >= 3 && parcoKeys.short === iaKeys.compact)
    ) {
      shortCount++;
    }
  }

  if (exactCount > 0) return { matched: true, count: exactCount, quality: 'exact' };
  if (shortCount > 0) return { matched: true, count: shortCount, quality: 'short' };

  return { matched: false, count: 0, quality: 'none' };
}

/**
 * Prova una ricerca con la via + civico.
 * Restituisce un risultato score SOLO se il Ciclo 2 dà esito interessante.
 * Altrimenti null (fallback al Ciclo 1).
 */
function tryCivicoSearch(iaRecord) {
  if (!iaRecord.indirizzo) return null;
  if (!iaRecord.civico) return null;

  const viaPulita = normalizer.extractSearchableAddress(iaRecord.indirizzo);
  if (!viaPulita || viaPulita.length < 3) return null;

  const civico = String(iaRecord.civico).trim();
  if (!civico) return null;

  // Ciclo 1: solo via
  const results1 = searchEngine.search(viaPulita, { limit: 50 });

  // Se Ciclo 1 ha già 1 solo risultato, non serve il civico
  if (results1.length <= 1) return null;

  // Ciclo 2: via + civico
  const query2 = `${viaPulita} ${civico}`;
  const results2 = searchEngine.search(query2, { limit: 50 });

  if (results2.length === 1) {
    return {
      score: 3,
      reason: 'Match univoco con civico',
      matchCount: 1,
      matchedBy: 'civico',
    };
  }

  if (results2.length >= 2 && results2.length <= 3) {
    return {
      score: 2,
      reason: `Civico con ${results2.length} match`,
      matchCount: results2.length,
      matchedBy: 'civico',
    };
  }

  if (results2.length > 3) {
    return {
      score: 1,
      reason: `Civico con ${results2.length} match`,
      matchCount: results2.length,
      matchedBy: 'civico',
    };
  }

  // Ciclo 2 vuoto → fallback al Ciclo 1
  return null;
}

/**
 * Calcola lo score per TUTTI i PDF pending.
 */
export function computeAllScores(options = {}) {
  const { force = false } = options;

  if (!state.iaData.loaded) {
    warn('Impossibile calcolare score: IA non caricata');
    return null;
  }
  if (!state.excelData.loaded) {
    warn('Impossibile calcolare score: DB non caricato');
    return null;
  }
  if (state.pdfItems.length === 0) {
    warn('Impossibile calcolare score: nessun PDF caricato');
    return null;
  }

  let updated = 0;
  let skipped = 0;
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };

  for (const item of state.pdfItems) {
    if (!force && item.status === 'processed' && item.score != null) {
      if (item.score != null) distribution[item.score]++;
      skipped++;
      continue;
    }

    const result = computeScoreForPdf(item);
    item.score = result.score;
    item.scoreReason = result.reason;
    item.scoreMatchCount = result.matchCount;
    item.scoreMatchedBy = result.matchedBy || null;

    distribution[result.score]++;
    updated++;

    log(`Score [${result.score}] ${item.name} → ${result.reason}`);
  }

  log(`Score calcolati: ${updated} aggiornati, ${skipped} saltati`);

  return {
    total: state.pdfItems.length,
    updated,
    skipped,
    distribution,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Stima del tempo di lavoro.
 */
export function estimateTime(distribution) {
  if (!distribution) return null;
  const SECONDS = { 3: 15, 2: 45, 1: 90, 0: 120 };
  let totalSeconds = 0;
  for (const score of [0, 1, 2, 3]) {
    totalSeconds += (distribution[score] || 0) * SECONDS[score];
  }
  return formatTime(totalSeconds);
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}