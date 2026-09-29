/* ============================================================
   SCORE-BANNER.JS — Banner riepilogo score + stima tempo
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log } from '../core/utils.js';
import * as scoreEngine from '../rename/score-engine.js';

let banner, stat0, stat1, stat2, stat3, estimateEl;
let btnGoToSafe, btnRecalcScore;

/**
 * Inizializza il modulo.
 */
export function init() {
  banner = document.getElementById('scoreBanner');
  stat0 = document.getElementById('scoreStat0');
  stat1 = document.getElementById('scoreStat1');
  stat2 = document.getElementById('scoreStat2');
  stat3 = document.getElementById('scoreStat3');
  estimateEl = document.getElementById('scoreEstimate');
  btnGoToSafe = document.getElementById('btnGoToSafe');
  btnRecalcScore = document.getElementById('btnRecalcScore');

  if (!banner) {
    console.warn('[ScoreBanner] Banner non trovato');
    return;
  }

  // Binding bottoni
  btnGoToSafe?.addEventListener('click', goToSafe);
  btnRecalcScore?.addEventListener('click', recalcScore);

  // Ascolta eventi
  bus.on('score:computed', () => update());
  bus.on(EVENTS.PDF_LIST_UPDATED, () => update());

  // Stato iniziale
  update();

  log('Score banner inizializzato');
}

/**
 * Aggiorna il banner con i dati correnti.
 */
export function update() {
  if (!banner) return;

  // Se non ci sono score calcolati, nascondi banner
  if (!state.hasScores()) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;

  // Distribuzione
  const dist = state.getScoreDistribution();
  const total = state.pdfItems.length;

  // Aggiorna contatori
  updateStat(stat3, dist[3], total, '3');
  updateStat(stat2, dist[2], total, '2');
  updateStat(stat1, dist[1], total, '1');
  updateStat(stat0, dist[0], total, '0');

  // Stima tempo
  if (estimateEl) {
    const stima = scoreEngine.estimateTime(dist);
    estimateEl.textContent = stima || '—';
  }
}

/**
 * Aggiorna un singolo stat con percentuale.
 */
function updateStat(el, count, total, score) {
  if (!el) return;
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
  el.textContent = `${getEmoji(score)} ${count} (${pct}%)`;
}

function getEmoji(score) {
  return { 3: '🟢', 2: '🟡', 1: '🟠', 0: '🔴' }[score] || '⚪';
}

/**
 * Azione: vai ai match sicuri (score 3).
 */
function goToSafe() {
  // Attiva filtro score = 3
  state.setScoreFilter('3');

  // Attiva ordinamento per score
  state.setSortBy('score-desc');

  // Aggiorna chip UI
  document.querySelectorAll('.score-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.score === '3');
  });

  // Aggiorna select sort
  const sortSelect = document.getElementById('sortBy');
  if (sortSelect) sortSelect.value = 'score-desc';

  // Scroll lista in cima
  const list = document.getElementById('pdfList');
  if (list) list.scrollTop = 0;

  bus.emit(EVENTS.TOAST_SHOW, {
    message: 'Filtrati i match sicuri (score 3)',
    type: 'info',
    duration: 2500,
  });
}

/**
 * Azione: ricalcola score (delega al bottone principale).
 */
function recalcScore() {
  const mainBtn = document.getElementById('btnCalcScore');
  if (mainBtn && !mainBtn.disabled) {
    mainBtn.click();
  }
}