const express = require('express');
const multer = require('multer');
const { analyzeDocuments } = require('../utils/claude');
const { processFile, MAX_TOTAL_CHARS } = require('../utils/extractText');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024, files: 15 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    if (!decoded.startsWith('auth:')) throw new Error('invalid');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
}

router.post('/', requireAuth, upload.array('files', 15), async (req, res) => {
  try {
    const { loanType, loanPurpose, occupancy, labels } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    if (!loanType || !loanPurpose || !occupancy) {
      return res.status(400).json({ error: 'Loan type, purpose, and occupancy are required' });
    }

    let labelMap = {};
    try { labelMap = labels ? JSON.parse(labels) : {}; } catch { /* ignore */ }

    // Attach label + buffer to each multer file
    const rawFiles = req.files.map((file, idx) => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      label: labelMap[idx] || 'Other',
      buffer: file.buffer,
    }));

    // Extract text from PDFs; pass images through
    const processed = await Promise.all(rawFiles.map(processFile));

    // Enforce total character budget across all PDF text
    let totalChars = 0;
    const files = processed.map(f => {
      if (!f.extractedText) {
        // Image — convert to base64 for Claude vision
        return {
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          label: f.label,
          imageData: f.buffer.toString('base64'),
          extractedText: null,
          parseError: f.parseError || false,
        };
      }
      const remaining = MAX_TOTAL_CHARS - totalChars;
      const text = remaining > 0 ? f.extractedText.slice(0, remaining) : '';
      totalChars += text.length;
      return {
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        label: f.label,
        extractedText: text,
        imageData: null,
        parseError: false,
      };
    });

    const textDocs = files.filter(f => f.extractedText).length;
    const imageDocs = files.filter(f => f.imageData).length;
    const failedDocs = files.filter(f => f.parseError).length;
    console.log(
      `Analyzing ${files.length} doc(s) [${textDocs} text, ${imageDocs} image, ${failedDocs} parse-failed]` +
      ` — ${loanType} ${loanPurpose} ${occupancy} — ~${totalChars} chars`
    );

    const result = await analyzeDocuments({ files, loanType, loanPurpose, occupancy });
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err.message);
    if (err.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(500).json({ error: 'API key not configured. Check your .env file.' });
    }
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
