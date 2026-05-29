'use strict';

// Lazy-load canvas (native module — may fail if not compiled)
let _canvasCreate = null;
function getCreateCanvas() {
  if (_canvasCreate === null) {
    try { _canvasCreate = require('canvas').createCanvas; }
    catch { _canvasCreate = false; }
  }
  return _canvasCreate || null;
}

// pdfjs-dist legacy ESM — loaded once via dynamic import
let _pdfjsPromise = null;
function getPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null);
  }
  return _pdfjsPromise;
}

const MAX_PAGE_WIDTH = 1200; // px — wide enough to read fine print on tax docs
const JPEG_QUALITY   = 0.90;
const MAX_PAGES      = 8;    // per-document limit

/**
 * Render a PDF buffer into an array of JPEG page images.
 * Returns: [{ pageNum, totalPages, base64, mediaType, width, height }]
 * Throws if canvas or pdfjs-dist is unavailable.
 */
async function renderPDFToImages(buffer, label) {
  const createCanvas = getCreateCanvas();
  if (!createCanvas) throw new Error('canvas native module not available');

  const pdfjs = await getPdfjs();
  if (!pdfjs || !pdfjs.getDocument) throw new Error('pdfjs-dist not available');

  const uint8 = new Uint8Array(buffer);
  const pdf   = await pdfjs.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  const pages    = [];

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const scale    = MAX_PAGE_WIDTH / viewport.width;
      const svp      = page.getViewport({ scale });

      const w = Math.round(svp.width);
      const h = Math.round(svp.height);

      const canvas = createCanvas(w, h);
      const ctx    = canvas.getContext('2d');

      // White background so transparent PDFs don't render black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      await page.render({ canvasContext: ctx, viewport: svp }).promise;

      const base64 = canvas.toBuffer('image/jpeg', { quality: JPEG_QUALITY })
                           .toString('base64');

      pages.push({ pageNum: i, totalPages: pdf.numPages, base64, mediaType: 'image/jpeg', width: w, height: h });
    } catch (pageErr) {
      console.warn(`  [render] ${label} page ${i} failed: ${pageErr.message}`);
    }
  }

  await pdf.destroy();
  return pages;
}

module.exports = { renderPDFToImages };
