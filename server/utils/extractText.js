const pdfParse = require('pdf-parse');

const MAX_CHARS_PER_DOC = 2000;
const MAX_TOTAL_CHARS = 8000;

async function extractRawText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || null;
  } catch {
    return null;
  }
}

// Lines that are pure IRS/form boilerplate and carry no financial data.
const BOILERPLATE = [
  /^form\s+\d/i,
  /^department of the treasury/i,
  /^internal revenue service/i,
  /^omb no/i,
  /^attach\s+(form|schedule)/i,
  /^see\s+instructions/i,
  /^for\s+privacy\s+act/i,
  /^paperwork\s+reduction/i,
  /^go\s+to\s+irs\.gov/i,
  /^do\s+not\s+(staple|file)/i,
  /^if\s+you\s+have\s+a\s+foreign/i,
  /^check\s+only\s+one\s+box/i,
  /^(single|married\s+filing\s+(jointly|separately)|qualifying|head of household)$/i,
  /^page\s+\d+\s*$/i,
  /^\d{1,3}\s*$/,          // lone line numbers
  /^[a-z]\.\s*$/i,          // lone "a." "b." labels
  /^\.\s*\.\s*\.\s*\.+/,   // dot leaders  ". . . . . . . ."
  /^-{5,}/,                 // horizontal rules
];

// Positive patterns for each doc type.
const PATTERNS = {
  taxReturn: [
    /adjusted\s+gross\s+income/i,
    /total\s+income/i,
    /wages[,\s]+salaries/i,
    /business\s+(income|loss|profit)/i,
    /schedule\s+[cef]\b/i,
    /gross\s+profit/i,
    /net\s+profit|net\s+loss/i,
    /depreciation/i,
    /rental\s+(income|loss)/i,
    /social\s+security\s+(benefits|income)/i,
    /pension|annuity/i,
    /taxable\s+income/i,
    /total\s+tax/i,
    /capital\s+gain/i,
    /ordinary\s+dividend/i,
    /self.employment\s+tax/i,
    /\bagi\b/i,
    /borrower|taxpayer/i,
    /\bssn\b.*\d{4}|\d{4}\s*\(last/i,   // SSN last 4
    /filing\s+status/i,
  ],
  paystub: [
    /gross\s+(pay|wages|earnings)/i,
    /net\s+pay/i,
    /ytd\s+(gross|earnings|pay)/i,
    /base\s+(pay|salary)/i,
    /overtime/i,
    /federal\s+(tax|withhold)/i,
    /state\s+(tax|withhold)/i,
    /social\s+security/i,
    /medicare/i,
    /pay\s+period|pay\s+date/i,
    /employer|employee/i,
    /deduction|benefit/i,
  ],
  bankStatement: [
    /beginning\s+balance|opening\s+balance/i,
    /ending\s+balance|closing\s+balance/i,
    /total\s+(deposits|withdrawals|credits|debits)/i,
    /direct\s+deposit/i,
    /account\s+(number|holder|type)/i,
    /statement\s+(period|date)/i,
    /available\s+balance/i,
    /overdraft/i,
  ],
  w2: [
    /wages.*tips.*compensation/i,
    /federal\s+income\s+tax\s+withheld/i,
    /social\s+security\s+wages/i,
    /medicare\s+wages/i,
    /employer.*identification/i,
    /employee.*social\s+security/i,
    /state\s+wages/i,
    /\bw.?2\b/i,
  ],
  general: [
    /income|earnings|wages|salary/i,
    /balance|asset|reserve/i,
    /debt|payment|loan|mortgage/i,
    /employer|employee|borrower/i,
    /purchase\s+price|loan\s+amount|property\s+value/i,
    /fico|credit\s+score/i,
  ],
};

// A dollar amount that looks like real money: $1,000+ or plain 1,000.00+
// Excludes form numbers like "1040", "8879", zip codes, phone numbers, etc.
const MONEY_RE = /(?:\$\s*)?(?:\d{1,3},){1,}\d{3}(?:\.\d{2})?|\$\s*\d{2,}(?:\.\d{2})?/;

function isBoilerplate(line) {
  return BOILERPLATE.some(re => re.test(line));
}

function selectPatterns(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('tax') || l.includes('1040') || l.includes('schedule')) return PATTERNS.taxReturn;
  if (l.includes('paystub') || l.includes('pay stub') || l.includes('pay_stub')) return PATTERNS.paystub;
  if (l.includes('bank') || l.includes('statement')) return PATTERNS.bankStatement;
  if (l.includes('w2') || l.includes('w-2')) return PATTERNS.w2;
  return PATTERNS.general;
}

function extractRelevantLines(rawText, label) {
  const patterns = selectPatterns(label);
  const lines = rawText.split('\n');
  const seen = new Set();
  const out = [];

  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t || t.length < 3) continue;
    if (isBoilerplate(t)) continue;
    if (seen.has(t)) continue;

    const hasKeyword = patterns.some(re => re.test(t));
    const hasMoney = MONEY_RE.test(t);

    // Keep lines that pair a known keyword with a dollar figure,
    // or that are exclusively a labelled dollar amount (short line + money).
    if ((hasKeyword && hasMoney) || (hasMoney && t.length < 80)) {
      seen.add(t);
      out.push(t);
    } else if (hasKeyword && !hasMoney && t.length < 100) {
      // Keyword-only lines (e.g. borrower name, filing status) kept if short
      seen.add(t);
      out.push(t);
    }
  }

  return out.join('\n');
}

function hardTruncate(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + `\n[+${text.length - max} chars truncated]`;
}

async function processFile(file) {
  if (file.mimetype !== 'application/pdf') {
    return { ...file, extractedText: null };
  }

  const raw = await extractRawText(file.buffer);
  if (!raw) {
    return { ...file, extractedText: null, parseError: true };
  }

  const relevant = extractRelevantLines(raw, file.label);
  // If the keyword filter pulled almost nothing, fall back to a raw head-slice
  const base = relevant.length > 100 ? relevant : raw.replace(/\s{2,}/g, ' ').trim();
  const finalText = hardTruncate(base, MAX_CHARS_PER_DOC);

  return { ...file, extractedText: finalText };
}

module.exports = { processFile, MAX_CHARS_PER_DOC, MAX_TOTAL_CHARS };
