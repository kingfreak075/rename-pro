/* ============================================================
   SEARCH-PANEL.JS — Drawer di ricerca e risultati
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { escapeHtml, debounce, log } from '../core/utils.js';
import * as engine from './search-engine.js';
import * as detailsModal from './details-modal.js';
import * as normalizer from '../data/normalizer.js';

let drawer, input, resultsContainer, btnOpen, btnClose, btnSearch, btnClear, btnRecent;
let selectZona;

/**
 * Inizializza il modulo.
 */
export function init() {
  drawer = document.getElementById('searchDrawer');
  input = document.getElementById('searchInput');
  resultsContainer = document.getElementById('searchResults');
  btnOpen = document.getElementById('btnOpenSearch');
  btnClose = document.getElementById('btnCloseSearch');
  btnSearch = document.getElementById('searchBtn');
  btnClear = document.getElementById('searchClear');
  btnRecent = document.getElementById('searchRecent');
  selectZona = document.getElementById('searchZona');

  if (!drawer || !input) return;

  // Apri/chiudi
  btnOpen?.addEventListener('click', open);
  btnClose?.addEventListener('click', close);

  // Ricerca
  const debouncedSearch = debounce(() => performSearch(false), 250);
  input.addEventListener('input', debouncedSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch(true);
    }
  });

  btnSearch?.addEventListener('click', () => performSearch(true));
  btnClear?.addEventListener('click', clearInput);
  btnRecent?.addEventListener('click', showRecent);

  // Zona
  selectZona?.addEventListener('change', () => {
    if (input.value.trim().length >= 2) performSearch(false);
  });

  // Click sui risultati (delegation)
  resultsContainer?.addEventListener('click', handleResultClick);

  // Eventi globali
  bus.on(EVENTS.SEARCH_OPENED, () => open());
  bus.on(EVENTS.DB_LOADED, (data) => populateZones(data.zones));

  log('Search panel inizializzato');
}

// ============================================================
// APRI / CHIUDI
// ============================================================

export function open() {
  if (!drawer) return;

  const wasOpen = drawer.classList.contains('open');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  // Focus sull'input dopo animazione
  setTimeout(() => input?.focus(), 350);

  // Emetti SEARCH_OPENED solo se non era già aperto (evita loop)
  if (!wasOpen) {
    bus.emit(EVENTS.SEARCH_OPENED);
  }
}


export function close() {
  if (!drawer) return;

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');

  // Riporta focus al bottone che ha aperto il drawer
  const btnOpen = document.getElementById('btnOpenSearch');
  if (btnOpen) btnOpen.focus();

  bus.emit(EVENTS.SEARCH_CLOSED);
}

export function toggle() {
  if (!drawer) return;
  if (drawer.classList.contains('open')) close();
  else open();
}

// ============================================================
// INPUT
// ============================================================

function clearInput() {
  if (input) input.value = '';
  if (resultsContainer) resultsContainer.innerHTML = '';
  input?.focus();
}

function populateZones(zones) {
  if (!selectZona) return;
  const current = selectZona.value;
  selectZona.innerHTML =
    '<option value="">Tutte le zone</option>' +
    (zones || []).map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('');
  if (current) selectZona.value = current;
}

// ============================================================
// RICERCA
// ============================================================

