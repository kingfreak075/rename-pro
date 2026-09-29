/* ============================================================
   EXCEL-PARSER.JS — Parser database Excel (PARCO, ELENCO, ...)
   (Placeholder — verrà implementato nello Step 2)
   ============================================================ */

// Verrà implementato nello Step 2.

/* ============================================================
   EXCEL-PARSER.JS — Parser database Excel
   ============================================================ */

import { state } from '../core/state.js';
import { log, error } from '../core/utils.js';

/**
 * Legge un file Excel e restituisce i dati parsati.
 * @param {File|Blob} file
 * @returns {Promise<Object>} - Dati parsati
 */
export async function parseExcel(file) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Libreria XLSX non caricata');
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetNames = workbook.SheetNames;
  log('Fogli trovati:', sheetNames);

  // ---------- PARCO ----------
  const parcoName = sheetNames.find((n) => n.toUpperCase() === 'PARCO');
  let parco = [];
  if (parcoName) {
    parco = readSheet(workbook, parcoName);
    log(`PARCO: ${parco.length} impianti`);
  } else {
    console.warn('Foglio PARCO non trovato');
  }

  // ---------- ELENCO ----------
  const elencoName = sheetNames.find((n) => n.toUpperCase() === 'ELENCO');
  const elenco = elencoName ? readSheet(workbook, elencoName) : [];
  if (elencoName) log(`ELENCO: ${elenco.length} righe`);

  // ---------- ANNOTAZIONI ----------
  const annName = sheetNames.find((n) => n.toUpperCase() === 'ANNOTAZIONI');
  const annotazioni = annName ? readSheet(workbook, annName) : [];
  if (annName) log(`ANNOTAZIONI: ${annotazioni.length} righe`);

  // ---------- ARCHIVIO ----------
  const archName = sheetNames.find((n) => n.toUpperCase() === 'ARCHIVIO');
  const archivio = archName ? readSheet(workbook, archName) : [];
  if (archName) log(`ARCHIVIO: ${archivio.length} righe`);

  // ---------- M28 ----------
  const m28Name = sheetNames.find((n) => n.toUpperCase() === 'M28');
  const m28 = m28Name ? readSheet(workbook, m28Name) : [];
  if (m28Name) log(`M28: ${m28.length} righe`);

  // ---------- MAPPATURE ----------
  const mapName = sheetNames.find((n) => n.toUpperCase() === 'MAPPATURE');
  const mappature = { commerciali: {}, giri: {} };
  if (mapName) {
    const mapData = readSheet(workbook, mapName);
    mapData.forEach((row) => {
      const tipo = (row.Tipo || '').toString().toUpperCase().trim();
      const codice = row.Codice;
      const nome = row.Nome;
      if (!codice || !nome) return;
      if (tipo === 'COMMERCIALE') {
        mappature.commerciali[codice] = nome;
      } else if (tipo === 'GIRO') {
        mappature.giri[codice] = nome;
      }
    });
    log('MAPPATURE:', {
      commerciali: Object.keys(mappature.commerciali).length,
      giri: Object.keys(mappature.giri).length,
    });
  }

  return { parco, elenco, annotazioni, archivio, m28, mappature };
}

/**
 * Legge un foglio e restituisce un array di oggetti.
 * Rimuove righe completamente vuote.
 */
function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,       // Usa i valori formattati
    dateNF: 'dd/mm/yyyy',
  });

  // Filtra righe vuote (tutte le colonne vuote)
  return rows.filter((row) =>
    Object.values(row).some((v) => v !== '' && v != null)
  );
}

/**
 * Carica un file Excel e aggiorna lo stato.
 * @param {File|Blob} file
 * @param {string} fileName
 */
export async function loadAndApply(file, fileName) {
  try {
    log('Parsing Excel:', fileName);
    const data = await parseExcel(file);
    state.setExcelData({ ...data, sourceFileName: fileName });
    return data;
  } catch (err) {
    error('Errore parsing Excel:', err);
    throw err;
  }
}