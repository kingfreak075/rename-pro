/* ============================================================
   RENAME-ENGINE.JS — Logica di rinomina singola + sessione
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log, error, sanitizeFilename, stripPdfExtension } from '../core/utils.js';
import * as fs from '../fs/fs-adapter.js';

/**
 * Applica un nome manuale a un PDF.
 */
export function applyManualRename(idx, rawName) {
  const item = state.pdfItems[idx];
  if (!item) return false;

  const cleanName = sanitizeFilename(stripPdfExtension(rawName)) + '.pdf';
  if (!cleanName || cleanName === '.pdf') {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Nome non valido',
      type: 'warning',
    });
    return false;
  }

  state.applyRename(idx, {
    newName: cleanName,
    impianto: null,
    iaRecord: null,
  });

  return true;
}

/**
 * Resetta la rinomina di un PDF.
 */
export function resetRename(idx) {
  state.resetRename(idx);
}

// ============================================================
// SESSIONE
// ============================================================

const SESSION_FILENAME = 'sessione_rinomina.json';

/**
 * Salva la sessione corrente nella cartella sorgente.
 */
export async function saveSession() {
  if (!state.sourceFolderHandle) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Seleziona prima la cartella sorgente',
      type: 'warning',
    });
    return false;
  }

  try {
    const sessionData = state.serializeSession();
    const jsonContent = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });

    await fs.writeFile(state.sourceFolderHandle, SESSION_FILENAME, blob);

    log('Sessione salvata:', SESSION_FILENAME);
    bus.emit(EVENTS.SESSION_SAVED, { fileName: SESSION_FILENAME });
    bus.emit(EVENTS.TOAST_SHOW, {
      message: '✅ Sessione salvata',
      type: 'success',
    });

    return true;
  } catch (err) {
    error('Errore salvataggio sessione:', err);
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Errore salvataggio sessione',
      type: 'error',
    });
    return false;
  }
}

/**
 * Carica la sessione dalla cartella sorgente.
 */
export async function loadSession() {
  if (!state.sourceFolderHandle) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Seleziona prima la cartella sorgente',
      type: 'warning',
    });
    return false;
  }

  try {
    const content = await fs.readFileFromFolder(state.sourceFolderHandle, SESSION_FILENAME);

    if (!content) {
      bus.emit(EVENTS.TOAST_SHOW, {
        message: 'Nessuna sessione trovata nella cartella',
        type: 'info',
      });
      return false;
    }

    const sessionData = JSON.parse(content);
    state.restoreSession(sessionData);

    log('Sessione caricata');
    bus.emit(EVENTS.SESSION_LOADED, { fileName: SESSION_FILENAME });
    bus.emit(EVENTS.TOAST_SHOW, {
      message: '✅ Sessione caricata',
      type: 'success',
    });

    return true;
  } catch (err) {
    error('Errore caricamento sessione:', err);
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Errore lettura sessione',
      type: 'error',
    });
    return false;
  }
}