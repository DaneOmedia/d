'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

async function ocrPDF(buffer, maxPages = 6) {
  const { fromBuffer } = await import('pdf2pic');
  const { createWorker } = require('tesseract.js');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));

  let pages = [];
  try {
    const convert = fromBuffer(buffer, {
      density:  200,
      format:   'png',
      width:    1700,
      height:   2200,
      savePath: tmpDir,
    });

    const results = await convert.bulk(maxPages, { responseType: 'buffer' });
    pages = results.filter(r => r && r.buffer);
  } catch (err) {
    cleanup(tmpDir);
    throw new Error(`pdf2pic failed: ${err.message}`);
  }

  if (!pages.length) {
    cleanup(tmpDir);
    return '';
  }

  const worker = await createWorker('eng', 1, { logger: () => {} });
  const texts = [];
  try {
    for (const page of pages) {
      const { data } = await worker.recognize(page.buffer);
      if (data && data.text) texts.push(data.text.trim());
    }
  } finally {
    await worker.terminate();
    cleanup(tmpDir);
  }

  return texts.join('\n\n');
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

module.exports = { ocrPDF };
