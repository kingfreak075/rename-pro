/* ============================================================
   HEADER.JS — Gestione header (cartelle, caricamento DB/IA)
   (Placeholder — verrà implementato nello Step 2)
   ============================================================ */

// Verrà implementato nello Step 2.
/* ============================================================
   HEADER.JS — Gestione header (cartelle, caricamento DB/IA)
   ============================================================ */

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

      // Elenca i PDF
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

      // Aggiorna bottone
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
      // Il toast è già emesso da main.js su DB_LOADED
    } catch (err) {
      error('Errore caricamento DB:', err);
      toast.error('Errore durante il caricamento del database');
    } finally {
      spinner.hide();
      input.value = ''; // Reset per permettere re-upload dello stesso file
    }
  });
}

// ============================================================
// CARICAMENTO IA
// ============================================================

function bindIaUpload() {
  const btn = document.getElementById('btnLoadIa');
  const input = document.getElementById('iaUpload');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Il parser IA verrà implementato nello Step 6
    toast.info('Modulo IA in arrivo nello Step 6');
    input.value = '';
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
}