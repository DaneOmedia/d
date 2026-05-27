import React, { useState } from 'react';
import VerdictBadge from './VerdictBadge';

function fmt(val, prefix = '', suffix = '') {
  if (val === null || val === undefined || val === 0 || val === '') return '—';
  if (typeof val === 'number') {
    return `${prefix}${val.toLocaleString()}${suffix}`;
  }
  return `${prefix}${val}${suffix}`;
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
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
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
      <span className={`text-sm font-medium ml-4 text-right ${highlight ? 'text-yellow-300' : 'text-slate-200'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function BadgeList({ items, color }) {
  const colors = {
    red: 'bg-red-900/30 border-red-800 text-red-300',
    amber: 'bg-amber-900/30 border-amber-800 text-amber-300',
    emerald: 'bg-emerald-900/30 border-emerald-800 text-emerald-300',
    blue: 'bg-blue-900/30 border-blue-800 text-blue-300',
    slate: 'bg-slate-800/60 border-slate-700 text-slate-300',
  };
  if (!items || items.length === 0) {
    return <p className="text-slate-600 text-sm italic">None identified</p>;
  }
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
  const isWarn = value >= warnAt;
  const isOver = value >= max;
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

export default function Results({ result, loan }) {
  const d = result.extracted_data || {};
  const income = d.qualifying_income || {};
  const assets = d.liquid_assets || {};

  return (
    <div className="space-y-5">
      {/* Verdict + Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <VerdictBadge verdict={result.verdict} verdictCode={result.verdict_code} />

        {result.summary && (
          <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{loan.loanType}</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{loan.loanPurpose}</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{loan.occupancy}</span>
          {d.documents_reviewed?.length > 0 && (
            <span className="bg-slate-800 px-2.5 py-1 rounded-full">{d.documents_reviewed.length} docs reviewed</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Extracted Data */}
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

          {/* Income */}
          <div className="mt-4">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Qualifying Income</p>
            <div>
              {income.base_monthly > 0 && <DataRow label="Base Monthly" value={fmtUSD(income.base_monthly)} />}
              {income.variable_monthly > 0 && <DataRow label="Variable Monthly" value={fmtUSD(income.variable_monthly)} />}
              {income.other_monthly > 0 && <DataRow label="Other Monthly" value={fmtUSD(income.other_monthly)} />}
              <DataRow label="Total Monthly" value={fmtUSD(income.total_monthly)} />
              {income.calculation_method && <DataRow label="Method" value={income.calculation_method} />}
            </div>
            {income.income_notes && (
              <p className="text-slate-500 text-xs mt-2 italic">{income.income_notes}</p>
            )}
          </div>

          {/* Employment */}
          {d.employment?.employer && (
            <div className="mt-4">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Employment</p>
              <DataRow label="Employer" value={d.employment.employer} />
              {d.employment.years && <DataRow label="Years on Job" value={`${d.employment.years} yrs`} />}
              {d.employment.employment_type && <DataRow label="Type" value={d.employment.employment_type} />}
            </div>
          )}
        </Section>

        {/* DTI + Assets */}
        <div className="space-y-5">
          {/* DTI */}
          <Section
            title="Debt-to-Income Ratios"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          >
            <div className="space-y-5">
              {d.front_end_dti > 0 && (
                <DTIBar
                  label="Front-End (Housing) DTI"
                  value={d.front_end_dti}
                  max={loan.loanType === 'FHA' ? 31 : loan.loanType === 'USDA' ? 29 : 28}
                  warnAt={loan.loanType === 'FHA' ? 31 : 28}
                />
              )}
              {d.back_end_dti > 0 && (
                <DTIBar
                  label="Back-End (Total) DTI"
                  value={d.back_end_dti}
                  max={loan.loanType === 'FHA' ? 57 : loan.loanType === 'USDA' ? 44 : loan.loanType === 'VA' ? 41 : 50}
                  warnAt={loan.loanType === 'FHA' ? 43 : loan.loanType === 'VA' ? 41 : 45}
                />
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

          {/* Assets */}
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
              <DataRow
                label="Months Reserves"
                value={d.months_reserves ? `${Number(d.months_reserves).toFixed(1)} mo` : null}
                highlight={d.months_reserves && d.months_reserves < 2}
              />
            </div>
          </Section>

          {/* Derogatories */}
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

      {/* Conditions */}
      <Section
        title={`Conditions / PTD List${result.conditions?.length ? ` (${result.conditions.length})` : ''}`}
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
      >
        <BadgeList items={result.conditions} color="amber" />
      </Section>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Risk Flags */}
        <Section
          title={`Risk Flags${result.risk_flags?.length ? ` (${result.risk_flags.length})` : ''}`}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>}
        >
          <BadgeList items={result.risk_flags} color="red" />
        </Section>

        {/* Compensating Factors */}
        <Section
          title={`Compensating Factors${result.compensating_factors?.length ? ` (${result.compensating_factors.length})` : ''}`}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
        >
          <BadgeList items={result.compensating_factors} color="emerald" />
        </Section>
      </div>

      {/* Guideline Notes */}
      {result.guideline_notes?.length > 0 && (
        <Section
          title="Guideline Notes"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
        >
          <div className="space-y-3">
            {result.guideline_notes.map((note, i) => {
              const status = note.status || 'INFO';
              const statusColors = {
                PASS: 'text-emerald-400 bg-emerald-900/30 border-emerald-800',
                FAIL: 'text-red-400 bg-red-900/30 border-red-800',
                WARN: 'text-amber-400 bg-amber-900/30 border-amber-800',
                INFO: 'text-blue-400 bg-blue-900/30 border-blue-800',
              };
              const sc = statusColors[status] || statusColors.INFO;
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
