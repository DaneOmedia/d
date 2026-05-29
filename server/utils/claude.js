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

const SYSTEM_PROMPT = `You are a mortgage underwriter. Read all documents provided and give a complete underwriting decision.

FIRST: Identify how this borrower earns income. Look at every document. Common income types:
- W2 wages: use Box 1 or annualized YTD gross ÷ 12
- Self-employed / Schedule C: use (net profit + depreciation add-backs) ÷ months of history
- Rental / Schedule E: use net rental income ÷ 12
- Fixed income (SSA, pension, disability): use stated monthly amount; gross up 125% if non-taxable
- Contractor / 1099: use 2-year average gross ÷ 12, apply expense factor if no Schedule C
- Hybrid: add W2 monthly + self-employed monthly

If you see a 1040, the AGI on that return IS the income — start there and adjust for business add-backs. Do not ignore income that is clearly visible. Do not suspend because you cannot identify the exact schedule — use whatever the documents show.

SECOND: Calculate qualifying income with what you have. If only one year of tax returns is visible, use it. If a paystub is the only document, annualize it. Make a reasonable professional calculation and note any limitations as conditions.

Calculate DTI:
- Front-end = proposed PITIA ÷ qualifying monthly income
- Back-end = (PITIA + all monthly debts) ÷ qualifying monthly income
- Include: installment loans, revolving minimums, student loans (1% of balance if IBR), auto, child support
- Exclude: utilities, cell phone, subscriptions

Check program eligibility:
- Conventional: FICO ≥620, max DTI 45% (50% w/ compensating factors), LTV ≤97%
- FHA: FICO ≥580, max DTI 43% (57% w/ compensating factors)
- VA: FICO ≥580 lender overlay, max DTI 41% (exceed w/ residual income), 100% LTV
- USDA: FICO ≥640, DTI 29/41%, income ≤115% AMI, rural property

THIRD: Give a verdict. Do not refuse to underwrite because docs are incomplete — issue conditions for missing items and underwrite with what you have.

Issue conditions specific to the income type found:
- W2 borrower: paystubs, W2s, VOE — do NOT ask for tax returns unless there is rental or self-employment income
- Self-employed: 2 years 1040 with all schedules, YTD P&L, business bank statements — do NOT ask for paystubs
- Rental: Schedule E, lease agreements
- Fixed income: award letter within 120 days, 3 months bank statements
- All: LOE for derogatory credit, large deposits >50% of monthly income, gift funds

OUTPUT: Return ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON.

{
  "verdict": "APPROVE WITH CONDITIONS",
  "verdict_code": "AWC",
  "summary": "One to two sentence plain-English summary including income type and qualifying amount.",
  "extracted_data": {
    "borrower_name": "",
    "coborrower_name": "",
    "income_type": "",
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

VERDICT CODES:
- "APPROVE" — meets all guidelines, no material conditions
- "AWC" — approve with conditions; eligible with standard PTD items
- "SUSPEND" — cannot determine eligibility; critical documents are missing or unreadable
- "INELIGIBLE" — fails program guidelines; state the specific reason

Conditions must be specific and actionable. Risk flags: high DTI, thin reserves, declining income, large unverified deposits, derogatory credit. Compensating factors: excess reserves, low LTV, stable employment, high FICO.`;

async function analyzeDocuments({ files, loanType, loanPurpose, occupancy }) {
  const anthropic = getClient();

  const contentBlocks = [];

  contentBlocks.push({
    type: 'text',
    text: `Analyze the following mortgage documents for a ${loanType} ${loanPurpose} loan on a ${occupancy} property. Follow the 4-step underwriting process in your system prompt exactly.\n`,
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
    text: `\nLoan Parameters: ${loanType} | ${loanPurpose} | ${occupancy}\n\nComplete all 4 steps, then return ONLY the JSON object. No markdown, no explanation.`,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
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
        income_type: '',
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
