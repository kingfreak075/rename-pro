/* ============================================================
   MAIN.JS — Entry point dell'applicazione
   ============================================================ */

import { state } from './core/state.js';
import { bus, EVENTS } from './core/events.js';
import { log } from './core/utils.js';

// Import moduli (verranno attivati negli step successivi)
// import * as fsAdapter from './fs/fs-adapter.js';
// import * as excelParser from './data/excel-parser.js';
// import * as iaParser from './data/ia-parser.js';
// import * as pdfViewer from './pdf/pdf-viewer.js';
// import * as searchPanel from './search/search-panel.js';
// import * as iaPanel from './search/ia-panel.js';
// import * as listUI from './ui/list.js';
// import * as headerUI from './ui/header.js';
// import * as toast from './ui/toast.js';
// import * as spinner from './ui/spinner.js';
// import * as shortcuts from './ui/shortcuts.js';

/**
 * Boot dell'applicazione.
 */
function boot() {
  log('🚀 Boot Rename Pro...');

  // Verifica che il DOM sia pronto
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

  // 1. Verifica compatibilità browser
  checkBrowserSupport();

  // 2. Inizializza UI base (header, lista, footer)
  initBaseUI();

  // 3. Inizializza i moduli (verranno attivati gradualmente)
  initModules();

  // 4. Registra listener globali
  registerGlobalListeners();

  // 5. Notifica app pronta
  bus.emit(EVENTS.APP_READY);

  log('✅ Rename Pro pronto');
}

/**
 * Verifica supporto browser.
 */
function checkBrowserSupport() {
  const hasFsAccess = 'showDirectoryPicker' in window;
  const hasFileSystem = 'FileSystemFileHandle' in window;

  if (hasFsAccess && hasFileSystem) {
    log('✅ File System Access API supportata (Chrome/Edge)');
  } else {
    console.warn('⚠️ File System Access API NON supportata. Fallback disponibile.');
    // In futuro: attiva fallback Firefox/Safari
  }
}

/**
 * Inizializza UI base.
 */
function initBaseUI() {
  // Placeholder: verrà popolato in Step 2-3
  log('UI base inizializzata (placeholder)');

  // Aggiorna contatori iniziali
  updateCounters();
}

/**
 * Aggiorna i contatori della lista PDF.
 */
function updateCounters() {
  const { total, pending, done } = state.getCounters();
  const elAll = document.getElementById('countAll');
  const elPending = document.getElementById('countPending');
  const elDone = document.getElementById('countDone');

  if (elAll) elAll.textContent = total;
  if (elPending) elPending.textContent = pending;
  if (elDone) elDone.textContent = done;
}

/**
 * Inizializza i moduli (placeholder).
 */
function initModules() {
  // Verranno aggiunti negli step successivi:
  // headerUI.init();
  // listUI.init();
  // pdfViewer.init();
  // searchPanel.init();
  // iaPanel.init();
  // shortcuts.init();
  // toast.init();
  // spinner.init();
}

/**
 * Registra listener globali.
 */
function registerGlobalListeners() {
  // Aggiorna contatori ad ogni cambio lista
  bus.on(EVENTS.PDF_LIST_UPDATED, () => {
    updateCounters();
  });

  // Cambio stato Excel → aggiorna header
  bus.on(EVENTS.DB_LOADED, (data) => {
    const el = document.getElementById('dbStatus');
    if (el) {
      el.innerHTML = `<i class="fas fa-database" style="color:var(--secondary)"></i> DB: ${data.count}`;
      el.classList.add('ok');
    }
  });

  // Cambio stato IA → aggiorna header
  bus.on(EVENTS.IA_LOADED, (stats) => {
    const el = document.getElementById('iaStatus');
    if (el) {
      el.innerHTML = `<i class="fas fa-robot" style="color:var(--secondary)"></i> IA: ${stats.total}`;
      el.classList.add('ok');
    }
  });

  // Errori globali
  window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.error || e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Promise]', e.reason);
  });
}

// Avvia
boot();

// Esponi per debug in console
if (typeof window !== 'undefined') {
  window.__APP__ = { state, bus, EVENTS };
  log('💡 Debug: usa window.__APP__ in console');
}