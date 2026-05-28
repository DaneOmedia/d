'use strict';

const pdfParse = require('pdf-parse');
const path = require('path');

const MAX_CHARS_PER_DOC = 3000;
const MAX_TAX_CHARS     = 1500;
const MAX_TOTAL_CHARS   = 15000;
const MIN_USEFUL_CHARS  = 200;

// ─── PDF extraction (pdf-parse primary, pdfjs-dist fallback) ─────────────────

async function extractWithPdfParse(buffer) {
  try {
    // max:0 = process all pages (default limits to 10)
    const data = await pdfParse(buffer, { max: 0 });
    return (data && data.text) ? data.text : null;
  } catch {
    return null;
  }
}

let _pdfjsPromise = null;
function getPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = import(
      path.join(
        path.dirname(require.resolve('pdf-parse')),
        '../../pdfjs-dist/legacy/build/pdf.mjs'
      )
    ).catch(() =>
      import(
        path.join(require.resolve('pdfjs-dist/package.json'), '../legacy/build/pdf.mjs')
      ).catch(() => null)
    );
  }
  return _pdfjsPromise;
}

async function extractWithPdfjs(buffer) {
  try {
    const pdfjs = await getPdfjs();
    if (!pdfjs || !pdfjs.getDocument) return null;

    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
    await pdf.destroy();
    return pages.join('\n') || null;
  } catch {
    return null;
  }
}

async function extractRawText(buffer, filename) {
  let raw = await extractWithPdfParse(buffer);
  const chars1 = raw ? raw.length : 0;

  if (!raw || raw.trim().length < MIN_USEFUL_CHARS) {
    console.log(`  [pdfjs fallback] ${filename} — pdf-parse got ${chars1} chars`);
    const fallback = await extractWithPdfjs(buffer);
    if (fallback && fallback.trim().length > chars1) {
      raw = fallback;
      console.log(`  [pdfjs fallback] got ${raw.length} chars`);
    }
  }

  if (!raw || raw.trim().length < 20) return null;
  return raw;
}

// ─── Dollar-amount finder ─────────────────────────────────────────────────────

// Matches IRS "97,500 00", "$97,500.00", "97,500.00", bare "97,500", "$450"
const MONEY_RE = /\$\s*\d[\d,]*(?:\.\d{2})?|(?:\d{1,3},)+\d{3}(?:[.\s]\d{2})?/g;

function firstMoney(text) {
  const m = text.match(MONEY_RE);
  if (!m) return null;
  return m[0].replace(/\s+\d{2}$/, '').replace(/\s+/g, '').trim();
}

function findField(raw, label, pattern, windowSize) {
  windowSize = windowSize || 300;
  pattern.lastIndex = 0;
  const m = pattern.exec(raw);
  if (!m) return null;
  const amount = firstMoney(raw.slice(m.index, m.index + windowSize));
  return amount ? `${label}: ${amount}` : null;
}

// ─── Document type auto-detection ────────────────────────────────────────────

const DOC_SIGNATURES = [
  { type: 'taxReturn',        re: /form\s+1040|u\.s\.\s+individual\s+income\s+tax|schedule\s+[cef]\b|adjusted\s+gross\s+income/i },
  { type: 'w2',               re: /wage\s+and\s+tax\s+statement|form\s+w.?2\b|employer.*identification.*number.*\n.*\d{2}-\d{7}/i },
  { type: 'paystub',          re: /earnings\s+statement|pay\s+stub|payroll|ytd\s+gross|pay\s+period\s+end/i },
  { type: 'bankStatement',    re: /account\s+summary|statement\s+period|beginning\s+balance|ending\s+balance|available\s+balance/i },
  { type: 'loanApp1003',      re: /uniform\s+residential\s+loan|urla|fannie\s+mae\s+form\s+1003|loan\s+application/i },
  { type: 'creditReport',     re: /credit\s+report|equifax|transunion|experian|fico\s+score|credit\s+bureau/i },
  { type: 'purchaseContract', re: /purchase\s+(and\s+sale\s+)?agreement|residential\s+purchase\s+contract|earnest\s+money|seller.*buyer.*property/i },
];

