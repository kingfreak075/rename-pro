/* ============================================================
   NAME-BUILDER.JS — Costruzione nome file (PARCO o IA)
   ============================================================ */

import { sanitizeMatricola, sanitizeAddressForFile } from '../data/normalizer.js';
import { stripPdfExtension } from '../core/utils.js';

/**
 * Costruisce il nome file provvisorio da un record IA.
 * Formato: {matricola}_{indirizzo}_{civico}.pdf
 * Es: "FS 72" + "VIA COLLI DI PADERNO" + "1" → "FS_72_COLLI_DI_PADERNO_1.pdf"
 */
export function buildIaFileName(record) {
  if (!record) return '';

  const matricola = sanitizeMatricola(record.matricola);
  const indirizzo = sanitizeAddressForFile(record.indirizzo);
  const civico = (record.civico || '').toString().trim()
    .replace(/[\/\\]/g, '-')
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9\-]/g, '');

  const parts = [matricola, indirizzo];
  if (civico) parts.push(civico);

  const name = parts.filter(Boolean).join('_');
  return (name || stripPdfExtension(record.nome_file || 'verbale')) + '.pdf';
}

/**
 * Costruisce il nome file dal PARCO.
 * Formato: {codice}_BIE.pdf
 */
export function buildParcoFileName(impianto) {
  if (!impianto) return '';
  return `${impianto.impianto}_BIE.pdf`;
}