function performSearch(saveToHistory = true) {
  if (!state.excelData.loaded) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-database"></i>
        <p>Carica prima il database Excel</p>
        <p class="empty-hint">Clicca su "Carica DB" nell'header</p>
      </div>`;
    return;
  }

  const query = input.value.trim();
  if (query.length < 2) {
    resultsContainer.innerHTML = '';
    return;
  }

  const zona = selectZona?.value || '';
  const results = engine.search(query, { zona, limit: 50 });

  if (saveToHistory && query.length >= 3) {
    state.addToSearchHistory(query);
  }

  // Ottieni il civico IA corrente (se c'è un PDF selezionato con match IA positivo)
  const iaCivico = state.currentIaMatch?.civico || null;

  renderResults(results, query, iaCivico);
  bus.emit(EVENTS.SEARCH_RESULTS, { count: results.length });
}

function renderResults(results, query, iaCivico = null) {
  if (!resultsContainer) return;

  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>Nessun risultato per "${escapeHtml(query)}"</p>
        <p class="empty-hint">Prova a rimuovere il filtro zona o a cercare diversamente</p>
      </div>`;
    return;
  }

  // Normalizza il civico IA
  const civicoNormalizzato = iaCivico ? normalizeCivico(iaCivico) : null;
  const showBadge = results.length > 1 && civicoNormalizzato;

  // Prepara i risultati con info sul match civico
  const enrichedResults = results.map((imp) => {
    const indirizzo = imp['Indirizzo impianto'] || '';
    const civicoRisultato = extractCivicoFromAddress(indirizzo);
    const isCivicoMatch = showBadge &&
                          civicoRisultato &&
                          matchCivico(civicoNormalizzato, civicoRisultato);

    return { imp, indirizzo, isCivicoMatch };
  });

  // Riordina: match civico prima, poi gli altri
  enrichedResults.sort((a, b) => {
    if (a.isCivicoMatch && !b.isCivicoMatch) return -1;
    if (!a.isCivicoMatch && b.isCivicoMatch) return 1;
    return 0;
  });

  const html = enrichedResults
    .map(({ imp, isCivicoMatch }) => {
      const indirizzo = imp['Indirizzo impianto'] || '';
      const localita = imp['Località impianto'] || '';
      const matricola = imp.matricola || 'N/A';
      const commerciale = engine.getCommerciale(imp.venditore);
      const giro = engine.getGiro(imp.giro);

      const cardClasses = ['result-card', 'result-parco'];
      if (isCivicoMatch) cardClasses.push('result-civico-match');

      const badgeCivico = isCivicoMatch
        ? `<span class="badge-civico"><i class="fas fa-check"></i> civico</span>`
        : '';

      return `
        <div class="${cardClasses.join(' ')}" data-codice="${escapeHtml(imp.impianto)}">
          <div class="result-card-header">
            <div class="result-card-body">
              <div class="result-main">
                <i class="fas fa-industry"></i>
                ${highlightText(imp.impianto, query)}${badgeCivico}
                <span class="result-main-sep">-</span>
                ${highlightText(indirizzo, query)}
              </div>
              <div class="result-details">
                <span><i class="fas fa-map-pin"></i> ${escapeHtml(localita)}</span>
                <span><i class="fas fa-barcode"></i> ${escapeHtml(matricola)}</span>
              </div>
              <div class="result-badges">
                <span class="badge"><i class="fas fa-user-tie"></i> ${escapeHtml(commerciale)}</span>
                <span class="badge"><i class="fas fa-route"></i> ${escapeHtml(giro)}</span>
              </div>
            </div>
            <div class="result-card-actions">
              <button class="btn btn-ghost btn-icon" data-action="details" data-tooltip="Dettagli" data-tooltip-pos="left">
                <i class="fas fa-info-circle"></i>
              </button>
              <button class="btn btn-success btn-icon" data-action="apply" data-tooltip="Applica nome" data-tooltip-pos="left">
                <i class="fas fa-check"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  resultsContainer.innerHTML = html;
}

function highlightText(text, query) {
  if (!text || !query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex
  const regex = new RegExp(`(${q})`, 'gi');
  return escaped.replace(regex, '<span class="highlight">$1</span>');
}

// ============================================================
// AZIONI RISULTATI
// ============================================================

function handleResultClick(e) {
  const button = e.target.closest('[data-action]');
  const card = e.target.closest('.result-card');
  if (!card) return;

  const codice = card.dataset.codice;
  if (!codice) return;

  if (button) {
    e.stopPropagation();
    const action = button.dataset.action;
    if (action === 'details') {
      detailsModal.open(codice);
    } else if (action === 'apply') {
      applyRenameFromResult(codice);
    }
    return;
  }

  // Click sulla card → apre dettagli
  detailsModal.open(codice);
}

function applyRenameFromResult(codice) {
  const imp = engine.getImpiantoDetails(codice);
  if (!imp) return;

  if (state.currentSelectedIdx === -1) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Seleziona prima un PDF dalla lista',
      type: 'warning',
    });
    return;
  }

  const newName = engine.buildFileName(imp);

  state.applyRename(state.currentSelectedIdx, {
    newName,
    impianto: imp,
    iaRecord: null,
  });

  bus.emit(EVENTS.TOAST_SHOW, {
    message: `Nome applicato: ${newName}`,
    type: 'success',
  });

  close();
}

// ============================================================
// STORICO
// ============================================================

function showRecent() {
  if (!resultsContainer) return;
  if (state.searchHistory.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-history"></i>
        <p>Nessuna ricerca recente</p>
      </div>`;
    return;
  }

  resultsContainer.innerHTML = state.searchHistory
    .map((q) => `
      <div class="result-card" data-recent="${escapeHtml(q)}">
        <i class="fas fa-history" style="color:var(--primary); margin-right:10px;"></i>
        ${escapeHtml(q)}
      </div>
    `)
    .join('');

  // Click su recente → esegue ricerca
  resultsContainer.querySelectorAll('[data-recent]').forEach((el) => {
    el.addEventListener('click', () => {
      const q = el.dataset.recent;
      input.value = q;
      performSearch(false);
    });
  });
}


/**
 * Esegue una ricerca esterna (es. da "Cerca Selezione").
 * Apre il drawer, imposta il valore e avvia la ricerca.
 */
export function searchFromExternal(query) {
  if (!query) return;

  // Imposta valore
  if (input) input.value = query;

  // Apri drawer
  open();

  // Aspetta che il drawer sia visibile e che l'input sia pronto
  setTimeout(() => {
    performSearch(true);
    input?.focus();
    input?.select();
  }, 350);
}


/**
 * Estrae il civico da un indirizzo tipo "VIA TRILUSSA 5" → "5"
 * o "VIA TRILUSSA 5/A" → "5/A" o "VIA TRILUSSA 5 A" → "5 A".
 */
function extractCivicoFromAddress(address) {
  if (!address) return null;
  const str = String(address).trim();
  // Prende l'ultimo gruppo di cifre (con eventuale lettera/slash finale)
  const match = str.match(/(\d+[\/\w]?(?:\s*[A-Z])?)\s*$/i);
  return match ? match[1].trim() : null;
}

/**
 * Normalizza un civico per il confronto:
 * - "14" → "14"
 * - "14/A" → "14A"
 * - "14 A" → "14A"
 * - "14a" → "14A"
 */
function normalizeCivico(civico) {
  if (!civico) return '';
  return String(civico)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\//g, '')
    .trim();
}

/**
 * Verifica se 2 civici matchano.
 * - "14" vs "14" → true
 * - "14" vs "14A" → true (uno inizia con l'altro)
 * - "14" vs "14 A" → true (dopo normalizzazione)
 * - "14" vs "15" → false
 */
function matchCivico(civicoIA, civicoRisultato) {
  if (!civicoIA || !civicoRisultato) return false;
  const a = normalizeCivico(civicoIA);
  const b = normalizeCivico(civicoRisultato);
  if (!a || !b) return false;
  if (a === b) return true;
  // Uno inizia con l'altro (es. "14" matcha "14A")
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return false;
}