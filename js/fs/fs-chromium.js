/* ============================================================
   FS-CHROMIUM.JS — Implementazione Chromium (File System Access)
   (Placeholder — verrà implementato nello Step 5)
   ============================================================ */

// Verrà implementato nello Step 5.


/* ============================================================
   FS-CHROMIUM.JS — Implementazione Chromium (File System Access)
   ============================================================ */

// Per ora, tutta la logica è in fs-adapter.js.
// Questo file esiste per separare le implementazioni future:
// - fs-chromium.js → showDirectoryPicker (Chrome/Edge)
// - fs-fallback.js → <input webkitdirectory> + JSZip (Firefox/Safari)
//
// L'adapter sceglie automaticamente l'implementazione corretta.

export const supported = 'showDirectoryPicker' in window;