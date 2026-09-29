/* ============================================================
   HEADER.JS — Gestione header (cartelle, caricamento DB/IA)
   ============================================================ */

   import * as scoreEngine from '../rename/score-engine.js';

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import * as fs from '../fs/fs-adapter.js';
import * as excelParser from '../data/excel-parser.js';
import * as toast from './toast.js';
import * as spinner from './spinner.js';
import { log, error } from '../core/utils.js';

/**
 * Inizializza i listener dell'header.
 */
export function init() {
  bindSourceFolder();
  bindDestinationFolder();
  bindDbUpload();
  bindIaUpload();
  bindPasteSearch();
  bindSessionButtons();

   bindScoreButton();   // ← AGGIUNGI QUESTA
}

// ============================================================
// CARTELLA SORGENTE
// ============================================================

function bindSourceFolder() {
  const btn = document.getElementById('btnSelectSource');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!fs.isSupported()) {
      toast.error('Il tuo browser non supporta la selezione di cartelle. Usa Chrome o Edge.');
      return;
    }

    try {
      const handle = await fs.pickDirectory();
      if (!handle) return;

      state.setSourceFolder(handle);
      updateSourcePath(handle.name);

      spinner.show('Lettura file PDF...');
      const files = await fs.listPdfFiles(handle);
      state.setPdfItems(files);
      spinner.hide();

      if (files.length === 0) {
        toast.warning('Nessun PDF trovato nella cartella selezionata');
      } else {
        toast.success(`${files.length} PDF caricati da "${handle.name}"`);
      }
    } catch (err) {
      spinner.hide();
      error('Errore selezione sorgente:', err);
      toast.error('Errore durante la lettura della cartella');
    }
  });
}

function updateSourcePath(name) {
  const el = document.getElementById('sourceFolderPath');
  if (el) el.textContent = name || 'Nessuna cartella';
}

// ============================================================
// CARTELLA DESTINAZIONE
// ============================================================

function bindDestinationFolder() {
  const btn = document.getElementById('btnSelectDest');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!fs.isSupported()) {
      toast.error('Il tuo browser non supporta la selezione di cartelle. Usa Chrome o Edge.');
      return;
    }

    try {
      const handle = await fs.pickDirectory();
      if (!handle) return;

      state.setDestinationFolder(handle);

      btn.innerHTML = `<i class="fas fa-check-circle"></i> ${handle.name}`;
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn-success');

      toast.success(`Cartella di destinazione: "${handle.name}"`);
      updateRenameAllButton();
    } catch (err) {
      error('Errore selezione destinazione:', err);
      toast.error('Errore durante la selezione della cartella');
    }
  });
}

// ============================================================
// CARICAMENTO DATABASE
// ============================================================

function bindDbUpload() {
  const btn = document.getElementById('btnLoadDb');
  const input = document.getElementById('dbUpload');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      spinner.show('Caricamento database...');
      await excelParser.loadAndApply(file, file.name);
    } catch (err) {
      error('Errore caricamento DB:', err);
      toast.error('Errore durante il caricamento del database');
    } finally {
      spinner.hide();
      input.value = '';
    }
  });
}

// ============================================================
// CARICAMENTO IA
// ============================================================

import * as iaParser from '../data/ia-parser.js';   // ← aggiungi import in cima

// ...

function bindIaUpload() {
  const btn = document.getElementById('btnLoadIa');
  const input = document.getElementById('iaUpload');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      spinner.show('Caricamento analisi IA...');
      await iaParser.loadAndApply(file, file.name);
      // Il toast è già emesso da main.js su IA_LOADED
    } catch (err) {
      error('Errore caricamento IA:', err);
      toast.error('Errore durante il caricamento dell\'analisi IA');
    } finally {
      spinner.hide();
      input.value = '';
    }
  });
}
// ============================================================
// BOTTONE RINOMINA TUTTI
// ============================================================

export function updateRenameAllButton() {
  const btn = document.getElementById('btnRenameAll');
  if (!btn) return;

  const hasDestination = !!state.destinationFolderHandle;
  const hasProcessed = state.pdfItems.some((i) => i.status === 'processed');

  btn.disabled = !(hasDestination && hasProcessed);

  // Tooltip dinamico che spiega perché è disabilitato
  let tooltip = 'Rinomina tutti i file (Ctrl+Shift+R)';
  if (!hasDestination && !hasProcessed) {
    tooltip = 'Seleziona una cartella di destinazione e rinomina almeno un file';
  } else if (!hasDestination) {
    tooltip = 'Seleziona prima una cartella di destinazione';
  } else if (!hasProcessed) {
    tooltip = 'Rinomina almeno un file prima di procedere';
  }

  btn.setAttribute('data-tooltip', tooltip);
  btn.setAttribute('title', tooltip);
}

