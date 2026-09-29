/* ============================================================
   STATE.JS — Stato centrale dell'applicazione
   ============================================================ */

import { bus, EVENTS } from './events.js';
import { uuid, log } from './utils.js';

/**
 * Struttura dello stato globale.
 * Ogni mutazione emette un evento per notificare i moduli interessati.
 */
class AppState {
  constructor() {
    this.reset();
  }

  reset() {
    // ---------- DATI EXCEL ----------
    this.excelData = {
      parco: [],
      elenco: [],
      annotazioni: [],
      archivio: [],
      m28: [],
      mappature: {
        commerciali: {},
        giri: {},
      },
      loaded: false,
      zones: [],
      sourceFileName: null,
      loadedAt: null,
    };

    // ---------- DATI IA ----------
    this.iaData = {
      items: [],               // Array di record { nome_file, indirizzo, civico, localita, matricola, esito }
      byFilename: new Map(),   // Map: "nomefile.pdf" (lowercase) → record
      loaded: false,
      sourceFileName: null,
      loadedAt: null,
      stats: {
        total: 0,
        positivi: 0,
        negativi: 0,
      },
    };

    // ---------- CARTELLE ----------
    this.sourceFolderHandle = null;
    this.destinationFolderHandle = null;

    // ---------- LISTA PDF ----------
    this.pdfItems = [];           // Array di { id, name, handle, newName, selectedImpianto, iaRecord, status, isEditing }
    this.currentFilter = 'all';   // all | pending | done
    this.currentSelectedIdx = -1;

    // ---------- PDF CORRENTE ----------
    this.currentPdf = {
      pdfDoc: null,
      pageNum: 1,
      scale: 1.5,
      mode: 'text',        // text | pan
      panX: 0,
      panY: 0,
      isPanning: false,
      startPanX: 0,
      startPanY: 0,
    };

    // ---------- RICERCA ----------
    this.lastSearchMatch = null;     // Ultimo impianto trovato (per modale dettagli)
    this.lastSearchQuery = '';
    this.searchHistory = [];         // Ultime 10 query
    this.currentIaMatch = null;      // Record IA del PDF correntemente selezionato
    this.needsManualSearch = false;  // Flag per bordo blu

    // ---------- MODALITÀ ----------
    this.isRenaming = false;
  }

  // ============================================================
  // DATI EXCEL
  // ============================================================

  setExcelData({ parco, elenco, annotazioni, archivio, m28, mappature, sourceFileName }) {
    this.excelData.parco = parco || [];
    this.excelData.elenco = elenco || [];
    this.excelData.annotazioni = annotazioni || [];
    this.excelData.archivio = archivio || [];
    this.excelData.m28 = m28 || [];
    this.excelData.mappature = mappature || { commerciali: {}, giri: {} };
    this.excelData.sourceFileName = sourceFileName || null;
    this.excelData.loadedAt = new Date().toISOString();
    this.excelData.loaded = true;

    // Estrai zone uniche
    this.excelData.zones = [
      ...new Set(
        this.excelData.parco
          .map((p) => p.zona)
          .filter((z) => z != null && z !== '')
      ),
    ].sort();

    log('Excel data loaded:', this.excelData.parco.length, 'impianti');
    bus.emit(EVENTS.DB_LOADED, {
      count: this.excelData.parco.length,
      zones: this.excelData.zones,
    });
  }

  // ============================================================
  // DATI IA
  // ============================================================

  setIaData(items, sourceFileName) {
    this.iaData.items = items || [];
    this.iaData.byFilename = new Map();
    this.iaData.sourceFileName = sourceFileName || null;
    this.iaData.loadedAt = new Date().toISOString();
    this.iaData.loaded = true;

    // Indice per nome file (lowercase)
    let positivi = 0;
    let negativi = 0;
    for (const item of this.iaData.items) {
      if (item.nome_file) {
        this.iaData.byFilename.set(item.nome_file.toLowerCase().trim(), item);
      }
      if (item.esito === 'Positivo') positivi++;
      else if (item.esito === 'Negativo') negativi++;
    }

    this.iaData.stats = {
      total: this.iaData.items.length,
      positivi,
      negativi,
    };

    log('IA data loaded:', this.iaData.stats);
    bus.emit(EVENTS.IA_LOADED, this.iaData.stats);
  }

  /**
   * Cerca il record IA per un nome file PDF (case-insensitive).
   */
  findIaRecordByFilename(filename) {
    if (!this.iaData.loaded || !filename) return null;
    return this.iaData.byFilename.get(filename.toLowerCase().trim()) || null;
  }

  // ============================================================
  // CARTELLE
  // ============================================================

  setSourceFolder(handle) {
    this.sourceFolderHandle = handle;
    bus.emit(EVENTS.SOURCE_FOLDER_SELECTED, { name: handle?.name || null });
  }

  setDestinationFolder(handle) {
    this.destinationFolderHandle = handle;
    bus.emit(EVENTS.DEST_FOLDER_SELECTED, { name: handle?.name || null });
  }

  // ============================================================
  // PDF ITEMS
  // ============================================================

