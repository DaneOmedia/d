'use strict';

const express    = require('express');
const multer     = require('multer');
const pdfParse   = require('pdf-parse');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const { execFile } = require('child_process');
const sharp = require('sharp');
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
const MAX_PAGES_PER_DOC = 25;
const MAX_VISION_PAGES_TOTAL = 40;

async function pdfToImages(buffer, pageCount, label) {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-pdf-'));
  const pdfPath = path.join(tmpDir, 'source.pdf');
  const outPattern = path.join(tmpDir, 'page-%d.jpg');

  fs.writeFileSync(pdfPath, buffer);

  const numPages = Math.min(pageCount || 25, MAX_PAGES_PER_DOC);

  return new Promise((resolve, reject) => {
    const args = [
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-sDEVICE=jpeg',
      '-r200',
      '-dJPEGQ=85',
      `-dFirstPage=1`,
      `-dLastPage=${numPages}`,
      `-sOutputFile=${outPattern}`,
      pdfPath,
    ];

    execFile('gs', args, { timeout: 60000 }, (err) => {
      if (err) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        return reject(err);
      }

      const rawPaths = [];
      for (let p = 1; p <= numPages; p++) {
        const imgPath = path.join(tmpDir, `page-${p}.jpg`);
        if (!fs.existsSync(imgPath)) break;
        rawPaths.push({ p, imgPath });
      }

      Promise.all(rawPaths.map(async ({ p, imgPath }) => {
        const raw = fs.readFileSync(imgPath);
        const resized = await sharp(raw)
          .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const meta = await sharp(resized).metadata();
        return {
          pageNum: p,
          totalPages: pageCount,
          base64: resized.toString('base64'),
          mediaType: 'image/jpeg',
          width: meta.width,
          height: meta.height,
        };
      }))
        .then((pages) => {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          resolve(pages);
        })
        .catch((resizeErr) => {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          reject(resizeErr);
        });
    });
  });
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
    let totalVisionPages = 0;

    for (let idx = 0; idx < req.files.length; idx++) {
      const file  = req.files[idx];
      const label = labelMap[idx] || 'Other';
      const name  = file.originalname;

      if (file.mimetype === 'application/pdf') {
        let text = '';
        let numpages = 1;
        try {
          const parsed = await pdfParse(file.buffer, { max: 0 });
          text     = (parsed.text || '').trim();
          numpages = parsed.numpages || 1;
        } catch (err) {
          console.warn(`  [pdf-parse-fail] "${name}": ${err.message}`);
        }

        if (text.length >= MIN_TEXT_CHARS) {
          console.log(`  [text] "${name}" [${label}]: ${numpages} pages, ${text.length} chars`);
          files.push({ originalname: name, label, type: 'text', text });
        } else {
          const visionSlots = MAX_VISION_PAGES_TOTAL - totalVisionPages;
          if (visionSlots <= 0) {
            console.warn(`  [vision-skip] "${name}" [${label}]: vision page cap reached (${MAX_VISION_PAGES_TOTAL})`);
            files.push({ originalname: name, label, type: 'error', message: 'Vision page limit reached — resubmit without other image-based PDFs.' });
            continue;
          }

          const docCap = Math.min(MAX_PAGES_PER_DOC, numpages || MAX_PAGES_PER_DOC, visionSlots);
          console.log(`  [vision] "${name}" [${label}]: ${text.length} chars text — converting up to ${docCap} pages with Ghostscript`);

          try {
            const pages = await pdfToImages(file.buffer, docCap, label);
            if (pages.length === 0) throw new Error('Ghostscript produced no images');
            totalVisionPages += pages.length;
            const dimStr = pages.map(pg => `p${pg.pageNum}:${pg.width}x${pg.height}`).join(', ');
            console.log(`  [vision-done] "${name}" [${label}]: ${pages.length} page(s) — ${dimStr}`);
            files.push({ originalname: name, label, type: 'pages', pages });
          } catch (vErr) {
            console.warn(`  [vision-fail] "${name}" [${label}]: ${vErr.message}`);
            files.push({ originalname: name, label, type: 'error', message: `PDF is image-based and could not be converted: ${vErr.message}` });
          }
        }
      } else {
        const mediaType = file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';
        files.push({ originalname: name, label, type: 'image', base64: file.buffer.toString('base64'), mediaType });
        console.log(`  [image] "${name}" [${label}]: ${(file.size / 1024).toFixed(0)}KB`);
      }
    }

    const textDocs   = files.filter(f => f.type === 'text');
    const visionDocs = files.filter(f => f.type === 'pages');
    const imageDocs  = files.filter(f => f.type === 'image');
    const errorDocs  = files.filter(f => f.type === 'error');

    const totalChars    = textDocs.reduce((n, d) => n + d.text.length, 0);
    const totalPages    = visionDocs.reduce((n, d) => n + d.pages.length, 0);
    const totalImages   = totalPages + imageDocs.length;
    const estVisionCost = (totalPages * 0.006).toFixed(3);
    const estTextCost   = ((totalChars / 1000) * 0.003).toFixed(3);

    console.log(
      `ANALYSIS: ${files.length} doc(s) — ` +
      `${textDocs.length} text (${totalChars} chars, ~$${estTextCost}), ` +
      `${visionDocs.length} vision (${totalPages} pages, ~$${estVisionCost}), ` +
      `${imageDocs.length} image, ${errorDocs.length} error — ` +
      `TOTAL IMAGES TO API: ${totalImages} — ` +
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
