/* ============================================================
   FS-ADAPTER.JS — Wrapper unificato File System Access API
   (Placeholder — verrà implementato nello Step 5)
   ============================================================ */

import { log } from '../core/utils.js';

export const isSupported = 'showDirectoryPicker' in window;

export function logSupport() {
  log('FS Adapter — supporto:', isSupported);
}

// Le funzioni verranno aggiunte nello Step 5:
// - pickSourceFolder()
// - pickDestinationFolder()
// - listPdfFiles(handle)
// - readFile(handle)
// - writeFile(dirHandle, name, blob)