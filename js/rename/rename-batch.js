/* ============================================================
   RENAME-BATCH.JS — Rinomina massiva con progress bar
   ============================================================ */

import { state } from '../core/state.js';
import { bus, EVENTS } from '../core/events.js';
import { log, error, sanitizeFilenameSafe, stripPdfExtension } from '../core/utils.js';

let isRunning = false;

/**
 * Avvia la rinomina massiva.
 */
export async function startBatchRename() {
  if (isRunning) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Rinomina già in corso',
      type: 'warning',
    });
    return;
  }

  // Verifica precondizioni
  if (!state.destinationFolderHandle) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Seleziona prima una cartella di destinazione',
      type: 'warning',
    });
    return;
  }

  const toProcess = state.pdfItems.filter((i) => i.status === 'processed');
  if (toProcess.length === 0) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: 'Nessun file da rinominare',
      type: 'warning',
    });
    return;
  }

  isRunning = true;
  bus.emit(EVENTS.RENAME_BATCH_START, { total: toProcess.length });

  // Controlla collisioni di nome
  const collisions = findCollisions(toProcess);
  if (collisions.length > 0) {
    const proceed = window.confirm(
      `⚠️ Attenzione: ${collisions.length} file avranno lo stesso nome:\n\n` +
      collisions.map((c) => `- ${c.name} (${c.count} file)`).join('\n') +
      `\n\nVuoi continuare? I file verranno sovrascritti.`
    );
    if (!proceed) {
      isRunning = false;
      bus.emit(EVENTS.RENAME_BATCH_END, { completed: 0, total: toProcess.length, cancelled: true });
      return;
    }
  }

  let completed = 0;
  let failed = 0;
  const usedNames = new Set();

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    try {
      // Sanitizza nome finale
      let finalName = sanitizeFilenameSafe(stripPdfExtension(item.newName)) + '.pdf';

      // Gestione duplicati: aggiungi suffisso _2, _3...
      if (usedNames.has(finalName.toLowerCase())) {
        let counter = 2;
        let baseName = stripPdfExtension(finalName);
        while (usedNames.has(`${baseName}_${counter}.pdf`.toLowerCase())) {
          counter++;
        }
        finalName = `${baseName}_${counter}.pdf`;
        log(`Collisione risolta: ${finalName}`);
      }
      usedNames.add(finalName.toLowerCase());

      // Copia file
      const file = await item.handle.getFile();
      const destHandle = await state.destinationFolderHandle.getFileHandle(finalName, { create: true });
      const writable = await destHandle.createWritable();
      await writable.write(file);
      await writable.close();

      completed++;
      log(`Copiato: ${item.name} → ${finalName}`);

      // Aggiorna progress
      const percent = Math.round(((i + 1) / toProcess.length) * 100);
      bus.emit(EVENTS.RENAME_BATCH_PROGRESS, {
        current: i + 1,
        total: toProcess.length,
        percent,
        fileName: finalName,
      });
    } catch (err) {
      failed++;
      error(`Errore copia ${item.name}:`, err);
    }
  }

  isRunning = false;

  bus.emit(EVENTS.RENAME_BATCH_END, {
    completed,
    failed,
    total: toProcess.length,
  });

  // Toast finale
  if (failed === 0) {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: `✅ ${completed} file copiati in "${state.destinationFolderHandle.name}"`,
      type: 'success',
      duration: 5000,
    });
  } else {
    bus.emit(EVENTS.TOAST_SHOW, {
      message: `⚠️ ${completed} copiati, ${failed} falliti`,
      type: 'warning',
      duration: 6000,
    });
  }
}

/**
 * Trova collisioni di nome.
 */
function findCollisions(items) {
  const counts = {};
  items.forEach((item) => {
    const name = sanitizeFilenameSafe(stripPdfExtension(item.newName)) + '.pdf';
    counts[name] = (counts[name] || 0) + 1;
  });

  return Object.entries(counts)
    .filter(([_, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Verifica se la rinomina è in corso.
 */
export function isBatchRunning() {
  return isRunning;
}