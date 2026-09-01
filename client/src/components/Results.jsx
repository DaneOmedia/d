import React, { useState } from 'react';
import VerdictBadge from './VerdictBadge';

function fmt(val, prefix = '', suffix = '') {
  if (val === null || val === undefined || val === 0 || val === '') return '—';
  if (typeof val === 'number') return `${prefix}${val.toLocaleString()}${suffix}`;
  return `${prefix}${val}`;
}

function fmtPct(val) {
  if (!val && val !== 0) return '—';
  return `${Number(val).toFixed(1)}%`;
}

function fmtUSD(val) {
  if (!val && val !== 0) return '—';
  return `$${Number(val).toLocaleString()}`;
}

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/50 transition"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-white font-semibold text-sm">{title}</h3>
        </div>
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function DataRow({ label, value, highlight }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ml-4 text-right ${highlight ? 'text-amber-400' : 'text-slate-200'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function BadgeList({ items, color }) {
  const colors = {
    red:     'bg-red-900/30 border-red-800 text-red-300',
    amber:   'bg-amber-900/30 border-amber-800 text-amber-300',
    emerald: 'bg-emerald-900/30 border-emerald-800 text-emerald-300',
    blue:    'bg-blue-900/30 border-blue-800 text-blue-300',
    slate:   'bg-slate-800/60 border-slate-700 text-slate-300',
  };
  if (!items || items.length === 0)
    return <p className="text-slate-600 text-sm italic">None identified</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className={`border rounded-xl px-3.5 py-2.5 text-sm ${colors[color] || colors.slate}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function DTIBar({ label, value, max, warnAt }) {
  const pct = Math.min((value / max) * 100, 100);
  const isOver = value >= max;
  const isWarn = value >= warnAt;
  const barColor = isOver ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-semibold ${isOver ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-emerald-400'}`}>
          {fmtPct(value)}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-slate-600 text-xs">Max {fmtPct(max)}</p>
    </div>
  );
}

const DSCR_TIER_STYLES = {
  strong:            { color: 'text-emerald-300 bg-emerald-900/30 border-emerald-700', label: 'Strong (≥1.25)' },
  standard:          { color: 'text-blue-300 bg-blue-900/30 border-blue-700',          label: 'Standard (1.00–1.24)' },
  negative_cashflow: { color: 'text-amber-300 bg-amber-900/30 border-amber-700',       label: 'Negative Cashflow (0.75–0.99)' },
  below_floor:       { color: 'text-red-300 bg-red-900/30 border-red-700',             label: 'Below Floor (<0.75)' },
};

const NQM_LABEL = {
  BANK_STATEMENT:    'Bank Statement',
  PL_ONLY:           'P&L Only',
  P_AND_L_ONLY:      'P&L Only',
  '1099_ONLY':       '1099 Only',
  ASSET_UTILIZATION: 'Asset Utilization',
  WVOE:              'Written VOE',
  ITIN:              'ITIN',
  FOREIGN_NATIONAL:  'Foreign National',
};

const USABILITY_STYLES = {
  USABLE:                   { badge: 'bg-emerald-900/40 border-emerald-700 text-emerald-300', dot: 'bg-emerald-400', label: 'USABLE' },
  USABLE_WITH_CONDITIONS:   { badge: 'bg-amber-900/40 border-amber-700 text-amber-300',   dot: 'bg-amber-400',   label: 'WITH CONDITIONS' },
  NOT_USABLE:               { badge: 'bg-red-900/40 border-red-700 text-red-300',          dot: 'bg-red-400',     label: 'NOT USABLE' },
};

function UsabilityBadge({ usability }) {
  const s = USABILITY_STYLES[usability] || USABILITY_STYLES.NOT_USABLE;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function IncomeComponent({ comp, index }) {
  const [open, setOpen] = useState(false);
  const label = (comp.component || 'INCOME').replace(/_/g, ' ');
  const isUsable = comp.usability === 'USABLE' || comp.usability === 'USABLE_WITH_CONDITIONS';

  return (
    <div className={`border rounded-xl overflow-hidden ${isUsable ? 'border-slate-700' : 'border-slate-800 opacity-70'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${USABILITY_STYLES[comp.usability]?.dot || 'bg-slate-500'}`} />
          <span className="text-slate-200 text-sm font-medium truncate">{label}</span>
          {comp.included_in_total && (
            <span className="text-xs text-emerald-500 shrink-0">✓ included</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-slate-100 text-sm font-semibold tabular-nums">
            {isUsable && comp.monthly_amount > 0 ? fmtUSD(comp.monthly_amount) + '/mo' : '—'}
          </span>
          <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          <UsabilityBadge usability={comp.usability} />
          {comp.reasoning && (
            <p className="text-slate-400 text-xs leading-relaxed">{comp.reasoning}</p>
          )}
          {comp.calculation_method && (
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">Calculation</p>
              <p className="text-slate-300 text-xs font-mono leading-relaxed">{comp.calculation_method}</p>
            </div>
          )}
          {comp.guideline_reference && (
            <p className="text-slate-600 text-xs">Guideline: {comp.guideline_reference}</p>
          )}
          {comp.source_documents?.length > 0 && (
            <p className="text-slate-600 text-xs">Sources: {comp.source_documents.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function NonQMProgramCard({ prog }) {
  const [open, setOpen] = useState(false);
  const label = NQM_LABEL[prog.program] || prog.program?.replace(/_/g, ' ') || 'Non-QM Program';
  return (
    <div className={`border rounded-xl overflow-hidden ${prog.applicable ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${USABILITY_STYLES[prog.usability]?.dot || 'bg-slate-500'}`} />
          <span className="text-slate-200 text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {prog.qualifying_monthly_income > 0 && (
            <span className="text-slate-100 text-sm font-semibold tabular-nums">{fmtUSD(prog.qualifying_monthly_income)}/mo</span>
          )}
          <UsabilityBadge usability={prog.usability} />
          <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          {prog.reasoning && <p className="text-slate-400 text-xs leading-relaxed">{prog.reasoning}</p>}
          {prog.conditions?.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1.5">Conditions</p>
              <BadgeList items={prog.conditions} color="amber" />
            </div>
          )}
          {prog.source_documents?.length > 0 && (
            <p className="text-slate-600 text-xs">Sources: {prog.source_documents.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function flattenConditions(conditions) {
  if (!conditions) return [];
  if (Array.isArray(conditions)) return conditions;
  return Object.entries(conditions).flatMap(([, items]) => (Array.isArray(items) ? items : []));
}

function conditionCount(conditions) {
  return flattenConditions(conditions).length;
}

export default function Results({ result, loan }) {
  const d = result.extracted_data || {};
  const income = d.qualifying_income || {};
  const components = income.components || [];
  const assets = d.liquid_assets || {};
  const conditions = result.conditions || {};
  const conditionsIsObject = conditions && !Array.isArray(conditions) && typeof conditions === 'object';
  const conditionCategories = conditionsIsObject
    ? Object.entries(conditions).filter(([, v]) => Array.isArray(v) && v.length > 0)
    : [];
  const totalConditions = conditionCount(conditions);

  const dscr = result.dscr_analysis || {};
  const dscrTierStyle = DSCR_TIER_STYLES[dscr.tier] || DSCR_TIER_STYLES.below_floor;
  const nonqmPrograms = result.nonqm_programs || [];
  const hasNonQM = nonqmPrograms.length > 0;

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <VerdictBadge verdict={result.verdict} verdictCode={result.verdict_code} />
        {result.summary && (
          <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{loan.loanType}</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{loan.loanPurpose}</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{loan.occupancy}</span>
          {result.qualifying_path && (
            <span className="bg-[#86051b]/20 border border-[#86051b]/50 text-[#ebe9d3] px-2.5 py-1 rounded-full">{result.qualifying_path}</span>
          )}
          {d.documents_reviewed?.length > 0 && (
            <span className="bg-slate-800 px-2.5 py-1 rounded-full">{d.documents_reviewed.length} docs reviewed</span>
          )}
        </div>
      </div>

      {dscr.applicable && (
        <Section
          title="DSCR Analysis"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">DSCR Ratio</p>
                <p className="text-white text-3xl font-bold tabular-nums">
                  {dscr.dscr_ratio ? Number(dscr.dscr_ratio).toFixed(2) : '—'}
                </p>
              </div>
              {dscr.tier && (
                <div className={`border rounded-xl px-3 py-2 ${dscrTierStyle.color}`}>
                  <p className="text-xs font-bold uppercase tracking-wide">{dscrTierStyle.label}</p>
                </div>
              )}
              <UsabilityBadge usability={dscr.usability} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-800/50 rounded-xl px-4 py-3">
                <p className="text-slate-500 text-xs mb-0.5">Monthly Gross Rent</p>
                <p className="text-slate-100 text-base font-semibold">{fmtUSD(dscr.monthly_rental_income)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl px-4 py-3">
                <p className="text-slate-500 text-xs mb-0.5">Monthly PITIA</p>
                <p className="text-slate-100 text-base font-semibold">{fmtUSD(dscr.monthly_piti)}</p>
              </div>
            </div>
            {dscr.reasoning && (
              <p className="text-slate-400 text-xs leading-relaxed">{dscr.reasoning}</p>
            )}
            {dscr.conditions?.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">DSCR Conditions</p>
                <BadgeList items={dscr.conditions} color="amber" />
              </div>
            )}
          </div>
        </Section>
      )}

      {hasNonQM && (
        <Section
          title={`Non-QM Programs (${nonqmPrograms.length})`}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
        >
          <div className="space-y-2">
            {nonqmPrograms.map((prog, i) => (
              <NonQMProgramCard key={i} prog={prog} />
            ))}
          </div>
        </Section>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Section
          title="Extracted Data"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        >
          <div className="space-y-0">
            <DataRow label="Borrower" value={d.borrower_name} />
            {d.coborrower_name && <DataRow label="Co-Borrower" value={d.coborrower_name} />}
            <DataRow label="Loan Amount" value={fmtUSD(d.loan_amount)} />
            <DataRow label="Property Value" value={fmtUSD(d.property_value)} />
            <DataRow label="LTV" value={fmtPct(d.ltv)} highlight={d.ltv > 95} />
            <DataRow label="FICO Score" value={d.fico_score ? String(d.fico_score) : null} highlight={d.fico_score && d.fico_score < 640} />
            {d.property_address && <DataRow label="Property" value={d.property_address} />}
          </div>
          {d.employment?.employer && (
            <div className="mt-4">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Employment</p>
              <DataRow label="Employer" value={d.employment.employer} />
              {d.employment.years > 0 && <DataRow label="Years on Job" value={`${d.employment.years} yrs`} />}
              {d.employment.employment_type && <DataRow label="Type" value={d.employment.employment_type} />}
            </div>
          )}
        </Section>

        <div className="space-y-5">
          <Section
            title="Debt-to-Income Ratios"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          >
            <div className="space-y-5">
              {d.front_end_dti > 0 && (
                <DTIBar label="Front-End (Housing) DTI" value={d.front_end_dti}
                  max={loan.loanType === 'FHA' ? 31 : loan.loanType === 'USDA' ? 29 : 28}
                  warnAt={loan.loanType === 'FHA' ? 31 : 28} />
              )}
              {d.back_end_dti > 0 && (
                <DTIBar label="Back-End (Total) DTI" value={d.back_end_dti}
                  max={loan.loanType === 'FHA' ? 57 : loan.loanType === 'USDA' ? 44 : loan.loanType === 'VA' ? 41 : 50}
                  warnAt={loan.loanType === 'FHA' ? 43 : loan.loanType === 'VA' ? 41 : 45} />
              )}
              {d.proposed_payment > 0 && <DataRow label="Proposed PITIA" value={fmtUSD(d.proposed_payment)} />}
              {d.total_monthly_debts > 0 && <DataRow label="Monthly Obligations" value={fmtUSD(d.total_monthly_debts)} />}
            </div>
            {d.monthly_debts?.length > 0 && (
              <div className="mt-4">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Tradelines Included</p>
                <div className="space-y-1">
                  {d.monthly_debts.map((debt, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-400">{debt.tradeline || debt.description || `Debt ${i + 1}`}</span>
                      <span className="text-slate-300">{fmtUSD(debt.payment)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="Assets & Reserves"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
          >
            <div className="space-y-0">
              {assets.checking > 0 && <DataRow label="Checking" value={fmtUSD(assets.checking)} />}
              {assets.savings > 0 && <DataRow label="Savings" value={fmtUSD(assets.savings)} />}
              {assets.retirement > 0 && <DataRow label="Retirement (60%)" value={fmtUSD(assets.retirement)} />}
              {assets.other > 0 && <DataRow label="Other" value={fmtUSD(assets.other)} />}
              <DataRow label="Total Liquid" value={fmtUSD(assets.total)} />
              <DataRow label="Months Reserves" value={d.months_reserves ? `${Number(d.months_reserves).toFixed(1)} mo` : null} highlight={d.months_reserves && d.months_reserves < 2} />
            </div>
          </Section>

          {d.derogatories?.length > 0 && (
            <Section
              title="Derogatory History"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            >
              <BadgeList items={d.derogatories} color="red" />
            </Section>
          )}
        </div>
      </div>

      {(components.length > 0 || !dscr.applicable) && <Section
        title={`Qualifying Income Components (${components.length})`}
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      >
        {components.length === 0 ? (
          <p className="text-slate-600 text-sm italic">No income components extracted</p>
        ) : (
          <div className="space-y-2">
            {components.map((comp, i) => (
              <IncomeComponent key={i} comp={comp} index={i} />
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-slate-700 mt-3">
              <span className="text-slate-400 text-sm font-semibold">Total Qualifying Income</span>
              <span className="text-white text-base font-bold">{fmtUSD(income.total_monthly)}/mo</span>
            </div>
            {income.calculation_notes && (
              <p className="text-slate-500 text-xs italic pt-1">{income.calculation_notes}</p>
            )}
          </div>
        )}
      </Section>}

      {result.program_eligibility && (
        <Section
          title="Program Eligibility"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(result.program_eligibility).map(([prog, info]) => {
              const eligible = info?.eligible;
              return (
                <div key={prog} className={`border rounded-xl px-4 py-3 ${eligible ? 'border-emerald-800 bg-emerald-900/20' : 'border-slate-700 bg-slate-800/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase text-slate-300">{prog.replace(/_/g, ' ')}</span>
                    <span className={`text-xs font-semibold ${eligible ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {eligible ? '✓ Eligible' : '✗ Ineligible'}
                    </span>
                  </div>
                  {info?.reason && <p className="text-xs text-slate-500 leading-relaxed">{info.reason}</p>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        title={`Conditions / PTD List${totalConditions ? ` (${totalConditions})` : ''}`}
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
      >
        {conditionsIsObject && conditionCategories.length > 0 ? (
          <div className="space-y-5">
            {conditionCategories.map(([category, items]) => (
              <div key={category}>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">{category}</p>
                <BadgeList items={items} color="amber" />
              </div>
            ))}
          </div>
        ) : (
          <BadgeList items={flattenConditions(conditions)} color="amber" />
        )}
      </Section>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section
          title={`Risk Flags${result.risk_flags?.length ? ` (${result.risk_flags.length})` : ''}`}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>}
        >
          <BadgeList items={result.risk_flags} color="red" />
        </Section>
        <Section
          title={`Compensating Factors${result.compensating_factors?.length ? ` (${result.compensating_factors.length})` : ''}`}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
        >
          <BadgeList items={result.compensating_factors} color="emerald" />
        </Section>
      </div>

      {result.guideline_notes?.length > 0 && (
        <Section
          title="Guideline Notes"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          defaultOpen={false}
        >
          <div className="space-y-3">
            {result.guideline_notes.map((note, i) => {
              const status = note.status || 'INFO';
              const sc = { PASS: 'text-emerald-400 bg-emerald-900/30 border-emerald-800', FAIL: 'text-red-400 bg-red-900/30 border-red-800', WARN: 'text-amber-400 bg-amber-900/30 border-amber-800', INFO: 'text-blue-400 bg-blue-900/30 border-blue-800' }[status] || 'text-blue-400 bg-blue-900/30 border-blue-800';
              return (
                <div key={i} className={`border rounded-xl px-4 py-3 ${sc}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold opacity-80">{note.guideline || `Guideline ${i + 1}`}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sc}`}>{status}</span>
                  </div>
                  <p className="text-sm opacity-90">{note.note}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
