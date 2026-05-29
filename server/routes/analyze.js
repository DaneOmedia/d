'use strict';

const express = require('express');
const multer  = require('multer');
const pdfParse = require('pdf-parse');
const { analyzeDocuments }  = require('../utils/claude');
const { renderPDFToImages } = require('../utils/pdfRenderer');
const { ocrPDF }            = require('../utils/ocrPdf');

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

const MAX_TOTAL_PAGES   = 10;
const TEXT_CHAR_CAP     = 15000;
const MIN_TEXT_CHARS    = 500;
const MIN_OCR_CHARS     = 200;

async function processPDF(file) {
  const { originalname, label, buffer } = file;

  // 1. Try pdf-parse (text-based PDFs)
  try {
    const data = await pdfParse(buffer, { max: 0 });
    const text = (data.text || '').trim();
    if (text.length >= MIN_TEXT_CHARS) {
      console.log(`  [pdf-parse] ${label} "${originalname}": ${text.length} chars`);
      return { originalname, label, type: 'text', text: text.slice(0, TEXT_CHAR_CAP) };
    }
    console.log(`  [pdf-parse] ${label} "${originalname}": only ${text.length} chars — likely scanned`);
  } catch (err) {
    console.warn(`  [pdf-parse-fail] ${label} "${originalname}": ${err.message}`);
  }

  // 2. Try OCR via pdf2pic + tesseract.js
  try {
    const ocrText = await ocrPDF(buffer, 6);
    if (ocrText.length >= MIN_OCR_CHARS) {
      console.log(`  [ocr] ${label} "${originalname}": ${ocrText.length} chars`);
      return { originalname, label, type: 'text', text: ocrText.slice(0, TEXT_CHAR_CAP) };
    }
    console.log(`  [ocr] ${label} "${originalname}": only ${ocrText.length} chars — falling back to vision`);
  } catch (err) {
    console.warn(`  [ocr-fail] ${label} "${originalname}": ${err.message} — falling back to vision`);
  }

  // 3. Try vision (pdfjs-dist → canvas → base64 images)
  try {
    const pages = await renderPDFToImages(buffer, label);
    if (pages.length) {
      console.log(`  [vision] ${label} "${originalname}": ${pages.length} page(s)`);
      return { originalname, label, type: 'pages', pages };
    }
  } catch (err) {
    console.warn(`  [vision-fail] ${label} "${originalname}": ${err.message}`);
  }

  // 4. Unreadable
  console.warn(`  [error] ${label} "${originalname}": all extraction methods failed`);
  return { originalname, label, type: 'error', message: 'Document could not be read — may be encrypted or corrupt. Please re-submit.' };
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

    const rawFiles = req.files.map((file, idx) => ({
      originalname: file.originalname,
      mimetype:     file.mimetype,
      size:         file.size,
      label:        labelMap[idx] || 'Other',
      buffer:       file.buffer,
    }));

    // Process each file through the cascade
    const processed = [];
    for (const file of rawFiles) {
      if (file.mimetype === 'application/pdf') {
        processed.push(await processPDF(file));
      } else {
        const mediaType = file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';
        processed.push({ originalname: file.originalname, label: file.label, type: 'image', base64: file.buffer.toString('base64'), mediaType });
        console.log(`  [image] ${file.label} "${file.originalname}": ${(file.size / 1024).toFixed(0)}KB`);
      }
    }

    // Enforce global 10-page cap across all vision docs
    let totalPages = 0;
    const files = processed.map(doc => {
      if (doc.type !== 'pages') return doc;
      const remaining = MAX_TOTAL_PAGES - totalPages;
      if (remaining <= 0) {
        console.log(`  [budget] ${doc.label} "${doc.originalname}" — skipped, page budget exhausted`);
        return { ...doc, pages: [] };
      }
      const pages = doc.pages.slice(0, remaining);
      totalPages += pages.length;
      return { ...doc, pages };
    });

    const pageDocs  = files.filter(f => f.type === 'pages' && f.pages.length > 0);
    const textDocs  = files.filter(f => f.type === 'text');
    const imageDocs = files.filter(f => f.type === 'image');
    const errorDocs = files.filter(f => f.type === 'error');
    console.log(
      `TOTAL: ${files.length} doc(s) — ${pageDocs.length} vision (${totalPages} pages), ` +
      `${textDocs.length} text, ${imageDocs.length} image, ${errorDocs.length} error — ` +
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
