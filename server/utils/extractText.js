const pdfParse = require('pdf-parse');

const MAX_CHARS_PER_DOC = 2000;
const MAX_TAX_CHARS = 1500;   // tighter cap for tax returns
const MAX_TOTAL_CHARS = 8000;

// ─── Raw text extraction ──────────────────────────────────────────────────────

async function extractRawText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || null;
  } catch {
    return null;
  }
}

// ─── Dollar-amount finder ─────────────────────────────────────────────────────
// Matches IRS format "97,500 00", "$97,500.00", "97,500.00", bare "97,500",
// or prefixed amounts like "$450" / "450.00" (Schedule B small figures).
const MONEY_RE = /\$\s*\d[\d,]*(?:\.\d{2})?|(?:\d{1,3},)+\d{3}(?:[.\s]\d{2})?/g;

function firstMoney(text) {
  const m = text.match(MONEY_RE);
  if (!m) return null;
  // Normalise: strip trailing " 00" IRS cents and whitespace
  return m[0].replace(/\s+\d{2}$/, '').replace(/\s+/g, '').trim();
}

// Search `raw` for `pattern`, then find the first dollar amount in the
// `windowSize` chars that follow the match.  Returns "LABEL: $amount" or null.
function findField(raw, label, pattern, windowSize = 300) {
  const m = pattern.exec(raw);
  if (!m) return null;
  const window = raw.slice(m.index, m.index + windowSize);
  const amount = firstMoney(window);
  return amount ? `${label}: ${amount}` : null;
}

// ─── Tax return surgical extractor ───────────────────────────────────────────

// Ordered list of fields to pull from 1040, Schedules C/E/B, and W-2s.
// `pattern` is matched against the full raw text string (not split by line).
const TAX_FIELDS = [
  // 1040 Page 1-2
  { label: '1040 L1a  Wages/W2',         pattern: /wages[,\s]+salaries[,\s]+tips/i },
  { label: '1040 L8   Business Income',   pattern: /business\s+income\s+or\s+loss/i },
  { label: '1040 L9   Total Income',      pattern: /total\s+income\b(?!\s+tax)/i },
  { label: '1040 L11  AGI',              pattern: /adjusted\s+gross\s+income/i },
  { label: '1040 L15  Taxable Income',   pattern: /taxable\s+income/i },
  { label: '1040 L24  Total Tax',        pattern: /total\s+tax\b/i },
  // Schedule C
  { label: 'Sch C L1  Gross Receipts',   pattern: /gross\s+receipts\s+or\s+sales/i },
  { label: 'Sch C L13 Depreciation',     pattern: /depreciation\s+and\s+section\s+179/i },
  { label: 'Sch C L31 Net Profit\/Loss', pattern: /net\s+profit\s+or\s+(?:\()?loss/i },
  // Schedule E
  { label: 'Sch E     Rental Income',    pattern: /total\s+(?:rental\s+)?income\b.*(?:schedule\s+e|real\s+estate)/i },
  { label: 'Sch E     Rental Loss',      pattern: /total\s+(?:rental\s+)?loss\b.*(?:schedule\s+e|real\s+estate)/i },
  // Schedule B — narrow window (100 chars) so we don't bleed into W-2 section
  { label: 'Sch B     Ordinary Divs',    pattern: /total\s+ordinary\s+dividends/i,  window: 100 },
  { label: 'Sch B     Interest',         pattern: /total\s+(?:taxable\s+)?interest/i, window: 100 },
];

// Schedule E income/loss often appears differently — try alternate patterns
const SCH_E_ALTS = [
  /income\s+or\s+loss\s+from\s+rental/i,
  /rental\s+real\s+estate.*income/i,
  /26\s+total\s+(?:income|losses)/i,
];

// W-2 Box 1 extractor: finds each W-2 block and pulls employer + Box 1 wages
function extractW2s(raw) {
  const results = [];
  // Find all occurrences of "Box 1" or "1 Wages, tips" style markers
  const box1Re = /(?:box\s*1\b|(?:^|\n)\s*1\s+wages[,\s]+tips)/gi;
  let m;
  // Reset lastIndex since we may reuse
  box1Re.lastIndex = 0;
  while ((m = box1Re.exec(raw)) !== null) {
    const window = raw.slice(m.index, m.index + 200);
    const amount = firstMoney(window);
    if (!amount) continue;

    // Look backwards up to 400 chars for employer name
    const before = raw.slice(Math.max(0, m.index - 400), m.index);
    const empMatch = before.match(/employer['s\s]+name[,\s]+address[^\n]*\n([^\n]{2,60})/i)
      || before.match(/c\s+employer['s\s]+name[^\n]*\n([^\n]{2,60})/i);
    const employer = empMatch ? empMatch[1].trim() : 'Employer';
    results.push(`W-2 Box1 Wages (${employer}): ${amount}`);
    if (results.length >= 4) break; // cap at 4 W-2s
  }
  return results;
}

function extractBorrowerInfo(raw) {
  const lines = [];

  // Name: first non-boilerplate line in doc that looks like a person name
  // [^\S\n]+ matches spaces/tabs but not newlines — prevents multi-line bleed
  const nameM = raw.match(
    /(?:your\s+first\s+name[^\n]*\n|taxpayer\s+name[^\n]*\n)([A-Z][a-zA-Z '-]{1,30}(?:[^\S\n]+[A-Z][a-zA-Z '-]{1,30}){0,4})/i
  );
  if (nameM) lines.push(`Borrower Name: ${nameM[1].trim()}`);

  // SSN last 4
  const ssnM = raw.match(/\b\d{3}-\d{2}-(\d{4})\b/);
  if (ssnM) lines.push(`SSN Last 4: ${ssnM[1]}`);

  // Filing status — whichever checked-box text appears first
  const statusM = raw.match(
    /\b(Single|Married\s+filing\s+jointly|Married\s+filing\s+separately|Qualifying\s+surviving\s+spouse|Head\s+of\s+household)\b/i
  );
  if (statusM) lines.push(`Filing Status: ${statusM[1]}`);

  // Tax year
  const yearM = raw.match(/\b(20\d{2})\b/);
  if (yearM) lines.push(`Tax Year: ${yearM[1]}`);

  return lines;
}

function extractTaxReturn(raw) {
  const lines = [];

  // Borrower identity block
  lines.push(...extractBorrowerInfo(raw));

  // Primary 1040 / Schedule fields
  for (const field of TAX_FIELDS) {
    field.pattern.lastIndex = 0;
    const result = findField(raw, field.label, field.pattern, field.window);
    if (result) lines.push(result);
  }

  // Schedule E fallback — try alt patterns if primary didn't match
  if (!lines.some(l => l.startsWith('Sch E'))) {
    for (const alt of SCH_E_ALTS) {
      const result = findField(raw, 'Sch E Rental Income/Loss', alt);
      if (result) { lines.push(result); break; }
    }
  }

  // W-2 boxes
  lines.push(...extractW2s(raw));

  return lines.filter(Boolean).join('\n');
}

// ─── General financial line extractor (non-tax docs) ─────────────────────────

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
  /^page\s+\d+\s*$/i,
  /^\d{1,3}\s*$/,
  /^[a-z]\.\s*$/i,
  /^\.\s*\.\s*\.\s*\.+/,
  /^-{5,}/,
];

const PATTERNS = {
  paystub: [
    /gross\s+(pay|wages|earnings)/i, /net\s+pay/i, /ytd\s+(gross|earnings|pay)/i,
    /base\s+(pay|salary)/i, /overtime/i, /federal\s+(tax|withhold)/i,
    /state\s+(tax|withhold)/i, /pay\s+period|pay\s+date/i, /employer|employee/i,
  ],
  bankStatement: [
    /beginning\s+balance|opening\s+balance/i, /ending\s+balance|closing\s+balance/i,
    /total\s+(deposits|withdrawals|credits|debits)/i, /direct\s+deposit/i,
    /account\s+(number|holder|type)/i, /statement\s+(period|date)/i, /available\s+balance/i,
  ],
  w2: [
    /wages.*tips.*compensation/i, /federal\s+income\s+tax\s+withheld/i,
    /social\s+security\s+wages/i, /medicare\s+wages/i,
    /employer.*identification/i, /state\s+wages/i,
  ],
  general: [
    /income|earnings|wages|salary/i, /balance|asset|reserve/i,
    /debt|payment|loan|mortgage/i, /employer|employee|borrower/i,
    /purchase\s+price|loan\s+amount|property\s+value/i, /fico|credit\s+score/i,
  ],
};

function selectPatterns(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('paystub') || l.includes('pay stub')) return PATTERNS.paystub;
  if (l.includes('bank') || l.includes('statement')) return PATTERNS.bankStatement;
  if (l.includes('w2') || l.includes('w-2')) return PATTERNS.w2;
  return PATTERNS.general;
}

function extractGeneralLines(rawText, label) {
  const patterns = selectPatterns(label);
  const lines = rawText.split('\n');
  const seen = new Set();
  const out = [];

  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t || t.length < 3) continue;
    if (BOILERPLATE.some(re => re.test(t))) continue;
    if (seen.has(t)) continue;
    const hasKeyword = patterns.some(re => re.test(t));
    const hasMoney = MONEY_RE.test(t);
    if ((hasKeyword && hasMoney) || (hasMoney && t.length < 80)) {
      seen.add(t); out.push(t);
    } else if (hasKeyword && t.length < 100) {
      seen.add(t); out.push(t);
    }
  }
  return out.join('\n');
}

