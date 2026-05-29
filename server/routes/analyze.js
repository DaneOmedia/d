'use strict';

const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const { analyzeDocuments } = require('../utils/claude');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 15 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = Buffer.from(auth.slice(7), 'base64').toString('utf8');
    if (!decoded.startsWith('auth:')) throw new Error('invalid');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
}

const MIN_TEXT_CHARS = 500;

async function pdfVisionFallback(buffer, numpages, label) {
  const { fromBuffer } = await import('pdf2pic');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf2pic-'));
  try {
    const convert = fromBuffer(buffer, {
      density:      200,
      saveFilename: 'page',
      savePath:     tmpDir,
      format:       'jpeg',
      width:        1700,
      height:       2200,
    });

    const isTaxReturn = /tax\s*return|1040/i.test(label || '');
    const startPage   = 1;                                            // always start from page 1
    const endPage     = isTaxReturn ? Math.min(20, numpages) : Math.min(12, numpages);
    const pages       = [];

    for (let p = startPage; p <= endPage; p++) {
      try {
        const result = await convert(p, { responseType: 'base64' });
        if (result && result.base64) {
          pages.push({ pageNum: p, totalPages: numpages, base64: result.base64, mediaType: 'image/jpeg' });
        }
      } catch {
        break; // page doesn't exist — stop
      }
    }
    return pages;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

router.post('/', requireAuth, upload.array('files', 15), async (req, res) => {
  try {
    const { loanType, loanPurpose, occupancy, labels } = req.body;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded' });
    if (!loanType || !loanPurpose || !occupancy)
      return res.status(400).json({ error: 'Loan type, purpose, and occupancy are required' });

    let labelMap = {};
    try { labelMap = labels ? JSON.parse(labels) : {}; } catch { /* ignore */ }

    const files = [];

    for (let idx = 0; idx < req.files.length; idx++) {
      const file  = req.files[idx];
      const label = labelMap[idx] || 'Other';
      const name  = file.originalname;

      if (file.mimetype === 'application/pdf') {
        // Step 1: try pdf-parse for text-based PDFs
        let parsed = null;
        try {
          parsed = await pdfParse(file.buffer, { max: 0 });
        } catch (err) {
          console.warn(`  [pdf-parse-fail] ${label} "${name}": ${err.message}`);
        }

        const text     = ((parsed && parsed.text) || '').trim();
        const numpages = (parsed && parsed.numpages) || 1;

        if (text.length >= MIN_TEXT_CHARS) {
          console.log(`  [pdf-text] ${label} "${name}": ${numpages} pages, ${text.length} chars`);
          files.push({ originalname: name, label, type: 'text', text });
        } else {
          // Step 2: image-based PDF — use pdf2pic vision
          const isTaxReturn = /tax\s*return|1040/i.test(label);
          const vEnd = isTaxReturn ? Math.min(20, numpages) : Math.min(12, numpages);
          console.log(`  [pdf-scan] ${label} "${name}": ${text.length} chars — using vision (pages 1–${vEnd})`);
          try {
            const pages = await pdfVisionFallback(file.buffer, numpages, label);
            if (pages.length === 0) throw new Error('no pages converted');
            console.log(`  [pdf-vision] ${label} "${name}": ${pages.length} page image(s)`);
            files.push({ originalname: name, label, type: 'pages', pages });
          } catch (vErr) {
            console.warn(`  [pdf-vision-fail] ${label} "${name}": ${vErr.message}`);
            files.push({ originalname: name, label, type: 'error', message: `PDF is image-based and could not be converted — re-submit as a flattened or text-based PDF: ${vErr.message}` });
          }
        }
      } else {
        // JPG / PNG — send directly as image
        const mediaType = file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';
        files.push({ originalname: name, label, type: 'image', base64: file.buffer.toString('base64'), mediaType });
        console.log(`  [image] ${label} "${name}": ${(file.size / 1024).toFixed(0)}KB`);
      }
    }

    const textDocs   = files.filter(f => f.type === 'text');
    const visionDocs = files.filter(f => f.type === 'pages');
    const imageDocs  = files.filter(f => f.type === 'image');
    const errorDocs  = files.filter(f => f.type === 'error');
    const totalChars = textDocs.reduce((n, d) => n + d.text.length, 0);
    const totalPages = visionDocs.reduce((n, d) => n + d.pages.length, 0);
    console.log(
      `TOTAL: ${files.length} doc(s) — ${textDocs.length} text (${totalChars} chars), ` +
      `${visionDocs.length} vision (${totalPages} pages), ${imageDocs.length} image, ${errorDocs.length} error — ` +
      `${loanType} ${loanPurpose} ${occupancy}`
    );

    const result = await analyzeDocuments({ files, loanType, loanPurpose, occupancy });
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err.message);
    if (err.message.includes('ANTHROPIC_API_KEY'))
      return res.status(500).json({ error: 'API key not configured. Check your .env file.' });
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
