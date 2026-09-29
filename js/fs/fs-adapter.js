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

/* ============================================================
   FS-ADAPTER.JS — Wrapper unificato File System Access API
   ============================================================ */

import { log, warn } from '../core/utils.js';

/**
 * Verifica se il browser supporta la File System Access API.
 */
export const isSupported = () =>
  'showDirectoryPicker' in window && 'FileSystemFileHandle' in window;

/**
 * Apre il picker per selezionare una cartella.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export async function pickDirectory() {
  if (!isSupported()) {
    warn('File System Access API non supportata');
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    log('Cartella selezionata:', handle.name);
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') {
      log('Selezione cartella annullata');
      return null;
    }
    console.error('Errore selezione cartella:', err);
    throw err;
  }
}

/**
 * Elenca i file PDF in una cartella.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<Array<{name, handle}>>}
 */
export async function listPdfFiles(dirHandle) {
  if (!dirHandle) return [];
  const files = [];
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push({ name: entry.name, handle: entry });
      }
    }
    // Ordina alfabeticamente
    files.sort((a, b) => a.name.localeCompare(b.name, 'it'));
    log(`${files.length} PDF trovati in "${dirHandle.name}"`);
    return files;
  } catch (err) {
    console.error('Errore elenco file:', err);
    throw err;
  }
}

/**
 * Legge un file come ArrayBuffer.
 * @param {FileSystemFileHandle} fileHandle
 * @returns {Promise<ArrayBuffer>}
 */
export async function readFileAsArrayBuffer(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.arrayBuffer();
}

/**
 * Legge un file come testo.
 */
export async function readFileAsText(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Scrive un Blob in un file nella cartella di destinazione.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} fileName
 * @param {Blob|File} content
 */
export async function writeFile(dirHandle, fileName, content) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  log(`File scritto: ${fileName}`);
}

/**
 * Verifica se un file esiste in una cartella.
 */
export async function fileExists(dirHandle, fileName) {
  try {
    await dirHandle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Legge un file dalla cartella sorgente (per sessione).
 */
export async function readFileFromFolder(dirHandle, fileName) {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (err) {
    if (err.name === 'NotFoundError') return null;
    throw err;
  }
}