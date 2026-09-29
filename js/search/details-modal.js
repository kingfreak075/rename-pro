/* ============================================================
   DETAILS-MODAL.JS — Modale dettagli impianto
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { escapeHtml, formatDate, log } from '../core/utils.js';
import * as engine from './search-engine.js';

let modal, content, btnApply, btnClose, btnCancel;

/**
 * Inizializza il modulo.
 */
export function init() {
  modal = document.getElementById('dettagliModal');
  content = document.getElementById('dettagliModalContent');
  btnApply = document.getElementById('btnApplyFromModal');
  btnClose = document.getElementById('btnCloseDetailsModal');
  btnCancel = document.getElementById('btnCancelDetailsModal');

  if (!modal) return;

  // Binding bottoni
  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  btnApply?.addEventListener('click', apply);

  // Click su backdrop chiude
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  log('Modale dettagli inizializzata');
}

/**
 * Apre la modale con i dettagli di un impianto.
 * @param {string} codice
 */
export function open(codice) {
  const impianto = engine.getImpiantoDetails(codice);
  if (!impianto) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Impianto non trovato',
      type: 'warning',
    });
    return;
  }

  // Salva come ultimo match
  state.lastSearchMatch = impianto;

  // Render contenuto
  content.innerHTML = renderDetails(impianto);

  // Mostra modale
  modal.style.display = 'flex';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  bus.emit(EVENTS.MODAL_OPEN, { name: 'details', codice });
}

/**
 * Chiude la modale.
 */
export function close() {
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  bus.emit(EVENTS.MODAL_CLOSE, { name: 'details' });
}

/**
 * Applica il nome dal match corrente al PDF selezionato.
 */
function apply() {
  if (!state.lastSearchMatch) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Nessun impianto da applicare',
      type: 'warning',
    });
    return;
  }

  if (state.currentSelectedIdx === -1) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Seleziona prima un PDF dalla lista',
      type: 'warning',
    });
    return;
  }

  const impianto = state.lastSearchMatch;
  const newName = engine.buildFileName(impianto);

  state.applyRename(state.currentSelectedIdx, {
    newName,
    impianto,
    iaRecord: null,
  });

  bus.emit(EVENTS.TOAST_SHOW, {
    message: `Nome applicato: ${newName}`,
    type: 'success',
  });

  close();
}

// ============================================================
// RENDERING
// ============================================================

function renderDetails(imp) {
  const commerciale = engine.getCommerciale(imp.venditore);
  const giro = engine.getGiro(imp.giro);
  const annotazioni = engine.getAnnotazioni(imp.impianto);
  const documenti = engine.getDocumenti(imp.impianto);

  let html = `
    <div class="details-grid">
      <div class="detail-item">
        <span class="detail-label">Codice</span>
        <span class="detail-value">${escapeHtml(imp.impianto || 'N/A')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Matricola</span>
        <span class="detail-value">${escapeHtml(imp.matricola || 'N/A')}</span>
      </div>
      <div class="detail-item detail-full">
        <span class="detail-label">Indirizzo</span>
        <span class="detail-value">${escapeHtml(imp['Indirizzo impianto'] || 'N/A')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Località</span>
        <span class="detail-value">${escapeHtml(imp['Località impianto'] || 'N/A')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Zona</span>
        <span class="detail-value">${escapeHtml(imp.zona || 'N/A')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Commerciale</span>
        <span class="detail-value">${escapeHtml(commerciale)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Giro</span>
        <span class="detail-value">${escapeHtml(giro)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Ultima semestrale</span>
        <span class="detail-value">${formatDate(imp['ult sem'])}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Cliente</span>
        <span class="detail-value">${escapeHtml(imp.Cliente || 'N/A')}</span>
      </div>
    </div>
  `;

  // Annotazioni
  if (annotazioni.length > 0) {
    html += `
      <div class="details-section">
        <h4><i class="fas fa-comment-dots"></i> Ultime annotazioni</h4>
        ${annotazioni.map((a) => `
          <div class="detail-note">
            <strong>${a.giorno_ann || ''}/${a.mese_ann || ''}/${a.anno_ann || ''}</strong>
            <span>${escapeHtml(a.note || '')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Documenti
  if (documenti.length > 0) {
    html += `
      <div class="details-section">
        <h4><i class="fas fa-file-pdf"></i> Documenti (${documenti.length})</h4>
        <div class="detail-docs">
          ${documenti.slice(0, 10).map((d) => `
            <div class="detail-doc">
              <i class="fas fa-file-pdf"></i>
              <span>${escapeHtml(d['NOME FILE'] || 'N/A')}</span>
            </div>
          `).join('')}
          ${documenti.length > 10 ? `<div class="detail-doc-more">+${documenti.length - 10} altri</div>` : ''}
        </div>
      </div>
    `;
  }

  return html;
}