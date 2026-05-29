'use strict';

const express = require('express');
const multer  = require('multer');
const { analyzeDocuments }  = require('../utils/claude');
const { renderPDFToImages } = require('../utils/pdfRenderer');

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
        try {
          const pages = await renderPDFToImages(file.buffer, label);
          if (!pages.length) throw new Error('no pages rendered');
          console.log(`  [pdf] ${label} "${name}": ${pages.length} page(s)`);
          files.push({ originalname: name, label, type: 'pages', pages });
        } catch (err) {
          console.warn(`  [pdf-fail] ${label} "${name}": ${err.message}`);
          files.push({ originalname: name, label, type: 'error', message: 'PDF could not be rendered — may be encrypted or corrupt. Please re-submit as an image or unlocked PDF.' });
        }
      } else {
        const mediaType = file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';
        files.push({ originalname: name, label, type: 'image', base64: file.buffer.toString('base64'), mediaType });
        console.log(`  [image] ${label} "${name}": ${(file.size / 1024).toFixed(0)}KB`);
      }
    }

    const pageDocs  = files.filter(f => f.type === 'pages');
    const imageDocs = files.filter(f => f.type === 'image');
    const errorDocs = files.filter(f => f.type === 'error');
    const totalPages = pageDocs.reduce((n, d) => n + d.pages.length, 0);
    console.log(
      `TOTAL: ${files.length} doc(s) — ${pageDocs.length} pdf (${totalPages} pages), ` +
      `${imageDocs.length} image, ${errorDocs.length} error — ` +
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
