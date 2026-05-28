const pdfParse = require('pdf-parse');

const MAX_CHARS_PER_DOC = 5000;
const MAX_TOTAL_CHARS = 25000;

async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text
      .replace(/\s{3,}/g, '\n')   // collapse excessive whitespace
      .replace(/\n{4,}/g, '\n\n') // collapse excessive blank lines
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + `\n...[${text.length - max} additional characters truncated]`;
}

// Pull a compact financial summary from raw extracted text.
// Looks for lines containing dollar amounts and key mortgage terms,
// keeps them plus surrounding context, and deduplicates.
function summarizeFinancialText(text, label) {
  if (!text) return '';

  const lines = text.split('\n');
  const relevant = new Set();

  const keywords = [
    // income
    /wages|salary|income|earnings|gross|net|taxable|agi|adjusted gross/i,
    // assets/bank
    /balance|deposit|withdraw|account|savings|checking|asset|reserve/i,
    // debts
    /payment|debt|loan|mortgage|minimum|owe|balance|credit card|auto|student/i,
    // property/loan
    /property|purchase price|appraised|loan amount|ltv|down payment/i,
    // identifiers
    /borrower|employer|employer.*name|ssn|social security/i,
    // amounts — any line with a dollar figure
    /\$[\d,]+|\b\d{1,3}(,\d{3})+(\.\d{2})?\b/,
  ];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (keywords.some(re => re.test(trimmed))) {
      // include the matched line plus one line of context either side
      if (i > 0 && lines[i - 1].trim()) relevant.add(lines[i - 1].trim());
      relevant.add(trimmed);
      if (i < lines.length - 1 && lines[i + 1].trim()) relevant.add(lines[i + 1].trim());
    }
  });

  const summary = [...relevant].join('\n');
  // Fall back to raw truncated text if keyword scan found very little
  return summary.length > 200 ? summary : text;
}

async function processFile(file) {
  const isPDF = file.mimetype === 'application/pdf';

  if (isPDF) {
    const raw = await extractTextFromPDF(file.buffer);
    if (raw) {
      const summarized = summarizeFinancialText(raw, file.label);
      const finalText = truncate(summarized, MAX_CHARS_PER_DOC);
      return { ...file, extractedText: finalText, charCount: finalText.length };
    }
    // PDF parse failed (scanned/encrypted) — note it
    return { ...file, extractedText: null, parseError: true };
  }

  // Images passed through as-is (base64 for Claude vision)
  return { ...file, extractedText: null };
}

module.exports = { processFile, MAX_CHARS_PER_DOC, MAX_TOTAL_CHARS };
