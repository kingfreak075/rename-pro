/* ============================================================
   MAIN.JS — Entry point dell'applicazione
   ============================================================ */

import { state } from './core/state.js';
import { bus, EVENTS } from './core/events.js';
import { log } from './core/utils.js';

// Moduli attivi
import * as toast from './ui/toast.js';
import * as spinner from './ui/spinner.js';
import * as headerUI from './ui/header.js';
import * as listUI from './ui/list.js';
import * as pdfViewer from './pdf/pdf-viewer.js';
import * as pdfTextlayer from './pdf/pdf-textlayer.js';
import * as pdfPan from './pdf/pdf-pan.js';
import * as searchPanel from './search/search-panel.js';
import * as detailsModal from './search/details-modal.js';
import * as searchEngine from './search/search-engine.js';
import * as renameBatch from './rename/rename-batch.js';
import * as renameEngine from './rename/rename-engine.js';
import * as shortcuts from './ui/shortcuts.js';

/**
 * Boot dell'applicazione.
 */
function boot() {
  log('🚀 Boot Rename Pro...');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

/**
 * Inizializzazione.
 */
function init() {
  log('Inizializzazione moduli...');

  checkBrowserSupport();

  // UI
  toast.init();
  spinner.init();
  headerUI.init();
  listUI.init();

  // PDF
  pdfViewer.init();
  pdfTextlayer.init();
  pdfPan.init();
  pdfTextlayer.setMode('text');

  // Ricerca
  detailsModal.init();
  searchPanel.init();

  // Rinomina + Shortcuts
  shortcuts.init();

  // Collega il bottone "Rinomina Tutti"
  document.getElementById('btnRenameAll')?.addEventListener('click', () => {
    renameBatch.startBatchRename();
  });

  initBaseUI();
  registerGlobalListeners();

  bus.emit(EVENTS.APP_READY);

  log('✅ Rename Pro pronto');
  toast.info('Rename Pro caricato. Seleziona una cartella per iniziare.', 5000);

  if (typeof window !== 'undefined') {
    window.toast = toast;
    window.spinner = spinner;
  }
}

function checkBrowserSupport() {
  const hasFsAccess = 'showDirectoryPicker' in window;
  const hasFileSystem = 'FileSystemFileHandle' in window;

  if (hasFsAccess && hasFileSystem) {
    log('✅ File System Access API supportata');
  } else {
    console.warn('⚠️ File System Access API NON supportata');
    toast.warning('Browser non supportato per scrittura diretta. Usa Chrome/Edge.', 6000);
  }
}

function initBaseUI() {
  log('UI base inizializzata');
  updateCounters();
}

function updateCounters() {
  const { total, pending, done } = state.getCounters();
  const elAll = document.getElementById('countAll');
  const elPending = document.getElementById('countPending');
  const elDone = document.getElementById('countDone');

  if (elAll) elAll.textContent = total;
  if (elPending) elPending.textContent = pending;
  if (elDone) elDone.textContent = done;
}

function registerGlobalListeners() {
  // Contatori + bottone rename
  bus.on(EVENTS.PDF_LIST_UPDATED, () => {
    updateCounters();
    headerUI.updateRenameAllButton();
  });

  // Database caricato
  bus.on(EVENTS.DB_LOADED, (data) => {
    const el = document.getElementById('dbStatus');
    if (el) {
      el.innerHTML = `<i class="fas fa-database" style="color:var(--secondary)"></i> DB: ${data.count}`;
      el.classList.add('ok');
    }
    toast.success(`Database caricato: ${data.count} impianti`);
  });

  // IA caricata
  bus.on(EVENTS.IA_LOADED, (stats) => {
    const el = document.getElementById('iaStatus');
    if (el) {
      el.innerHTML = `<i class="fas fa-robot" style="color:var(--secondary)"></i> IA: ${stats.total}`;
      el.classList.add('ok');
    }
    toast.success(`Analisi IA caricata: ${stats.total} verbali`);
  });

  // ---------- PROGRESS BATCH RENAME ----------
  bus.on(EVENTS.RENAME_BATCH_START, ({ total }) => {
    const container = document.getElementById('progressContainer');
    const label = document.getElementById('progressLabel');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (container) container.hidden = false;
    if (label) label.textContent = `Rinomina 0/${total}`;
    if (fill) fill.style.width = '0%';
    if (text) text.textContent = '0%';
  });

  bus.on(EVENTS.RENAME_BATCH_PROGRESS, ({ current, total, percent }) => {
    const label = document.getElementById('progressLabel');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (label) label.textContent = `Rinomina ${current}/${total}`;
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}%`;
  });

  bus.on(EVENTS.RENAME_BATCH_END, () => {
    setTimeout(() => {
      const container = document.getElementById('progressContainer');
      if (container) container.hidden = true;
    }, 3000);
  });

  // ---------- SHORTCUT REQUESTS ----------
  bus.on('session:save-request', () => {
    renameEngine.saveSession();
  });

  bus.on('session:load-request', () => {
    renameEngine.loadSession();
  });

  bus.on('pdf:change-page', ({ delta }) => {
    bus.emit('pdf:page-request', { delta });
  });

  bus.on(EVENTS.SEARCH_CLOSED, () => {
    document.getElementById('searchDrawer')?.classList.remove('open');
  });

  // ---------- ERRORI GLOBALI ----------
  window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.error || e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Promise]', e.reason);
  });
}

boot();

if (typeof window !== 'undefined') {
  window.__APP__ = { state, bus, EVENTS, toast, spinner };
  log('💡 Debug: usa window.__APP__ in console');
}