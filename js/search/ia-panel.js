/* ============================================================
   IA-PANEL.JS — Pannello dati IA (sopra i risultati)
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { escapeHtml, log } from '../core/utils.js';
import * as matcher from '../data/matcher.js';
import * as nameBuilder from '../rename/name-builder.js';
import * as normalizer from '../data/normalizer.js';

let panel;
let inputEl;

/**
 * Inizializza il modulo.
 */
export function init() {
  panel = document.getElementById('iaPanel');
  inputEl = document.getElementById('searchInput');

  if (!panel) return;

  // Ascolta eventi dal list
  bus.on('ia:show-panel', ({ record, needsManual }) => {
    showPanel(record, needsManual);
  });

  bus.on('ia:hide-panel', () => hidePanel());

  // Ascolta richieste di ricerca IA → riavvia quando cambia qualcosa
  bus.on('ia:request-search', () => {
    triggerSearch();
  });

  log('IA Panel inizializzato');
}

/**
 * Mostra il pannello con i dati IA.
 */
export function showPanel(record, needsManual = false) {
  if (!panel || !record) {
    hidePanel();
    return;
  }

  // Aggiorna bordo blu sull'input
  if (inputEl) {
    inputEl.classList.toggle('needs-manual', needsManual);
  }

  const isPositive = record.esito === 'Positivo';
  const isNegative = record.esito === 'Negativo';
  const usable = matcher.isIaRecordUsable(record);

  // Valori visualizzati (readonly se negativo)
  const fields = [
    { label: 'Indirizzo', value: record.indirizzo || '—' },
    { label: 'Civico', value: record.civico || '—' },
    { label: 'Località', value: record.localita || '—' },
    { label: 'Matricola', value: record.matricola || '—' },
  ];

  const esitoBadge = isPositive
    ? '<span class="badge badge-secondary"><i class="fas fa-check"></i> Positivo</span>'
    : isNegative
    ? '<span class="badge badge-danger"><i class="fas fa-times"></i> Negativo</span>'
    : '<span class="badge"><i class="fas fa-question"></i> Sconosciuto</span>';

  const fieldsHtml = fields
    .map((f) => `
      <div class="ia-field">
        <span class="ia-field-label">${f.label}</span>
        <span class="ia-field-value ${isNegative ? 'ia-negative' : ''}">${escapeHtml(f.value)}</span>
      </div>
    `)
    .join('');

  // Bottoni azione (solo se esito positivo)
  let actionsHtml = '';
  if (usable) {
    const indirizzoSearch = matcher.getIaSearchQuery(record);
    const matricolaEscaped = escapeHtml(record.matricola || '');

    actionsHtml = `
      <div class="ia-panel-actions">
        ${indirizzoSearch ? `
          <button class="btn btn-ghost btn-sm" data-ia-action="add-civico" data-civico="${escapeHtml(record.civico || '')}">
            <i class="fas fa-plus"></i> Aggiungi civico ${escapeHtml(record.civico || '')}
          </button>
        ` : ''}
        ${matricolaEscaped ? `
          <button class="btn btn-ghost btn-sm" data-ia-action="use-matricola" data-matricola="${matricolaEscaped}">
            <i class="fas fa-tag"></i> Usa matricola
          </button>
        ` : ''}
        <button class="btn btn-success btn-sm" data-ia-action="use-as-name">
          <i class="fas fa-signature"></i> Usa come nome provvisorio
        </button>
      </div>
    `;
  } else if (isNegative) {
    actionsHtml = `
      <div class="ia-panel-actions">
        <span class="ia-panel-hint">
          <i class="fas fa-exclamation-triangle"></i>
          Esito negativo: ricerca manuale richiesta
        </span>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="ia-panel-header">
      <div class="ia-panel-title">
        <i class="fas fa-robot"></i> Dati IA (dal verbale)
      </div>
      ${esitoBadge}
    </div>
    <div class="ia-panel-fields">
      ${fieldsHtml}
    </div>
    ${actionsHtml}
  `;

  panel.hidden = false;

  // Binding bottoni
  panel.querySelectorAll('[data-ia-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn, record));
  });
}

/**
 * Nasconde il pannello e rimuove il bordo blu.
 */
export function hidePanel() {
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = '';
  }
  if (inputEl) {
    inputEl.classList.remove('needs-manual');
  }
}

/**
 * Gestisce le azioni dei bottoni del pannello IA.
 */
function handleAction(btn, record) {
  const action = btn.dataset.iaAction;

  switch (action) {
    case 'add-civico': {
      const civico = btn.dataset.civico;
      if (!inputEl || !civico) return;
      // Aggiungi civico solo se non c'è già
      if (!inputEl.value.includes(civico)) {
        inputEl.value = `${inputEl.value.trim()} ${civico}`.trim();
      }
      triggerSearch();
      break;
    }

    case 'use-matricola': {
      const matricola = btn.dataset.matricola;
      if (!inputEl || !matricola) return;
      inputEl.value = matricola;
      triggerSearch();
      break;
    }

    case 'use-as-name': {
      // Applica nome provvisorio al PDF selezionato
      const idx = state.currentSelectedIdx;
      if (idx === -1) {
        bus.emit(EVENTS.TOAST_SHOW, {
          message: 'Seleziona prima un PDF',
          type: 'warning',
        });
        return;
      }

      const newName = nameBuilder.buildIaFileName(record);
      state.applyRename(idx, {
        newName,
        impianto: null,
        iaRecord: record,
      });

      bus.emit(EVENTS.TOAST_SHOW, {
        message: `Nome provvisorio applicato: ${newName}`,
        type: 'success',
      });

      // Reset bordo blu
      if (inputEl) inputEl.classList.remove('needs-manual');
      break;
    }
  }
}

/**
 * Triggera una ricerca nel pannello.
 */
function triggerSearch() {
  const btnSearch = document.getElementById('searchBtn');
  if (btnSearch) {
    btnSearch.click();
  }
}