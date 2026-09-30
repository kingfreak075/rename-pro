

/* ============================================================
   LIST.JS — Rendering lista PDF + filtri
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { escapeHtml, stripPdfExtension } from '../core/utils.js';
import * as normalizer from '../data/normalizer.js';

let listContainer = null;

/**
 * Inizializza il modulo.
 */
export function init() {
  listContainer = document.getElementById('pdfList');
  if (!listContainer) {
    console.warn('[List] Container #pdfList non trovato');
    return;
  }

  bindFilters();
  render();

  // Reagisci agli eventi
  bus.on(EVENTS.PDF_LIST_UPDATED, () => render());
  bus.on(EVENTS.PDF_SELECTED, () => render());
}

// ============================================================
// RENDERING
// ============================================================

export function render() {
  if (!listContainer) return;

  const items = state.getFilteredPdfItems();

  // Lista vuota
  if (items.length === 0) {
    if (state.pdfItems.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>Seleziona una cartella per iniziare</p>
        </div>`;
    } else {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-filter"></i>
          <p>Nessun PDF in questa categoria</p>
        </div>`;
    }
    return;
  }

  // Render lista
  listContainer.innerHTML = items
    .map((item) => renderItem(item))
    .join('');

  // Binding eventi post-render
  bindItemEvents();
}

/**
 * Render di un singolo item.
 */
