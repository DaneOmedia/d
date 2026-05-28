'use strict';

const express = require('express');
const multer  = require('multer');
const { analyzeDocuments } = require('../utils/claude');
const { renderPDFToImages } = require('../utils/pdfRenderer');
const { processFile }       = require('../utils/extractText');

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

const MAX_TOTAL_PAGES = 10;

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

    // Process each file: render PDFs to images; pass JPG/PNG through as-is
    const processed = [];
    for (const file of rawFiles) {
      if (file.mimetype === 'application/pdf') {
        try {
          const pages = await renderPDFToImages(file.buffer, file.label);
          if (!pages.length) throw new Error('no pages rendered');
          console.log(`  [render] ${file.label} "${file.originalname}": ${pages.length} page(s)`);
          processed.push({ originalname: file.originalname, label: file.label, type: 'pages', pages });
        } catch (renderErr) {
          console.warn(`  [render-fail] ${file.label} "${file.originalname}": ${renderErr.message} — falling back to text`);
          try {
            const fallback = await processFile(file);
            if (fallback.extractedText) {
              console.log(`  [text-fallback] ${file.label} "${file.originalname}": ${fallback.extractedText.length} chars`);
              processed.push({ originalname: file.originalname, label: file.label, type: 'text', text: fallback.extractedText });
            } else {
              processed.push({ originalname: file.originalname, label: file.label, type: 'error', message: 'PDF could not be rendered or extracted — may be scanned or encrypted.' });
            }
          } catch {
            processed.push({ originalname: file.originalname, label: file.label, type: 'error', message: 'PDF could not be processed.' });
          }
        }
      } else {
        // JPG / PNG — send directly as image
        const mediaType = file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';
        processed.push({ originalname: file.originalname, label: file.label, type: 'image', base64: file.buffer.toString('base64'), mediaType });
        console.log(`  [image] ${file.label} "${file.originalname}": ${(file.size / 1024).toFixed(0)}KB`);
      }
    }

    // Enforce global 10-page cap across all rendered PDFs
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
      `TOTAL: ${files.length} doc(s) — ${pageDocs.length} rendered (${totalPages} pages), ` +
      `${textDocs.length} text-fallback, ${imageDocs.length} image, ${errorDocs.length} error — ` +
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
