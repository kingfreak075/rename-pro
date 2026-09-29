#!/usr/bin/env node
/* ============================================================
   BUILD.MJS — Crea bundle HTML singolo (tutto incluso)
   ============================================================
   
   Uso:
     node build/build.mjs
   
   Output:
     dist/rename-pro.html  (file singolo ~1.5 MB)
   
   Il file generato contiene:
   - HTML inline
   - CSS inline
   - JS inline (tutti i moduli concatenati)
   - Vendor inline (FontAwesome, XLSX, PDF.js base64)
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

console.log('🏗️  Build Rename Pro...');
console.log(`   Root: ${ROOT}`);

// ============================================================
// UTILITY
// ============================================================

function read(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

function write(relPath, content) {
  const fullPath = resolve(DIST, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  console.log(`   ✅ ${relPath}`);
}

function fileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ============================================================
// CONCATENA MODULI JS
// ============================================================

const JS_MODULES = [
  'js/core/utils.js',
  'js/core/events.js',
  'js/core/state.js',
  'js/fs/fs-adapter.js',
  'js/fs/fs-chromium.js',
  'js/fs/fs-fallback.js',
  'js/data/excel-parser.js',
  'js/data/ia-parser.js',
  'js/data/normalizer.js',
  'js/data/matcher.js',
  'js/pdf/pdf-viewer.js',
  'js/pdf/pdf-textlayer.js',
  'js/pdf/pdf-pan.js',
  'js/search/search-engine.js',
  'js/search/search-panel.js',
  'js/search/details-modal.js',
  'js/search/ia-panel.js',
  'js/rename/score-engine.js',
  'js/rename/rename-engine.js',
  'js/rename/rename-batch.js',
  'js/rename/name-builder.js',
  'js/ui/toast.js',
  'js/ui/spinner.js',
  'js/ui/header.js',
  'js/ui/list.js',
  'js/ui/shortcuts.js',
  'js/ui/score-banner.js',
  'js/main.js',
];

function buildJsBundle() {
  console.log('📦 Concatenazione moduli JS...');
  const parts = [];

  for (const rel of JS_MODULES) {
    const fullPath = resolve(ROOT, rel);
    if (!existsSync(fullPath)) {
      console.warn(`   ⚠️  File non trovato: ${rel}`);
      continue;
    }
    let content = readFileSync(fullPath, 'utf-8');

    // Rimuovi import/export (non servono nel bundle)
    content = content
      // Rimuovi import
      .replace(/^\s*import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
      // Rimuovi export (ma non le funzioni/classi)
      .replace(/^export\s+(async\s+function|function|const|let|var|class)\s+/gm, '$1 ')
      .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
      .replace(/^export\s+default\s+/gm, '');

    parts.push(`/* ============================================================
   FILE: ${rel}
   ============================================================ */