function detectDocType(label, rawHead) {
  const l = (label || '').toLowerCase();
  // Label overrides first
  if (/tax\s*return|1040|schedule\s*[cef]/i.test(l)) return 'taxReturn';
  if (/\bw.?2\b/.test(l)) return 'w2';
  if (/paystub|pay.stub|pay.slip|earnings/i.test(l)) return 'paystub';
  if (/bank|statement|checking|savings/i.test(l)) return 'bankStatement';
  if (/1003|loan.app|urla/i.test(l)) return 'loanApp1003';
  if (/credit.report|tri.merge/i.test(l)) return 'creditReport';
  if (/purchase|contract|psa|sale.agreement/i.test(l)) return 'purchaseContract';

  // Auto-detect from content
  for (const sig of DOC_SIGNATURES) {
    if (sig.re.test(rawHead)) return sig.type;
  }
  return 'general';
}

// ─── TAX RETURN extractor ─────────────────────────────────────────────────────

const TAX_FIELDS = [
  { label: '1040 L1a  Wages/W2',          pattern: /wages[,\s]+salaries[,\s]+tips/i },
  { label: '1040 L8   Business Income',    pattern: /business\s+income\s+or\s+loss/i },
  { label: '1040 L9   Total Income',       pattern: /total\s+income\b(?!\s+tax)/i },
  { label: '1040 L11  AGI',               pattern: /adjusted\s+gross\s+income/i },
  { label: '1040 L15  Taxable Income',    pattern: /taxable\s+income/i },
  { label: '1040 L24  Total Tax',         pattern: /total\s+tax\b/i },
  { label: 'Sch C L1  Gross Receipts',    pattern: /gross\s+receipts\s+or\s+sales/i },
  { label: 'Sch C L13 Depreciation',      pattern: /depreciation\s+and\s+section\s+179/i },
  { label: 'Sch C L31 Net Profit/Loss',   pattern: /net\s+profit\s+or\s+(?:\()?loss/i },
  { label: 'Sch E     Rental Income',     pattern: /total\s+rental\s+(?:real\s+estate\s+)?income/i },
  { label: 'Sch E     Rental Loss',       pattern: /total\s+rental\s+(?:real\s+estate\s+)?loss/i },
  { label: 'Sch F     Farm Income',       pattern: /net\s+farm\s+profit\s+or\s+loss/i },
  { label: 'Sch B     Ordinary Divs',     pattern: /total\s+ordinary\s+dividends/i, windowSize: 100 },
  { label: 'Sch B     Interest',          pattern: /total\s+(?:taxable\s+)?interest/i, windowSize: 100 },
];

function extractTaxBorrower(raw) {
  const lines = [];
  const nameM = raw.match(
    /(?:your\s+first\s+name[^\n]*\n|taxpayer\s+name[^\n]*\n)([A-Z][a-zA-Z '-]{1,30}(?:[^\S\n]+[A-Z][a-zA-Z '-]{1,30}){0,4})/i
  );
  if (nameM) lines.push(`Borrower Name: ${nameM[1].trim()}`);
  const ssnM = raw.match(/\b\d{3}-\d{2}-(\d{4})\b/);
  if (ssnM) lines.push(`SSN Last 4: ${ssnM[1]}`);
  const statusM = raw.match(
    /\b(Single|Married\s+filing\s+jointly|Married\s+filing\s+separately|Qualifying\s+surviving\s+spouse|Head\s+of\s+household)\b/i
  );
  if (statusM) lines.push(`Filing Status: ${statusM[1]}`);
  const yearM = raw.match(/\b(20(?:1[5-9]|2\d))\b/);
  if (yearM) lines.push(`Tax Year: ${yearM[1]}`);
  return lines;
}

