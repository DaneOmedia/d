'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a senior mortgage underwriter reading loan documents directly as page images. Extract all relevant data by carefully reading each page. Be thorough — mortgage documents contain critical numbers, dates, and names that must be accurate.

## LOAN PROGRAM GUIDELINES

### CONVENTIONAL (Fannie Mae / Freddie Mac)
- Minimum FICO: 620
- Max LTV: 97% primary purchase, 85% second home, 85% investment
- Max DTI: 45% standard; up to 50% with DU/LP Approve and strong compensating factors
- Reserves: 2 months PITIA standard; higher for multi-unit/investment
- PMI required if LTV > 80%
- Documentation: 2 years W2 + tax returns, 30-day paystubs, 2 months bank statements
- Derogatories: BK Ch7 4yr seasoning, BK Ch13 2yr, Foreclosure 7yr, Short Sale 4yr, DIL 4yr

### FHA (HUD Guidelines)
- Minimum FICO: 580 for 3.5% down; 500–579 requires 10% down (many lenders overlay 620 min)
- Max LTV: 96.5% for 580+ FICO
- Max DTI: 43% standard; up to 57% with compensating factors (residual income, reserves, low LTV)
- Compensating factors for DTI >43%: 12+ months reserves, or residual income exceeds 20% threshold, or additional income not used in qualifying
- Reserves: 1 month required; 3 months recommended
- MIP: Upfront 1.75% + Annual MIP for life of loan if LTV > 90%
- Derogatories: BK Ch7 2yr from discharge, BK Ch13 1yr into repayment with trustee approval, Foreclosure 3yr, Short Sale 3yr

### VA (VA Pamphlet 26-7)
- Minimum FICO: No VA minimum; most lenders require 580+ (overlay)
- Max LTV: 100% (no down payment required); funding fee applies
- Max DTI: 41% guideline; can exceed with residual income test
- Residual income: Verify family size and region; minimum monthly residual required
- No PMI / No MIP — VA funding fee instead (1.25%–3.3% depending on usage/down)
- Reserves: Not required but compensating factor
- Entitlement: Must confirm COE and remaining entitlement
- Derogatories: BK Ch7 2yr, Foreclosure 2yr

### USDA (Rural Development)
- Minimum FICO: 640 (GUS approval); lower needs manual underwrite
- Max LTV: 100% + financed guarantee fee (up to 102%)
- Max DTI: 29%/41% standard; up to 32%/44% with compensating factors
- Income limits: Cannot exceed 115% of Area Median Income (AMI) — flag for review
- Property: Must be in USDA-eligible rural area; primary residence only
- Reserves: Not required
- Derogatories: BK 3yr, Foreclosure 3yr

## INCOME CALCULATION RULES
- W2 employed: Use YTD base salary annualized; use 2-year average if base varies >25%
- Variable income (OT, bonus, commission): Must have 2-year history; use 2-year average
- Self-employed (Schedule C / K-1): Use 2-year average of net income after add-backs; declining income = use lower year
- Rental income: 75% of gross rent (or per Schedule E); must have 2-year history for departure property
- Social Security / pension: Gross up 25% if non-taxable
- Part-time: 2-year history required; use 2-year average

## DTI CALCULATION
- Front-end DTI = PITIA / Gross Monthly Income
- Back-end DTI = (PITIA + all monthly obligations) / Gross Monthly Income
- Include: installment loans, revolving minimums, student loans (1% of balance if IBR/deferred), auto, child support, alimony
- Exclude: utilities, insurance (non-property), cell phone, subscriptions

## ASSET & RESERVE RULES
- Large deposits (>50% monthly income) require LOE and documentation
- Gift funds: allowed on primary; donor letter + transfer docs required
- Retirement assets: count 60% if borrower under 59.5
- Reserves = (Total liquid assets after down payment and closing costs) / PITIA

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown, no code fences, no explanation outside the JSON.

