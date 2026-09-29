/* ============================================================
   IA-PARSER.JS — Parser Analisi_VERBALI.xlsx
   ============================================================ */

import { state } from '../core/state.js';
import { log, error } from '../core/utils.js';

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
    cellText: false,
  });

  const sheetName = workbook.SheetNames[0]; // Primo foglio
  log(`IA: parsing foglio "${sheetName}"`);

  const sheet = workbook.Sheets[sheetName];
 const rows = XLSX.utils.sheet_to_json(sheet, {
  defval: '',
  raw: false,
  header: 1,
  cellText: true,     // ← AGGIUNGI: usa il testo visualizzato
  cellDates: false,
  cellNF: true,       // ← AGGIUNGI: usa il formato numero
});

  if (rows.length < 2) {
    throw new Error('Il file IA è vuoto o non ha intestazioni');
  }

  // Prima riga = intestazioni
  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());

  // Indici delle colonne
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

  // Parsing righe
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const nome_file = String(row[idx.nome_file] || '').trim();
    if (!nome_file) continue; // salta righe senza nome file

    const item = {
      nome_file,
      indirizzo: idx.indirizzo >= 0 ? String(row[idx.indirizzo] || '').trim() : '',
      civico: idx.civico >= 0 ? String(row[idx.civico] || '').trim() : '',
      localita: idx.localita >= 0 ? String(row[idx.localita] || '').trim() : '',
  matricola: idx.matricola >= 0 ? cleanMatricola(row[idx.matricola]) : '',
      esito: idx.esito >= 0 ? String(row[idx.esito] || '').trim() : '',
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
 * Ripulisce una matricola "sporca" (decimale lungo, stringa vuota, N.D., ecc.).
 * Se il valore è un decimale con molte cifre decimali, prova a convertirlo in frazione
 * oppure lo scarta.
 */
function cleanMatricola(value) {
  if (value == null || value === '') return '';

  const str = String(value).trim();
  if (!str) return '';
  if (str.toUpperCase() === 'N.D.' || str.toUpperCase() === 'ND') return '';

  // Se è un numero decimale con molte cifre (>4 decimali) → sospetto
  const num = Number(str);
  if (Number.isFinite(num) && !Number.isInteger(num)) {
    const decimals = (str.split('.')[1] || '').length;
    if (decimals > 4) {
      // Prova a convertire in frazione (denominatore piccolo)
      const fraction = decimalToFraction(num);
      if (fraction) return fraction;
      // Altrimenti scarta (lascia vuoto)
      log(`Matricola spazzatura scartata: "${str}"`);
      return '';
    }
  }

  return str;
}

/**
 * Converte un decimale in frazione (approssimazione con denominatore ≤ 100).
 * Es: 0.076195219123506 → "1/3"
 */
function decimalToFraction(value) {
  if (!Number.isFinite(value)) return null;

  // Prova con denominatori crescenti
  const maxDen = 100;
  const tolerance = 1e-6;

  for (let den = 2; den <= maxDen; den++) {
    const num = value * den;
    const roundedNum = Math.round(num);
    if (Math.abs(num - roundedNum) < tolerance) {
      return `${roundedNum}/${den}`;
    }
  }

  return null;
}