function extractW2sFromTax(raw) {
  const results = [];
  const box1Re = /(?:box\s*1\b|(?:^|\n)\s*1\s+wages[,\s]+tips)/gi;
  let m;
  while ((m = box1Re.exec(raw)) !== null) {
    const amount = firstMoney(raw.slice(m.index, m.index + 200));
    if (!amount) continue;
    const before = raw.slice(Math.max(0, m.index - 400), m.index);
    const empM = before.match(/employer['s\s]+name[,\s]+address[^\n]*\n([^\n]{2,60})/i)
              || before.match(/c\s+employer['s\s]+name[^\n]*\n([^\n]{2,60})/i);
    const employer = empM ? empM[1].trim() : 'Employer';
    results.push(`W-2 Box1 Wages (${employer}): ${amount}`);
    if (results.length >= 4) break;
  }
  return results;
}

function extractTaxReturn(raw) {
  const lines = [...extractTaxBorrower(raw)];
  for (const f of TAX_FIELDS) {
    const r = findField(raw, f.label, f.pattern, f.windowSize);
    if (r) lines.push(r);
  }
  // Schedule E alt patterns if primary didn't match
  if (!lines.some(l => l.startsWith('Sch E'))) {
    for (const alt of [/income\s+or\s+loss\s+from\s+rental/i, /26\s+total\s+(?:income|losses)/i]) {
      const r = findField(raw, 'Sch E Rental', alt);
      if (r) { lines.push(r); break; }
    }
  }
  lines.push(...extractW2sFromTax(raw));
  return lines.filter(Boolean).join('\n');
}

// ─── W-2 extractor ───────────────────────────────────────────────────────────

function extractW2(raw) {
  const lines = [];
  const yearM = raw.match(/\b(20(?:1[5-9]|2\d))\b/);
  if (yearM) lines.push(`Tax Year: ${yearM[1]}`);

  const empM = raw.match(/c\s+employer['s\s]+name[,\s]+address[^\n]*\n([^\n]{2,80})/i)
            || raw.match(/employer['s\s]+name[^\n]*\n([^\n]{2,80})/i);
  if (empM) lines.push(`Employer: ${empM[1].trim()}`);

  const empM2 = raw.match(/e\s+employee['s\s]+name[^\n]*\n([^\n]{2,60})/i)
             || raw.match(/employee['s\s]+first\s+name[^\n]*\n([^\n]{2,60})/i);
  if (empM2) lines.push(`Employee: ${empM2[1].trim()}`);

  const ssnM = raw.match(/\b\d{3}-\d{2}-(\d{4})\b/);
  if (ssnM) lines.push(`Employee SSN Last 4: ${ssnM[1]}`);

  const W2_BOXES = [
    { label: 'Box 1  Wages',              pattern: /(?:box\s*1\b|1\s+wages[,\s]+tips[,\s]+other)/i },
    { label: 'Box 2  Fed Tax Withheld',   pattern: /(?:box\s*2\b|2\s+federal\s+income\s+tax)/i },
    { label: 'Box 3  SS Wages',           pattern: /(?:box\s*3\b|3\s+social\s+security\s+wages)/i },
    { label: 'Box 5  Medicare Wages',     pattern: /(?:box\s*5\b|5\s+medicare\s+wages)/i },
    { label: 'Box 16 State Wages',        pattern: /(?:box\s*16\b|16\s+state\s+wages)/i },
  ];
  for (const b of W2_BOXES) {
    const r = findField(raw, b.label, b.pattern, 150);
    if (r) lines.push(r);
  }
  return lines.filter(Boolean).join('\n');
}

// ─── PAYSTUB extractor ────────────────────────────────────────────────────────

function extractPaystub(raw) {
  const lines = [];

  const empNameM = raw.match(/(?:employer|company)[:\s]+([^\n]{2,60})/i);
  if (empNameM) lines.push(`Employer: ${empNameM[1].trim()}`);

  const eeNameM = raw.match(/(?:employee\s+name|pay\s+to)[:\s]+([^\n]{2,60})/i)
               || raw.match(/(?:employee)[:\s]+([A-Z][a-zA-Z '-]{2,40})/i);
  if (eeNameM) lines.push(`Employee: ${eeNameM[1].trim()}`);

  const periodM = raw.match(/pay\s+period[:\s]+([^\n]{5,40})/i)
               || raw.match(/period\s+(?:ending|end)[:\s]+([^\n]{5,30})/i);
  if (periodM) lines.push(`Pay Period: ${periodM[1].trim()}`);

  const dateM = raw.match(/pay\s+date[:\s]+([^\n]{5,20})/i)
             || raw.match(/check\s+date[:\s]+([^\n]{5,20})/i);
  if (dateM) lines.push(`Pay Date: ${dateM[1].trim()}`);

  // Pay frequency
  const freqM = raw.match(/\b(weekly|bi.?weekly|semi.?monthly|monthly|bi.?monthly)\b/i);
  if (freqM) lines.push(`Pay Frequency: ${freqM[1]}`);

  const PAYSTUB_FIELDS = [
    { label: 'Current Gross Pay',    pattern: /(?:current|this\s+period)\s+gross(?:\s+(?:pay|earnings|wages))?/i },
    { label: 'YTD Gross Pay',        pattern: /ytd\s+gross(?:\s+(?:pay|earnings|wages))?/i },
    { label: 'YTD Federal Tax',      pattern: /ytd\s+fed(?:eral)?\s+(?:income\s+)?tax/i },
    { label: 'Net Pay',              pattern: /net\s+pay|take.home\s+pay/i },
    { label: 'Base Salary/Rate',     pattern: /base\s+(?:salary|pay|rate)|hourly\s+rate/i },
    { label: 'Regular Hours',        pattern: /regular\s+hours/i },
    { label: 'OT Pay YTD',          pattern: /over\s*time.*ytd|ytd.*over\s*time/i },
  ];
  for (const f of PAYSTUB_FIELDS) {
    const r = findField(raw, f.label, f.pattern, 200);
    if (r) lines.push(r);
  }

  return lines.filter(Boolean).join('\n');
}

// ─── BANK STATEMENT extractor ─────────────────────────────────────────────────

function extractBankStatement(raw) {
  const lines = [];

  const bankM = raw.match(/^([A-Z][a-zA-Z\s]{3,30}(?:Bank|Credit\s+Union|Financial|Savings|Trust))/im)
             || raw.match(/(Chase|Bank\s+of\s+America|Wells\s+Fargo|Citibank|U\.?S\.?\s+Bank|TD\s+Bank|PNC|SunTrust|Regions)/i);
  if (bankM) lines.push(`Bank: ${bankM[1].trim()}`);

  const acctM = raw.match(/account\s+(?:number|no\.?)[^\d]*(?:\.{2,}|x+)(\d{4})/i)
             || raw.match(/ending\s+in\s+(\d{4})/i)
             || raw.match(/account[:\s]+[xX*]{4,}(\d{4})/i);
  if (acctM) lines.push(`Account Last 4: ${acctM[1]}`);

  const periodM = raw.match(/statement\s+(?:period|date)[:\s]+([^\n]{5,40})/i)
               || raw.match(/(?:from|for\s+the\s+period)[:\s]+([^\n]{5,40})/i);
  if (periodM) lines.push(`Statement Period: ${periodM[1].trim()}`);

  const BANK_FIELDS = [
    { label: 'Beginning Balance', pattern: /beginning\s+balance|opening\s+balance|balance\s+(?:forward|brought\s+forward)/i },
    { label: 'Ending Balance',    pattern: /ending\s+balance|closing\s+balance|balance\s+at\s+(?:end|close)/i },
    { label: 'Total Deposits',    pattern: /total\s+(?:deposits|credits|additions)/i },
    { label: 'Total Withdrawals', pattern: /total\s+(?:withdrawals|debits|deductions)/i },
  ];
  for (const f of BANK_FIELDS) {
    const r = findField(raw, f.label, f.pattern, 150);
    if (r) lines.push(r);
  }

  // Flag large deposits (≥$2,500 as a proxy for ">25% of typical monthly income")
  const largeDeposits = [];
  const depositRe = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})[^\n]*?(?:deposit|credit|transfer\s+in|direct\s+dep)[^\n]*?((?:\$\s*)?\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/gi;
  let dm;
  while ((dm = depositRe.exec(raw)) !== null) {
    const amount = parseFloat(dm[2].replace(/[$,]/g, ''));
    if (amount >= 2500) largeDeposits.push(`${dm[1]} ${dm[2].trim()}`);
    if (largeDeposits.length >= 5) break;
  }
  if (largeDeposits.length) lines.push(`Large Deposits (LOE may be needed): ${largeDeposits.join(' | ')}`);

  return lines.filter(Boolean).join('\n');
}

// ─── 1003 LOAN APPLICATION extractor ─────────────────────────────────────────

function extractLoanApp(raw) {
  const lines = [];

  const nameM = raw.match(/borrower['s\s]+name[:\s]+([^\n]{2,60})/i)
             || raw.match(/(?:first|last)\s+name[:\s]+([^\n]{2,40})/i);
  if (nameM) lines.push(`Borrower: ${nameM[1].trim()}`);

  const ssnM = raw.match(/\b\d{3}-\d{2}-(\d{4})\b/);
  if (ssnM) lines.push(`SSN Last 4: ${ssnM[1]}`);

  const dobM = raw.match(/(?:date\s+of\s+birth|dob)[:\s]+([^\n]{5,20})/i);
  if (dobM) lines.push(`DOB: ${dobM[1].trim()}`);

  const LOAN_FIELDS = [
    { label: 'Loan Amount',          pattern: /loan\s+amount[:\s]*/i },
    { label: 'Purchase Price',       pattern: /purchase\s+price[:\s]*/i },
    { label: 'Appraised Value',      pattern: /appraised\s+value[:\s]*/i },
    { label: 'Monthly Income',       pattern: /(?:total\s+)?monthly\s+(?:gross\s+)?income[:\s]*/i },
    { label: 'Total Assets',         pattern: /total\s+assets[:\s]*/i },
    { label: 'Total Liabilities',    pattern: /total\s+(?:monthly\s+)?(?:liabilities|obligations)[:\s]*/i },
  ];
  for (const f of LOAN_FIELDS) {
    const r = findField(raw, f.label, f.pattern, 150);
    if (r) lines.push(r);
  }

  const addrM = raw.match(/(?:subject\s+property|property)\s+address[:\s]+([^\n]{5,80})/i)
             || raw.match(/property\s+street[:\s]+([^\n]{5,80})/i);
  if (addrM) lines.push(`Property Address: ${addrM[1].trim()}`);

  const propTypeM = raw.match(/property\s+type[:\s]+([^\n]{3,40})/i);
  if (propTypeM) lines.push(`Property Type: ${propTypeM[1].trim()}`);

  const occM = raw.match(/(?:occupancy|intended\s+use)[:\s]+([^\n]{3,40})/i);
  if (occM) lines.push(`Occupancy: ${occM[1].trim()}`);

  const empM = raw.match(/(?:current\s+)?employer(?:'s)?\s+(?:name|company)[:\s]+([^\n]{2,60})/i);
  if (empM) lines.push(`Employer: ${empM[1].trim()}`);

  return lines.filter(Boolean).join('\n');
}

// ─── CREDIT REPORT extractor ─────────────────────────────────────────────────

function extractCreditReport(raw) {
  const lines = [];

  const nameM = raw.match(/(?:consumer|applicant|borrower|subject)[:\s]+name[:\s]+([^\n]{2,60})/i)
             || raw.match(/name[:\s]+([A-Z][a-zA-Z '-]{2,40}(?:[^\S\n]+[A-Z][a-zA-Z '-]{2,20})+)/i);
  if (nameM) lines.push(`Borrower: ${nameM[1].trim()}`);

  const ssnM = raw.match(/\b\d{3}-\d{2}-(\d{4})\b/);
  if (ssnM) lines.push(`SSN Last 4: ${ssnM[1]}`);

  // FICO scores — look for all 3 bureaus
  const ficoPatterns = [
    { label: 'Equifax FICO',    re: /equifax[^\n]{0,60}?(\d{3})/i },
    { label: 'TransUnion FICO', re: /trans\s*union[^\n]{0,60}?(\d{3})/i },
    { label: 'Experian FICO',   re: /experian[^\n]{0,60}?(\d{3})/i },
    { label: 'Mid Score',       re: /(?:mid(?:dle)?\s+score|representative\s+score)[:\s]+(\d{3})/i },
  ];
  for (const fp of ficoPatterns) {
    const m = raw.match(fp.re);
    if (m && parseInt(m[1]) >= 300 && parseInt(m[1]) <= 850) {
      lines.push(`${fp.label}: ${m[1]}`);
    }
  }

  const oblM = raw.match(/total\s+monthly\s+(?:payment|obligation)[:\s]*/i);
  if (oblM) {
    const r = findField(raw, 'Total Monthly Obligations', /total\s+monthly\s+(?:payment|obligation)/i, 150);
    if (r) lines.push(r);
  }

  // Derogatory items
  const derogs = [];
  if (/bankruptcy|chapter\s+(?:7|11|13)/i.test(raw)) derogs.push('Bankruptcy');
  if (/foreclosure/i.test(raw)) derogs.push('Foreclosure');
  if (/short\s+sale/i.test(raw)) derogs.push('Short Sale');
  if (/deed\s+in\s+lieu/i.test(raw)) derogs.push('Deed in Lieu');
  if (/collection/i.test(raw)) derogs.push('Collections');
  if (/charge.off/i.test(raw)) derogs.push('Charge-off');
  if (/\b(30|60|90|120)\s*day\s*late/i.test(raw)) derogs.push('Late Payments');
  if (derogs.length) lines.push(`Derogatories: ${derogs.join(', ')}`);
  else lines.push('Derogatories: None found');

  // Inquiries in last 90 days
  const inqM = raw.match(/inquir(?:y|ies)[^\n]{0,50}(\d+)[^\n]{0,20}(?:90\s+days?|3\s+months?)/i)
            || raw.match(/(\d+)\s+inquir(?:y|ies)[^\n]{0,50}(?:90\s+days?|3\s+months?)/i);
  if (inqM) lines.push(`Inquiries (90 days): ${inqM[1]}`);

  return lines.filter(Boolean).join('\n');
}

// ─── PURCHASE CONTRACT extractor ─────────────────────────────────────────────

function extractPurchaseContract(raw) {
  const lines = [];

  const addrM = raw.match(/(?:property|premises|subject\s+property)\s+(?:address|located\s+at)[:\s]+([^\n]{5,100})/i)
             || raw.match(/(?:real\s+property\s+(?:known\s+as|described\s+as|located\s+at))[:\s]+([^\n]{5,100})/i);
  if (addrM) lines.push(`Property Address: ${addrM[1].trim()}`);

  const priceM = findField(raw, 'Purchase Price', /purchase\s+price[:\s]*/i, 150)
              || findField(raw, 'Purchase Price', /total\s+(?:purchase|sale)\s+price/i, 150)
              || findField(raw, 'Purchase Price', /agreed\s+(?:purchase\s+)?price/i, 150);
  if (priceM) lines.push(priceM);

  const closeM = raw.match(/closing\s+date[:\s]+([^\n]{5,30})/i)
              || raw.match(/close\s+of\s+escrow[:\s]+([^\n]{5,30})/i)
              || raw.match(/settlement\s+date[:\s]+([^\n]{5,30})/i);
  if (closeM) lines.push(`Closing Date: ${closeM[1].trim()}`);

  const earnestM = findField(raw, 'Earnest Money Deposit', /earnest\s+money/i, 150);
  if (earnestM) lines.push(earnestM);

  const concM = findField(raw, 'Seller Concessions', /seller(?:'s)?\s+concession/i, 200)
             || findField(raw, 'Closing Cost Credit', /closing\s+cost\s+(?:credit|contribution)/i, 200);
  if (concM) lines.push(concM);

  const sellerM = raw.match(/seller[:\s]+([^\n]{2,60})/i);
  if (sellerM) lines.push(`Seller: ${sellerM[1].trim()}`);

  return lines.filter(Boolean).join('\n');
}

// ─── General keyword extractor (fallback for unknown types) ──────────────────

const BOILERPLATE = [
  /^form\s+\d/i, /^department of the treasury/i, /^internal revenue service/i,
  /^omb no/i, /^see\s+instructions/i, /^for\s+privacy\s+act/i,
  /^paperwork\s+reduction/i, /^go\s+to\s+irs\.gov/i, /^page\s+\d+\s*$/i,
  /^\d{1,3}\s*$/, /^[a-z]\.\s*$/i, /^\.\s*\.\s*\.\s*\.+/, /^-{5,}/,
];

function extractGeneral(raw) {
  const KW = [
    /income|earnings|wages|salary|revenue/i,
    /balance|asset|reserve|deposit/i,
    /debt|payment|loan|mortgage|obligation/i,
    /employer|employee|borrower/i,
    /purchase\s+price|loan\s+amount|property\s+value/i,
    /fico|credit\s+score/i,
  ];
  const seen = new Set();
  const out = [];
  for (const line of raw.split('\n')) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t || t.length < 4 || seen.has(t)) continue;
    if (BOILERPLATE.some(re => re.test(t))) continue;
    const hasKW = KW.some(re => re.test(t));
    const hasMoney = MONEY_RE.test(t);
    if ((hasKW && hasMoney) || (hasMoney && t.length < 80) || (hasKW && t.length < 100)) {
      seen.add(t); out.push(t);
    }
  }
  return out.join('\n');
}

// ─── Hard truncate ────────────────────────────────────────────────────────────

function hardTruncate(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + `\n[+${text.length - max} chars truncated]`;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function processFile(file) {
  if (file.mimetype !== 'application/pdf') {
    return { ...file, extractedText: null };
  }

  const raw = await extractRawText(file.buffer, file.originalname);
  const rawChars = raw ? raw.length : 0;

  if (!raw) {
    console.log(`  [parse-fail] ${file.originalname} — flagging as needs-OCR`);
    return { ...file, extractedText: null, parseError: true };
  }

  const docType = detectDocType(file.label, raw.slice(0, 500));
  console.log(`  [${docType}] ${file.originalname} — raw: ${rawChars} chars`);

  const extractors = {
    taxReturn:        () => { const t = extractTaxReturn(raw);        return [t, MAX_TAX_CHARS]; },
    w2:               () => { const t = extractW2(raw);               return [t, MAX_CHARS_PER_DOC]; },
    paystub:          () => { const t = extractPaystub(raw);          return [t, MAX_CHARS_PER_DOC]; },
    bankStatement:    () => { const t = extractBankStatement(raw);    return [t, MAX_CHARS_PER_DOC]; },
    loanApp1003:      () => { const t = extractLoanApp(raw);          return [t, MAX_CHARS_PER_DOC]; },
    creditReport:     () => { const t = extractCreditReport(raw);     return [t, MAX_CHARS_PER_DOC]; },
    purchaseContract: () => { const t = extractPurchaseContract(raw); return [t, MAX_CHARS_PER_DOC]; },
    general:          () => { const t = extractGeneral(raw);          return [t, MAX_CHARS_PER_DOC]; },
  };

  const [extracted, cap] = (extractors[docType] || extractors.general)();

  // Fallback: if targeted extraction yielded almost nothing, head-slice raw text
  const base = extracted && extracted.length > 80
    ? extracted
    : raw.replace(/\s{2,}/g, ' ').trim();

  const finalText = hardTruncate(base, cap);
  console.log(`  [${docType}] ${file.originalname} — extracted: ${finalText.length}/${cap} chars`);

  return { ...file, extractedText: finalText, docType };
}

module.exports = { processFile, MAX_CHARS_PER_DOC, MAX_TAX_CHARS, MAX_TOTAL_CHARS };
