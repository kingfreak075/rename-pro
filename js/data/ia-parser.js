/* ============================================================
   IA-PARSER.JS — Parser Analisi_VERBALI.xlsx
   ============================================================ */

import { state } from '../core/state.js';
import { log, error, sanitizeInput } from '../core/utils.js';

/**
 * Parsing del file Analisi_VERBALI.xlsx.
 * Struttura attesa (foglio "Foglio1" o primo foglio):
 *   A: nome_file | B: indirizzo | C: civico | D: localita | E: matricola | F: esito
 */
export async function parseIaFile(file) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Libreria XLSX non caricata');
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: false,
    cellNF: false,
    cellText: true,
  });

  const sheetName = workbook.SheetNames[0];
  log(`IA: parsing foglio "${sheetName}"`);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
    header: 1,
  });

  if (rows.length < 2) {
    throw new Error('Il file IA è vuoto o non ha intestazioni');
  }

  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());

  const idx = {
    nome_file: headers.findIndex((h) => h === 'nome_file'),
    indirizzo: headers.findIndex((h) => h === 'indirizzo'),
    civico: headers.findIndex((h) => h === 'civico'),
    localita: headers.findIndex((h) => h === 'localita' || h === 'località'),
    matricola: headers.findIndex((h) => h === 'matricola'),
    esito: headers.findIndex((h) => h === 'esito'),
  };

  if (idx.nome_file === -1) {
    throw new Error('Colonna "nome_file" non trovata nel file IA');
  }

  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const nome_file = String(row[idx.nome_file] || '').trim();
    if (!nome_file) continue;

    const item = {
      nome_file: sanitizeInput(nome_file, 255),
      indirizzo: idx.indirizzo >= 0 ? sanitizeInput(row[idx.indirizzo], 200) : '',
      civico: idx.civico >= 0 ? sanitizeInput(row[idx.civico], 50) : '',
      localita: idx.localita >= 0 ? sanitizeInput(row[idx.localita], 100) : '',
      matricola: idx.matricola >= 0 ? cleanMatricola(row[idx.matricola]) : '',
      esito: idx.esito >= 0 ? sanitizeInput(row[idx.esito], 30) : '',
    };

    items.push(item);
  }

  log(`IA: ${items.length} record parsati`);
  return items;
}

/**
 * Carica il file IA e aggiorna lo stato.
 */
export async function loadAndApply(file, fileName) {
  try {
    log('Parsing IA:', fileName);
    const items = await parseIaFile(file);
    state.setIaData(items, fileName);
    return items;
  } catch (err) {
    error('Errore parsing IA:', err);
    throw err;
  }
}

/**
 * Ripulisce una matricola "sporca".
 */
function cleanMatricola(value) {
  if (value == null || value === '') return '';

  const str = String(value).trim();
  if (!str) return '';
  if (str.toUpperCase() === 'N.D.' || str.toUpperCase() === 'ND') return '';

  // Decimali lunghi (numeri Excel frazionari) → scarta
  const num = Number(str);
  if (Number.isFinite(num) && !Number.isInteger(num)) {
    const decimals = (str.split('.')[1] || '').length;
    if (decimals > 4) {
      log(`Matricola decimale spazzatura scartata: "${str}"`);
      return '';
    }
  }

  // Stringhe troppo corte
  if (str.length < 3) {
    log(`Matricola troppo corta scartata: "${str}"`);
    return '';
  }

  return str;
}