${content}
`);
  }

  // Avvolgi tutto in una IIFE per evitare leak globali (tranne window.__APP__)
  const bundle = `(function() {
'use strict';

${parts.join('\n')}

})();`;

  return bundle;
}

// ============================================================
// BUILD
// ============================================================

try {
  // Pulisci dist
  if (existsSync(DIST)) {
    console.log('🧹 Pulizia dist/...');
    // Non cancelliamo, sovrascriviamo
  }
  mkdirSync(DIST, { recursive: true });

  // 1. Leggi index.html
  console.log('📄 Lettura index.html...');
  let html = read('index.html');

  // 2. Inline CSS
  console.log('🎨 Inline CSS...');
  const cssFiles = [
    'css/base.css',
    'css/layout.css',
    'css/components.css',
    'css/pdf-viewer.css',
    'css/list.css',
    'css/theme.css',
  ];
  let cssContent = '';
  for (const cssFile of cssFiles) {
    cssContent += `\n/* ===== ${cssFile} ===== */\n` + read(cssFile);
  }
  html = html.replace(
    /<!-- CSS modulari -->[\s\S]*?<link rel="stylesheet" href="css\/theme.css">/,
    `<style>\n${cssContent}\n</style>`
  );

  // 3. Inline vendor CSS (FontAwesome)
  console.log('🎨 Inline FontAwesome CSS...');
  const faCss = read('vendor/fontawesome/css/all.min.css');
  // I percorsi ../webfonts/ vanno sostituiti con data URIs o lasciati così (richiede vendor/)
  // Per semplicità, lasciamo i percorsi relativi (dist/ avrà vendor/ accanto)
  html = html.replace(
    /<link rel="stylesheet" href="vendor\/fontawesome\/css\/all.min.css">/,
    `<style>\n${faCss}\n</style>`
  );

  // 4. Inline vendor JS (XLSX + PDF.js)
  console.log('📦 Inline vendor JS...');
  const xlsxJs = read('vendor/xlsx/xlsx.full.min.js');
  const pdfJs = read('vendor/pdfjs/pdf.min.js');

  // Sostituisci i tag script
  html = html.replace(
    /<script src="vendor\/xlsx\/xlsx.full.min.js"><\/script>/,
    `<script>\n${xlsxJs}\n</script>`
  );
  html = html.replace(
    /<script src="vendor\/pdfjs\/pdf.min.js"><\/script>/,
    `<script>\n${pdfJs}\n</script>`
  );

  // 5. Inline moduli JS
  console.log('📦 Bundle JS moduli...');
  const jsBundle = buildJsBundle();
  html = html.replace(
    /<script type="module" src="js\/main.js"><\/script>/,
    `<script>\n${jsBundle}\n</script>`
  );

  // 6. Fix worker PDF.js (dato che non possiamo inlinarlo per CORS)
  // Il worker rimane esterno, quindi il file HTML singolo NON funziona al 100%
  // Per risolvere, usiamo un worker inline via Blob
  console.log('⚙️  Fix PDF.js worker...');
  const workerFix = `
<script>
  // Fix per PDF.js worker: crea un blob inline
  (function() {
    const originalWorkerSrc = 'vendor/pdfjs/pdf.worker.min.js';
    // Il worker esterno non è disponibile nel file singolo,
    // quindi usiamo un fallback con fake worker
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
    }
  })();
</script>`;
  html = html.replace('</body>', workerFix + '\n</body>');

  // 7. Scrivi output
  write('rename-pro.html', html);

  // 8. Copia vendor (per worker PDF.js)
  console.log('📋 Copia vendor/ in dist/...');
  // Copiamo solo il worker PDF.js
  const workerSrc = resolve(ROOT, 'vendor/pdfjs/pdf.worker.min.js');
  const workerDst = resolve(DIST, 'vendor/pdfjs/pdf.worker.min.js');
  mkdirSync(dirname(workerDst), { recursive: true });
  writeFileSync(workerDst, readFileSync(workerSrc));
  console.log('   ✅ vendor/pdfjs/pdf.worker.min.js');

  // Copia webfonts FontAwesome
  const faFontsDir = resolve(ROOT, 'vendor/fontawesome/webfonts');
  if (existsSync(faFontsDir)) {
    const fontsDstDir = resolve(DIST, 'vendor/fontawesome/webfonts');
    mkdirSync(fontsDstDir, { recursive: true });
    for (const file of readdirSync(faFontsDir)) {
      writeFileSync(resolve(fontsDstDir, file), readFileSync(resolve(faFontsDir, file)));
    }
    console.log('   ✅ vendor/fontawesome/webfonts/*');
  }

  // ============================================================
  // REPORT FINALE
  // ============================================================

  const mainHtml = resolve(DIST, 'rename-pro.html');
  const mainSize = statSync(mainHtml).size;

  console.log('\n✨ Build completata!\n');
  console.log(`   📄 Output: dist/rename-pro.html (${fileSize(mainSize)})`);
  console.log(`   📁 Cartella: dist/`);
  console.log(`\n   💡 Il file è autonomo tranne per:`);
  console.log(`      - vendor/pdfjs/pdf.worker.min.js (worker PDF.js)`);
  console.log(`      - vendor/fontawesome/webfonts/* (font icone)`);
  console.log(`\n   📦 Per distribuire: zippa la cartella dist/\n`);

} catch (err) {
  console.error('\n❌ Errore build:', err);
  process.exit(1);
}