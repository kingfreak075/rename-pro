/* ============================================================
   NORMALIZER.JS — Normalizzazione indirizzi e stringhe
   ============================================================ */

import { normalizeString, log } from '../core/utils.js';

/**
 * Prefissi stradali da rimuovere in testa all'indirizzo.
 * L'ordine è importante: prima i più lunghi.
 */
const PREFIXES = [
  'PIAZZETTA',
  'PIAZZALE',
  'PIAZZA',
  'P.ZZA',
  'P.ZA',
  'P.TTA',
  'P.TA',
  'CIRCONVALLAZIONE',
  'STRADA',
  'STRADA PROVINCIALE',
  'STRADA STATALE',
  'VIA PROVINCIALE',
  'VIA STATALE',
  'VIALE',
  'VICOLO',
  'VICOLETTO',
  'LARGO',
  'LUNGOMARE',
  'LUNGADIGE',
  'CORSO',
  'C.SO',
  'C.SO',
  'SALITA',
  'DISCESA',
  'BORGO',
  'CONTRADA',
  'LOCALITÀ',
  'LOCALITA',
  'LOC.',
  'FRAZIONE',
  'FRAZ.',
  'VIA',
  'V.',
  'V',
  'STR.',
  'STR',
  'PIAZZA',
  'S.S.',
  'SP',
  'SS',
];

/**
 * Rimuove il prefisso stradale da un indirizzo.
 * Es: "VIA COLLI DI PADERNO" → "COLLI DI PADERNO"
 *     "PIAZZETTA GAMBERINI" → "GAMBERINI"
 *     "CORSO DEL GUERCINO" → "DEL GUERCINO"
 */
export function stripStreetPrefix(address) {
  if (!address) return '';

  let clean = String(address).trim();

  // Normalizza per il confronto (uppercase)
  const upper = clean.toUpperCase();

  for (const prefix of PREFIXES) {
    // Confronto case-insensitive, con spazio dopo
    if (upper.startsWith(prefix + ' ') || upper === prefix) {
      clean = clean.substring(prefix.length).trim();
      // Rimuovi eventuali punti/virgole dopo il prefisso
      clean = clean.replace(/^[.,;:\s]+/, '');
      log(`Indirizzo normalizzato: "${address}" → "${clean}"`);
      return clean;
    }
  }

  return clean;
}

/**
 * Normalizza un indirizzo completo: rimuove prefisso + uppercase + spazi singoli.
 */
export function normalizeAddress(address) {
  if (!address) return '';
  const stripped = stripStreetPrefix(address);
  return stripped
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estrae la "parte pulita" di un indirizzo per la ricerca.
 * Rimuove prefisso + civico (se presente in coda).
 */
export function extractSearchableAddress(address) {
  if (!address) return '';
  let clean = stripStreetPrefix(address);

  // Rimuovi civico in coda (numeri + eventuali lettere/barre)
  clean = clean.replace(/\s+\d+[\/\w\s]*$/, '').trim();

  return clean.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Sanitizza una matricola per uso in nome file.
 * - Spazi → underscore
 * - / → -
 * - Punti rimossi
 * - Caratteri non validi rimossi
 */
export function sanitizeMatricola(matricola) {
  if (!matricola) return 'ND';

  let clean = String(matricola).trim();
  if (!clean || clean.toUpperCase() === 'N.D.' || clean.toUpperCase() === 'ND') {
    return 'ND';
  }

  clean = clean
    .replace(/\./g, '')          // rimuovi punti
    .replace(/[\/\\]/g, '-')     // slash → trattino
    .replace(/\s+/g, '_')        // spazi → underscore
    .replace(/[<>:"|?*]/g, '')   // rimuovi caratteri non validi
    .replace(/_+/g, '_')         // underscore multipli
    .replace(/^_|_$/g, '');      // trim underscore

  return clean || 'ND';
}

/**
 * Sanitizza una parte di indirizzo per uso in nome file.
 * - Spazi → underscore
 * - Uppercase
 * - Rimozione caratteri non validi
 */
export function sanitizeAddressForFile(address) {
  if (!address) return 'ND';

  let clean = stripStreetPrefix(address)
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[àáâãäå]/g, 'A')
    .replace(/[èéêë]/g, 'E')
    .replace(/[ìíîï]/g, 'I')
    .replace(/[òóôõö]/g, 'O')
    .replace(/[ùúûü]/g, 'U')
    .replace(/[^A-Z0-9_]/g, '')   // rimuovi tutto ciò che non è A-Z, 0-9, _
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return clean || 'ND';
}

/**
 * Verifica se due indirizzi sono "simili" (utile per matching fuzzy).
 */
export function areAddressesSimilar(a, b) {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Uno contiene l'altro
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}


/**
 * Normalizza una matricola per la ricerca.
 * Rimuove spazi, punti, trattini, slash e prefissi comuni.
 * Es: "FS 72" → "FS72"
 *     "ENPI BO 8474" → "BO8474"      ← rimuove ENPI
 *     "ISPESL BO 1199/90" → "BO119990" ← rimuove ISPESL
 *     "32311/2005" → "323112005"
 *     "A/01470" → "A01470"
 *     "N.D." → "ND"
 */
export function normalizeMatricolaForSearch(matricola) {
  if (!matricola) return '';

  let clean = String(matricola)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\.\/\\\-_:;,]/g, '')
    .trim();

  // Rimuovi prefissi comuni (l'IA spesso li aggiunge ma il PARCO no)
  const PREFIXES = ['ENPI', 'ISPESL', 'INAIL', 'ASL', 'ARPA', 'IMM'];
  for (const p of PREFIXES) {
    if (clean.startsWith(p)) {
      clean = clean.substring(p.length);
    }
  }

  // Rimuovi suffissi numerici dopo il match principale (es. "/64", "/90")
  // Ma solo se il numero principale è ≥ 4 caratteri
  // Es: "BO314264" → "BO3142" se dopo c'è un numero di 2 cifre
  // NON fare questa riduzione se rischia di togliere troppo

  return clean;
}

/**
 * Versione che produce anche una "chiave ridotta" per match parziali.
 * Es: "ENPI BO 3142/64" → { compact: "BO314264", short: "BO3142" }
 *     "32311/2005"      → { compact: "323112005", short: "323112005" }  (anno: no taglio)
 *     "P0046/17"        → { compact: "P004617", short: "P0046" }
 */
export function getMatricolaKeys(matricola) {
  if (!matricola) return { compact: '', short: '' };

  const raw = String(matricola).trim();
  const compact = normalizeMatricolaForSearch(raw);

  // Prova a estrarre un "prefisso principale" + "suffisso corto"
  // Es: "ENPI BO 3142/64" → principale = "ENPI BO 3142", suffisso = "64"

  // Regex: tutto fino all'ultimo / o - o spazio-seguito-da-numero
  const suffixMatch = raw.match(/[\/\-]\s*(\d{1,3})$/);
  let short = compact;

  if (suffixMatch) {
    // Rimuovi il suffisso breve (1-3 cifre) dal compact
    const suffix = suffixMatch[1];
    if (compact.endsWith(suffix)) {
      short = compact.substring(0, compact.length - suffix.length);
    }
  }

  // Se short è troppo corto → non è utile, mantieni compact
  if (short.length < 3) {
    short = compact;
  }

  return { compact, short };
}