function renderItem(item) {
  const globalIdx = state.pdfItems.indexOf(item);
  const isSelected = state.currentSelectedIdx === globalIdx;
  const isProcessed = item.status === 'processed';

  const classes = [
    'pdf-item',
    isSelected ? 'selected' : '',
    isProcessed ? 'processed' : '',
  ].filter(Boolean).join(' ');

  // Badge score
  const scoreBadge = renderScoreBadge(item);

  // Azioni a destra
  let actionsHtml = '';

  if (item.isEditing) {
    actionsHtml = `
      <div class="inline-rename" data-action="stop-propagation">
        <input
          type="text"
          class="rename-input"
          id="manualName_${globalIdx}"
          value="${escapeHtml(stripPdfExtension(item.newName || item.name))}"
          data-idx="${globalIdx}"
        >
        <button class="btn btn-success btn-icon"
                data-action="confirm-rename"
                data-idx="${globalIdx}"
                title="Conferma">
          <i class="fas fa-check"></i>
        </button>
        <button class="btn btn-ghost btn-icon"
                data-action="cancel-rename"
                data-idx="${globalIdx}"
                title="Annulla">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  } else {
    if (!isProcessed) {
      actionsHtml += `
        <button class="btn btn-ghost btn-icon"
                data-action="open-search"
                data-idx="${globalIdx}"
                title="Apri ricerca">
          <i class="fas fa-search"></i>
        </button>
      `;
    }
    actionsHtml += `
      <button class="btn btn-ghost btn-icon"
              data-action="start-rename"
              data-idx="${globalIdx}"
              title="Rinomina manualmente">
        <i class="fas fa-pen"></i>
      </button>
    `;
    if (isProcessed) {
      actionsHtml += `
        <button class="btn btn-ghost btn-icon"
                data-action="reset-rename"
                data-idx="${globalIdx}"
                title="Annulla rinomina">
          <i class="fas fa-rotate-left"></i>
        </button>
      `;
    }
  }

  const newNameDisplay = item.newName
    ? escapeHtml(item.newName)
    : 'In attesa di rinomina...';

  return `
    <div class="${classes}" data-idx="${globalIdx}" data-action="select-pdf">
      ${scoreBadge}
      <i class="fas ${isProcessed ? 'fa-check-circle' : 'fa-file-pdf'}"></i>
      <div class="pdf-item-info">
        <div class="pdf-item-name" title="${escapeHtml(item.name)}">
          ${escapeHtml(item.name)}
        </div>
        <div class="pdf-item-newname" title="${newNameDisplay}">
          ${newNameDisplay}
        </div>
      </div>
      <div class="pdf-item-actions">
        ${actionsHtml}
      </div>
    </div>
  `;
}

/**
 * Renderizza il badge score (0-3) con colore e tooltip.
 */
function renderScoreBadge(item) {
  if (item.score == null) {
    return `<span class="score-badge score-badge-none" title="Score non calcolato">—</span>`;
  }

  const score = item.score;
  const reason = item.scoreReason || '';
  const tooltip = `${reason}${item.scoreMatchCount ? ` (${item.scoreMatchCount} match)` : ''}`;

  return `<span class="score-badge score-badge-${score}" title="${escapeHtml(tooltip)}">${score}</span>`;
}

// ============================================================
// EVENTI
// ============================================================

function bindFilters() {
  // Filtro stato (Tutti / Da Fare / Completati)
  const stateButtons = document.querySelectorAll('.filter-btn');
  stateButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stateButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter || 'all';
      state.setFilter(filter);
    });
  });

  // Filtro score (chip colorati)
  const scoreChips = document.querySelectorAll('.score-chip');
  scoreChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      scoreChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const score = chip.dataset.score || 'all';
      state.setScoreFilter(score);
    });
  });

  // Select ordinamento
  const sortSelect = document.getElementById('sortBy');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.setSortBy(e.target.value);
    });
  }
}

/**
 * Event delegation: un solo listener sul container per tutti gli item.
 */
function bindItemEvents() {
  if (!listContainer) return;

  // Rimuovi listener precedente (se esiste)
  if (listContainer._handler) {
    listContainer.removeEventListener('click', listContainer._handler);
  }

  listContainer._handler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const idx = parseInt(target.dataset.idx, 10);

    // Ferma propagazione per azioni annidate
    if (action === 'stop-propagation') {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();

    switch (action) {
      case 'select-pdf':
        selectPdf(idx);
        break;
      case 'open-search':
        openSearchFor(idx);
        break;
      case 'start-rename':
        startRename(idx);
        break;
      case 'confirm-rename':
        confirmRename(idx);
        break;
      case 'cancel-rename':
        cancelRename(idx);
        break;
      case 'reset-rename':
        resetRename(idx);
        break;
    }
  };

  listContainer.addEventListener('click', listContainer._handler);

  // Focus automatico sull'input di rename
  const renameInput = listContainer.querySelector('.rename-input');
  if (renameInput) {
    setTimeout(() => {
      renameInput.focus();
      renameInput.select();
    }, 0);

    // Invio = conferma, Esc = annulla
    renameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmRename(parseInt(renameInput.dataset.idx, 10));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename(parseInt(renameInput.dataset.idx, 10));
      }
    });
  }
}

// ============================================================
// AZIONI
// ============================================================

import * as matcher from '../data/matcher.js';   // ← aggiungi import in cima

// ...

function selectPdf(idx) {
  state.selectPdf(idx);

  // Emetti evento per il viewer PDF
  bus.emit('pdf:load-request', { idx });

  // Match IA
  const item = state.pdfItems[idx];
  if (!item) return;

  const iaRecord = matcher.findIaRecord(item.name);
  const needsManual = !iaRecord || iaRecord.esito === 'Negativo';

  if (iaRecord) {
    // Salva record nello stato
    state.setCurrentIaMatch(iaRecord, needsManual);

    // Mostra pannello IA
    bus.emit('ia:show-panel', { record: iaRecord, needsManual });

    // Se positivo, precompila la ricerca
    if (!needsManual && iaRecord.indirizzo) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        // Precompila con via + civico (se esiste)
        const viaPulita = normalizer.extractSearchableAddress(iaRecord.indirizzo);
        const civico = (iaRecord.civico || '').toString().trim();

        let query = viaPulita;
        if (civico) {
          query = `${viaPulita} ${civico}`;
        }

        searchInput.value = query;
      }

      // Apri drawer e avvia ricerca automatica
      bus.emit(EVENTS.SEARCH_OPENED);
      setTimeout(() => {
        const btnSearch = document.getElementById('searchBtn');
        if (btnSearch) btnSearch.click();
      }, 400);
    } else {
      // Solo apri drawer con bordo blu, senza ricerca automatica
      bus.emit(EVENTS.SEARCH_OPENED);
    }
  } else {
    // Nessun match IA → nascondi pannello, bordo blu
    state.setCurrentIaMatch(null, true);
    bus.emit('ia:hide-panel');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.classList.add('needs-manual');
      searchInput.value = '';
    }
  }
}

function openSearchFor(idx) {
  state.selectPdf(idx);
  bus.emit(EVENTS.SEARCH_OPENED);

  const item = state.pdfItems[idx];
  if (!item) return;

  const iaRecord = matcher.findIaRecord(item.name);
  const needsManual = !iaRecord || iaRecord.esito === 'Negativo';

  if (iaRecord) {
    state.setCurrentIaMatch(iaRecord, needsManual);
    bus.emit('ia:show-panel', { record: iaRecord, needsManual });

    // Precompila con via + civico
    if (!needsManual && iaRecord.indirizzo) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        const viaPulita = normalizer.extractSearchableAddress(iaRecord.indirizzo);
        const civico = (iaRecord.civico || '').toString().trim();
        searchInput.value = civico ? `${viaPulita} ${civico}` : viaPulita;
      }
    }
  } else {
    bus.emit('ia:hide-panel');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.classList.add('needs-manual');
  }
}


function startRename(idx) {
  const item = state.pdfItems[idx];
  if (!item) return;
  item.isEditing = true;
  render();
}

function confirmRename(idx) {
  const input = document.getElementById(`manualName_${idx}`);
  if (!input) return;

  let name = input.value.trim();

  // Sanitizza input
  name = name
    .replace(/[\x00-\x1f\x7f]/g, '')  // Rimuovi caratteri di controllo
    .replace(/[<>:"/\\|?*]/g, '-')     // Caratteri vietati
    .trim();

  if (!name) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Inserisci un nome valido',
      type: 'warning',
    });
    return;
  }

  // Impone estensione .pdf
  if (!/\.pdf$/i.test(name)) name += '.pdf';

  // Limita lunghezza
  if (name.length > 200) {
    name = name.substring(0, 195) + '.pdf';
  }

  state.applyRename(idx, {
    newName: name,
    impianto: null,
    iaRecord: null,
  });

  bus.emit(EVENTS.RENAME_MANUAL, { idx, newName: name });
  render();
}

function cancelRename(idx) {
  const item = state.pdfItems[idx];
  if (!item) return;
  item.isEditing = false;
  render();
}

function resetRename(idx) {
  state.resetRename(idx);
  render();
}