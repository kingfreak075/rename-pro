/* ============================================================
   SCORE-ENGINE.JS — Calcolo score di confidenza (0-3)
   ============================================================ */

import { state } from '../core/state.js';
import { log, warn } from '../core/utils.js';
import * as matcher from '../data/matcher.js';
import * as searchEngine from '../search/search-engine.js';

/**
 * Calcola lo score per un singolo PDF.
 *
 * Scala:
 *   3 = 1 solo match nel PARCO (sicuro)
 *   2 = 2-3 match nel PARCO (probabile)
 *   1 = >3 match nel PARCO (incerto)
 *   0 = nessun match / IA Negativo / IA assente
 *
 * @param {Object} pdfItem - Item dalla lista PDF
 * @returns {Object} - { score: 0-3, reason: string, matchCount: number }
 */
export function computeScoreForPdf(pdfItem) {
  if (!pdfItem) return { score: 0, reason: 'PDF non valido', matchCount: 0 };

  // Verifica prerequisiti
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

  // 4. Prova match per MATRICOLA (più affidabile)
  if (iaRecord.matricola) {
    const matricolaResults = searchEngine.search(iaRecord.matricola, { limit: 10 });
    if (matricolaResults.length === 1) {
      return { score: 3, reason: 'Matricola univoca', matchCount: 1, matchedBy: 'matricola' };
    }
    if (matricolaResults.length >= 2 && matricolaResults.length <= 3) {
      return { score: 2, reason: `Matricola con ${matricolaResults.length} match`, matchCount: matricolaResults.length, matchedBy: 'matricola' };
    }
    if (matricolaResults.length > 3) {
      return { score: 1, reason: `Matricola con ${matricolaResults.length} match`, matchCount: matricolaResults.length, matchedBy: 'matricola' };
    }
    // 0 risultati → prova indirizzo
  }

  // 5. Fallback: match per INDIRIZZO
  if (iaRecord.indirizzo) {
    const indirizzoResults = searchEngine.search(iaRecord.indirizzo, { limit: 10 });
    if (indirizzoResults.length === 1) {
      return { score: 3, reason: 'Indirizzo univoco', matchCount: 1, matchedBy: 'indirizzo' };
    }
    if (indirizzoResults.length >= 2 && indirizzoResults.length <= 3) {
      return { score: 2, reason: `Indirizzo con ${indirizzoResults.length} match`, matchCount: indirizzoResults.length, matchedBy: 'indirizzo' };
    }
    if (indirizzoResults.length > 3) {
      return { score: 1, reason: `Indirizzo con ${indirizzoResults.length} match`, matchCount: indirizzoResults.length, matchedBy: 'indirizzo' };
    }
  }

  return { score: 0, reason: 'Nessun match trovato nel PARCO', matchCount: 0 };
}

/**
 * Calcola lo score per TUTTI i PDF pending (non processati).
 * Filtra: solo item con status 'pending' o mai processati.
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
    // Salta i processati (a meno che force=true)
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
 * Calcola la stima del tempo di lavoro in base agli score.
 * Assunzioni:
 *   score 3 → 15 sec (1 click)
 *   score 2 → 45 sec (scelta tra pochi)
 *   score 1 → 90 sec (raffinare ricerca)
 *   score 0 → 120 sec (manuale)
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

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}