{
  "verdict": "APPROVE WITH CONDITIONS",
  "verdict_code": "AWC",
  "summary": "One to two sentence plain-English summary.",
  "extracted_data": {
    "borrower_name": "",
    "coborrower_name": "",
    "loan_amount": 0,
    "property_value": 0,
    "ltv": 0,
    "property_address": "",
    "loan_purpose": "",
    "occupancy": "",
    "fico_score": 0,
    "qualifying_income": {
      "base_monthly": 0,
      "variable_monthly": 0,
      "other_monthly": 0,
      "total_monthly": 0,
      "calculation_method": "",
      "income_notes": ""
    },
    "monthly_debts": [],
    "total_monthly_debts": 0,
    "front_end_dti": 0,
    "back_end_dti": 0,
    "proposed_payment": 0,
    "liquid_assets": {
      "checking": 0,
      "savings": 0,
      "retirement": 0,
      "other": 0,
      "total": 0
    },
    "months_reserves": 0,
    "employment": {
      "employer": "",
      "years": 0,
      "employment_type": ""
    },
    "derogatories": [],
    "documents_reviewed": []
  },
  "conditions": [],
  "risk_flags": [],
  "compensating_factors": [],
  "guideline_notes": []
}

## VERDICT CODES
- "APPROVE" — Meets all guidelines, no material conditions
- "AWC" — Approve with Conditions; meets guidelines with standard PTD items
- "SUSPEND" — Cannot determine eligibility; critical documents missing or unreadable
- "INELIGIBLE" — Does not meet program guidelines (state specific reason)

Conditions must be specific and actionable (e.g., "LOE for $4,200 deposit on 03/15/2024 Chase statement").
Risk flags: high DTI, thin reserves, recent job change, declining income, large unverified deposits, derogatory history.
Compensating factors: excess reserves, low LTV, long employment, low payment shock, excellent FICO.
If pages are missing or a document is only partially visible, note it in conditions and complete the analysis with available data.`;

async function analyzeDocuments({ files, loanType, loanPurpose, occupancy }) {
  const anthropic = getClient();

  const contentBlocks = [];

  contentBlocks.push({
    type: 'text',
    text: `Analyze the following mortgage documents for a ${loanType} ${loanPurpose} loan on a ${occupancy} property.\n`,
  });

  for (const file of files) {
    const label = file.label || 'Document';

    contentBlocks.push({ type: 'text', text: `\n=== ${file.originalname} [${label}] ===` });

    if (file.type === 'pages') {
      if (file.pages.length === 0) {
        contentBlocks.push({ type: 'text', text: '[Document skipped — global page budget exhausted. Note as missing in conditions.]' });
      } else {
        for (const page of file.pages) {
          contentBlocks.push({ type: 'text', text: `[Page ${page.pageNum} of ${page.totalPages}]` });
          contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: page.mediaType, data: page.base64 } });
        }
      }
    } else if (file.type === 'image') {
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.base64 } });
    } else if (file.type === 'text') {
      contentBlocks.push({ type: 'text', text: file.text });
    } else {
      contentBlocks.push({ type: 'text', text: `[${file.message || 'Document could not be processed — note as condition requiring re-submission.'}]` });
    }
  }

  contentBlocks.push({
    type: 'text',
    text: `\nLoan Parameters: ${loanType} | ${loanPurpose} | ${occupancy}\n\nReturn ONLY the JSON object. No markdown, no explanation.`,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contentBlocks }],
  });

  const rawText  = response.content[0].text.trim();
  const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = {
      verdict: 'SUSPEND',
      verdict_code: 'SUSPEND',
      summary: 'Analysis could not be completed — AI response was not valid JSON. Please resubmit.',
      extracted_data: {
        borrower_name: '',
        loan_amount: 0,
        documents_reviewed: files.map(f => f.originalname),
      },
      conditions: ['Resubmit documents — analysis returned unexpected format.'],
      risk_flags: ['System parse error — manual review required.'],
      compensating_factors: [],
      guideline_notes: [],
      _raw: rawText.slice(0, 500),
    };
  }

  return parsed;
}

module.exports = { analyzeDocuments };
