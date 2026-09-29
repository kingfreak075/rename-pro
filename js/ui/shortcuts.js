/* ============================================================
   SHORTCUTS.JS — Scorciatoie tastiera globali
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log } from '../core/utils.js';

/**
 * Inizializza il modulo.
 */
export function init() {
  document.addEventListener('keydown', handleKeydown);
  log('Shortcuts inizializzate');
}

function handleKeydown(e) {
  // Ignora se focus su input/textarea (tranne Esc)
  const tag = document.activeElement?.tagName;
  const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA';

  // Esc — sempre
  if (e.key === 'Escape') {
    const drawerOpen = document.getElementById('searchDrawer')?.classList.contains('open');
    const modalOpen = document.getElementById('dettagliModal')?.classList.contains('open');

    if (modalOpen) {
      bus.emit(EVENTS.MODAL_CLOSE, { name: 'details' });
    } else if (drawerOpen) {
      bus.emit(EVENTS.SEARCH_CLOSED);
    }
    return;
  }

  // Se focus su input, ignora tutte le altre shortcut
  if (isInputFocused) return;

  // Ctrl+K o Ctrl+F → apri ricerca
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
    e.preventDefault();
    bus.emit(EVENTS.SEARCH_OPENED);
    return;
  }

  // Ctrl+S → salva sessione
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    bus.emit('session:save-request');
    return;
  }

  // Ctrl+Shift+R → rinomina tutti
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    const btn = document.getElementById('btnRenameAll');
    if (btn && !btn.disabled) btn.click();
    return;
  }

  // Ctrl+1 → modalità testo
  if ((e.ctrlKey || e.metaKey) && e.key === '1') {
    e.preventDefault();
    bus.emit('pdf:set-mode', { mode: 'text' });
    return;
  }

  // Ctrl+2 → modalità pan
  if ((e.ctrlKey || e.metaKey) && e.key === '2') {
    e.preventDefault();
    bus.emit('pdf:set-mode', { mode: 'pan' });
    return;
  }

  // Ctrl+↑/↓ → cambia pagina
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
    e.preventDefault();
    bus.emit('pdf:change-page', { delta: -1 });
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
    e.preventDefault();
    bus.emit('pdf:change-page', { delta: 1 });
    return;
  }
}