// ============================================================
// CERCA SELEZIONE
// ============================================================

function bindPasteSearch() {
  const btn = document.getElementById('btnPasteSearch');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const selection = window.getSelection().toString().trim();

    if (!selection) {
      bus.emit(EVENTS.TOAST_SHOW, {
        message: 'Seleziona del testo nel PDF prima di cercare',
        type: 'warning',
      });
      return;
    }

    const searchPanel = await import('../search/search-panel.js');
    searchPanel.searchFromExternal(selection);

    bus.emit(EVENTS.TOAST_SHOW, {
      message: `Ricerca: "${selection.substring(0, 50)}${selection.length > 50 ? '...' : ''}"`,
      type: 'info',
    });
  });
}

// ============================================================
// SALVA / CARICA SESSIONE
// ============================================================

export function bindSessionButtons() {
  const btnSave = document.getElementById('btnSaveSession');
  const btnLoad = document.getElementById('btnLoadSession');

  btnSave?.addEventListener('click', async () => {
    const renameEngine = await import('../rename/rename-engine.js');
    renameEngine.saveSession();
  });

  btnLoad?.addEventListener('click', async () => {
    const renameEngine = await import('../rename/rename-engine.js');
    renameEngine.loadSession();
  });
}

// ============================================================
// CALCOLA SCORE
// ============================================================

function bindScoreButton() {
  const btn = document.getElementById('btnCalcScore');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!state.excelData.loaded) {
      toast.warning('Carica prima il database (DB)');
      return;
    }
    if (!state.iaData.loaded) {
      toast.warning('Carica prima l\'analisi IA');
      return;
    }
    if (state.pdfItems.length === 0) {
      toast.warning('Seleziona prima una cartella con PDF');
      return;
    }

    spinner.show('Calcolo score di confidenza...');

    // Esegui in un tick separato per permettere allo spinner di apparire
    setTimeout(() => {
      try {
        const summary = scoreEngine.computeAllScores({ force: false });

        if (!summary) {
          spinner.hide();
          toast.error('Impossibile calcolare gli score');
          return;
        }

        spinner.hide();

        // Toast con riepilogo
        const { updated, skipped, distribution } = summary;
        let msg = `✅ Score calcolati: ${updated} aggiornati`;
        if (skipped > 0) msg += `, ${skipped} conservati`;
        toast.success(msg, 5000);

        // Log dettagliato
        console.log('[Score] Distribuzione:', distribution);

        // Evento per far aggiornare la lista
        bus.emit(EVENTS.PDF_LIST_UPDATED, { count: state.pdfItems.length });
        bus.emit('score:computed', summary);
      } catch (err) {
        spinner.hide();
        error('Errore calcolo score:', err);
        toast.error('Errore durante il calcolo degli score');
      }
    }, 50);
  });

  // Aggiorna stato del bottone
  updateScoreButton();
  bus.on(EVENTS.DB_LOADED, updateScoreButton);
  bus.on(EVENTS.IA_LOADED, updateScoreButton);
  bus.on(EVENTS.PDF_LIST_UPDATED, updateScoreButton);
}

function updateScoreButton() {
  const btn = document.getElementById('btnCalcScore');
  if (!btn) return;

  const hasDb = state.excelData.loaded;
  const hasIa = state.iaData.loaded;
  const hasPdf = state.pdfItems.length > 0;

  btn.disabled = !(hasDb && hasIa && hasPdf);

  let tooltip = 'Calcola score di confidenza per ogni PDF';
  if (!hasDb && !hasIa) {
    tooltip = 'Carica prima DB e Analisi IA';
  } else if (!hasDb) {
    tooltip = 'Carica prima il database (DB)';
  } else if (!hasIa) {
    tooltip = 'Carica prima l\'analisi IA';
  } else if (!hasPdf) {
    tooltip = 'Seleziona prima una cartella con PDF';
  }

  btn.setAttribute('data-tooltip', tooltip);
  btn.setAttribute('title', tooltip);
}