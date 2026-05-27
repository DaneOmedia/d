const express = require('express');
const multer = require('multer');
const { analyzeDocuments } = require('../utils/claude');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Simple token check middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  // Validate it's a base64 string starting with "auth:"
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    if (!decoded.startsWith('auth:')) throw new Error('invalid');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
}

router.post('/', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const { loanType, loanPurpose, occupancy, labels } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!loanType || !loanPurpose || !occupancy) {
      return res.status(400).json({ error: 'Loan type, purpose, and occupancy are required' });
    }

    // Parse labels (JSON string from formData)
    let labelMap = {};
    try {
      labelMap = labels ? JSON.parse(labels) : {};
    } catch {
      labelMap = {};
    }

    // Attach base64 data to each file
    const files = req.files.map((file, idx) => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      label: labelMap[idx] || 'Other',
      data: file.buffer.toString('base64'),
    }));

    console.log(`Analyzing ${files.length} document(s) — ${loanType} ${loanPurpose} ${occupancy}`);

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