  /**
   * Imposta la lista di PDF (reset).
   * @param {Array<{name, handle}>} files
   */
  setPdfItems(files) {
    this.pdfItems = files.map((f) => ({
      id: uuid(),
      name: f.name,
      handle: f.handle,
      newName: '',
      selectedImpianto: null,
      iaRecord: null,
      status: 'pending',      // pending | processed
      isEditing: false,
    }));
    this.currentSelectedIdx = -1;
    this.currentPdf.pdfDoc = null;
    this.currentIaMatch = null;
    this.needsManualSearch = false;
    bus.emit(EVENTS.PDF_LIST_UPDATED, { count: this.pdfItems.length });
  }

  getPdfItem(idx) {
    return this.pdfItems[idx] || null;
  }

  getCurrentPdfItem() {
    return this.pdfItems[this.currentSelectedIdx] || null;
  }

  selectPdf(idx) {
    this.currentSelectedIdx = idx;
    bus.emit(EVENTS.PDF_SELECTED, { idx, item: this.getPdfItem(idx) });
  }

  updatePdfItem(idx, patch) {
    const item = this.pdfItems[idx];
    if (!item) return;
    Object.assign(item, patch);
    bus.emit(EVENTS.PDF_LIST_UPDATED, { count: this.pdfItems.length });
  }

  /**
   * Applica un nome (da PARCO o manuale).
   */
  applyRename(idx, { newName, impianto = null, iaRecord = null }) {
    const item = this.pdfItems[idx];
    if (!item) return;
    item.newName = newName;
    item.selectedImpianto = impianto;
    item.iaRecord = iaRecord;
    item.status = 'processed';
    item.isEditing = false;
    bus.emit(EVENTS.RENAME_APPLIED, { idx, newName });
    bus.emit(EVENTS.PDF_LIST_UPDATED, { count: this.pdfItems.length });
  }

  resetRename(idx) {
    const item = this.pdfItems[idx];
    if (!item) return;
    item.newName = '';
    item.selectedImpianto = null;
    item.iaRecord = null;
    item.status = 'pending';
    item.isEditing = false;
    bus.emit(EVENTS.RENAME_RESET, { idx });
    bus.emit(EVENTS.PDF_LIST_UPDATED, { count: this.pdfItems.length });
  }

  // ============================================================
  // FILTRI
  // ============================================================

  setFilter(filter) {
    this.currentFilter = filter;
    bus.emit(EVENTS.PDF_LIST_UPDATED, { count: this.pdfItems.length });
  }

  getFilteredPdfItems() {
    if (this.currentFilter === 'pending') {
      return this.pdfItems.filter((i) => i.status === 'pending');
    }
    if (this.currentFilter === 'done') {
      return this.pdfItems.filter((i) => i.status === 'processed');
    }
    return this.pdfItems;
  }

  // ============================================================
  // CONTATORI
  // ============================================================

  getCounters() {
    const total = this.pdfItems.length;
    const pending = this.pdfItems.filter((i) => i.status === 'pending').length;
    const done = this.pdfItems.filter((i) => i.status === 'processed').length;
    return { total, pending, done };
  }

  // ============================================================
  // RICERCA
  // ============================================================

  addToSearchHistory(query) {
    if (!query || query.length < 3) return;
    const q = query.toLowerCase().trim();
    this.searchHistory = [q, ...this.searchHistory.filter((h) => h !== q)].slice(0, 10);
  }

  setCurrentIaMatch(record, needsManual = false) {
    this.currentIaMatch = record;
    this.needsManualSearch = needsManual;
    bus.emit(EVENTS.SEARCH_IA_MATCH, { record, needsManual });
  }

  // ============================================================
  // SESSIONE (serializzazione)
  // ============================================================

  /**
   * Serializza lo stato per il salvataggio sessione.
   */
  serializeSession() {
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      sourceFolderName: this.sourceFolderHandle?.name || null,
      pdfItems: this.pdfItems.map((item) => ({
        originalName: item.name,
        nuovoNome: item.newName,
        impiantoCodice: item.selectedImpianto?.impianto || null,
        iaRecord: item.iaRecord
          ? {
              nome_file: item.iaRecord.nome_file,
              matricola: item.iaRecord.matricola,
              esito: item.iaRecord.esito,
            }
          : null,
        processed: item.status === 'processed',
      })),
    };
  }

  /**
   * Applica una sessione caricata.
   */
  restoreSession(sessionData) {
    if (!sessionData || !Array.isArray(sessionData.pdfItems)) return;

    sessionData.pdfItems.forEach((s) => {
      const item = this.pdfItems.find((i) => i.name === s.originalName);
      if (!item) return;

      item.newName = s.nuovoNome || '';
      item.status = s.processed ? 'processed' : 'pending';
      item.isEditing = false;

      // Ripristina riferimento impianto dal PARCO (se caricato)
      if (s.impiantoCodice && this.excelData.loaded) {
        item.selectedImpianto =
          this.excelData.parco.find((p) => p.impianto == s.impiantoCodice) || null;
      }

      // Ripristina record IA (se caricato)
      if (s.iaRecord?.nome_file && this.iaData.loaded) {
        item.iaRecord = this.findIaRecordByFilename(s.iaRecord.nome_file);
      }
    });

    bus.emit(EVENTS.SESSION_LOADED, { count: sessionData.pdfItems.length });
    bus.emit(EVENTS.PDF_LIST_UPDATED, { count: this.pdfItems.length });
  }
}

// Singleton
export const state = new AppState();