// ─── Label detector ───────────────────────────────────────────────────────────

function isTaxReturn(label, rawText) {
  const l = (label || '').toLowerCase();
  if (l.includes('tax') || l.includes('1040') || l.includes('schedule')) return true;
  // Auto-detect from content if label is generic
  return /form\s+1040|u\.s\.\s+individual\s+income\s+tax/i.test(rawText.slice(0, 2000));
}

// ─── Hard truncate ────────────────────────────────────────────────────────────

function hardTruncate(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + `\n[+${text.length - max} chars truncated]`;
}

// ─── Public entry point ───────────────────────────────────────────────────────

async function processFile(file) {
  if (file.mimetype !== 'application/pdf') {
    return { ...file, extractedText: null };
  }

  const raw = await extractRawText(file.buffer);
  if (!raw) {
    return { ...file, extractedText: null, parseError: true };
  }

  let extracted;
  let cap;

  if (isTaxReturn(file.label, raw)) {
    extracted = extractTaxReturn(raw);
    cap = MAX_TAX_CHARS;
  } else {
    extracted = extractGeneralLines(raw, file.label);
    cap = MAX_CHARS_PER_DOC;
  }

  // Fallback: if extraction found almost nothing, head-slice the raw text
  const base = extracted.length > 80 ? extracted : raw.replace(/\s{2,}/g, ' ').trim();
  const finalText = hardTruncate(base, cap);

  return { ...file, extractedText: finalText };
}

module.exports = { processFile, MAX_CHARS_PER_DOC, MAX_TAX_CHARS, MAX_TOTAL_CHARS };
