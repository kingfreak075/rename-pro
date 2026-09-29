/* ============================================================
   SCORE-ENGINE.JS — Calcolo score di confidenza (0-3)
   ============================================================ */

import { state } from '../core/state.js';
import { log, warn } from '../core/utils.js';
import * as matcher from '../data/matcher.js';
import * as normalizer from '../data/normalizer.js';

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

  // 4. Prova match per matricola (più affidabile)
  // 4. Prova match per matricola (più affidabile)
  const matricolaMatch = tryMatricolaMatch(iaRecord);
  if (matricolaMatch.matched) {
    // Se match esatto e univoco → score 3
    if (matricolaMatch.quality === 'exact' && matricolaMatch.count === 1) {
      return { score: 3, reason: 'Matricola univoca (esatta)', matchCount: 1, matchedBy: 'matricola' };
    }
    // Se match "short" (parziale) e univoco → score 3 (fiducioso ma meno)
    if (matricolaMatch.quality === 'short' && matricolaMatch.count === 1) {
      return { score: 3, reason: 'Matricola univoca (parziale)', matchCount: 1, matchedBy: 'matricola' };
    }
    // Se multipli match → score 2
    if (matricolaMatch.count >= 2 && matricolaMatch.count <= 3) {
      return { score: 2, reason: `Matricola con ${matricolaMatch.count} match`, matchCount: matricolaMatch.count, matchedBy: 'matricola' };
    }
    if (matricolaMatch.count > 3) {
      return { score: 1, reason: `Matricola con ${matricolaMatch.count} match`, matchCount: matricolaMatch.count, matchedBy: 'matricola' };
    }
  }

  // 5. Fallback: match per indirizzo
  if (iaRecord.indirizzo) {
    const indirizzoQuery = normalizer.extractSearchableAddress(iaRecord.indirizzo);
    if (indirizzoQuery.length >= 3) {
      const indirizzoMatches = countMatchesInParco(indirizzoQuery);
      if (indirizzoMatches === 1) {
        return { score: 3, reason: 'Indirizzo univoco', matchCount: 1, matchedBy: 'indirizzo' };
      }
      if (indirizzoMatches >= 2 && indirizzoMatches <= 3) {
        return { score: 2, reason: 'Indirizzo con pochi match', matchCount: indirizzoMatches, matchedBy: 'indirizzo' };
      }
      if (indirizzoMatches > 3) {
        return { score: 1, reason: 'Indirizzo con molti match', matchCount: indirizzoMatches, matchedBy: 'indirizzo' };
      }
    }
  }

  return { score: 0, reason: 'Nessun match trovato nel PARCO', matchCount: 0 };
}

/**
 * Prova un match per matricola.
 * Restituisce { matched: boolean, count: number, quality: 'exact'|'short'|'none' }.
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

    // Match esatto
    if (parcoKeys.compact === iaKeys.compact) {
      exactCount++;
    }
    // Match "short" (uno contiene l'altro)
    else if (
      iaKeys.short.length >= 3 &&
      parcoKeys.compact === iaKeys.short
    ) {
      shortCount++;
    }
    else if (
      parcoKeys.short.length >= 3 &&
      parcoKeys.short === iaKeys.compact
    ) {
      shortCount++;
    }
  }

  if (exactCount > 0) {
    return { matched: true, count: exactCount, quality: 'exact' };
  }
  if (shortCount > 0) {
    return { matched: true, count: shortCount, quality: 'short' };
  }

  return { matched: false, count: 0, quality: 'none' };
}

/**
 * Conta i match nel PARCO per una query.
 */
function countMatchesInParco(query) {
  if (!query) return 0;

  const q = query.toLowerCase();
  let count = 0;

  for (const imp of state.excelData.parco) {
    const indirizzo = (imp['Indirizzo impianto'] || '').toLowerCase();
    const localita = (imp['Località impianto'] || '').toLowerCase();

    if (indirizzo.includes(q) || localita.includes(q)) {
      count++;
    }
  }

  return count;
}

/**
 * Calcola lo score per TUTTI i PDF pending (non processati).
 * Filtra: solo item con status 'pending' o mai processati.
 *
 * @param {Object} options - { force: boolean } → se true, ricalcola anche i processati
 * @returns {Object} - Riepilogo { total, updated, skipped, scores: {...} }
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
      // Conta comunque nello storico
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

/**
 * Formatta secondi in "Xh Ym" o "Ym Zs".
 */
function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}