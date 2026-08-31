import React from 'react';

const AGENCY_TYPES = ['Conventional', 'FHA', 'VA', 'USDA'];
const NONQM_TYPES  = ['DSCR', 'Bank Statement', 'P&L Only', '1099 Only', 'Asset Utilization', 'WVOE', 'ITIN', 'Foreign National'];
const LOAN_PURPOSES = ['Purchase', 'Rate-Term Refi', 'Cash-Out Refi'];
const OCCUPANCY     = ['Primary', 'Second Home', 'Investment'];

const PROGRAM_INFO = {
  Conventional:      { color: 'blue',   label: 'Fnma / Fhlmc',         notes: ['Min 620 FICO', 'Max 97% LTV (primary)', 'Max 50% DTI w/ DU Approve'] },
  FHA:               { color: 'green',  label: 'HUD / FHA',             notes: ['Min 580 FICO (3.5% down)', '500-579 → 10% down', 'Max 57% DTI w/ comp. factors'] },
  VA:                { color: 'yellow', label: 'VA Pamphlet 26-7',       notes: ['No FICO min (lender 580+)', '100% LTV', '41% DTI guideline'] },
  USDA:              { color: 'purple', label: 'USDA RD',                notes: ['Min 640 FICO', '100% LTV + guarantee fee', 'Rural areas / income limits'] },
  DSCR:              { color: 'orange', label: 'Non-QM — Investment',    notes: ['No personal income used', 'DSCR = Gross Rent ÷ PITIA', 'DSCR ≥ 1.0 typical floor'] },
  'Bank Statement':  { color: 'teal',   label: 'Non-QM — Alt Doc',       notes: ['12 or 24 months stmts', 'Personal: 100% deposits', 'Business: 50% expense factor'] },
  'P&L Only':        { color: 'indigo', label: 'Non-QM — CPA P&L',       notes: ['CPA/EA-prepared P&L required', '12 or 24 months', 'No tax returns needed'] },
  '1099 Only':       { color: 'pink',   label: 'Non-QM — 1099',          notes: ['1-2 years 1099s', '10% default expense factor', 'No full tax returns required'] },
  'Asset Utilization':{ color:'amber',  label: 'Non-QM — Asset Dep.',    notes: ['Eligible assets ÷ 240 mo', 'Net of down pmt + closing + reserves', 'Retirement: investor-specific haircut'] },
  WVOE:              { color: 'slate',  label: 'Non-QM — Written VOE',   notes: ['WVOE from employer required', 'No paystubs or W2s', 'Employer verification call typical'] },
  ITIN:              { color: 'rose',   label: 'Non-QM — ITIN',          notes: ['ITIN instead of SSN', 'Income path per document type', 'ITIN-accepting investors only'] },
  'Foreign National':{ color: 'violet', label: 'Non-QM — Foreign Natl', notes: ['Foreign income + assets', 'Often DSCR if investment', 'Larger down payment required'] },
};

const colorMap = {
  blue:   'bg-blue-900/30 border-blue-800 text-blue-300',
  green:  'bg-green-900/30 border-green-800 text-green-300',
  yellow: 'bg-yellow-900/30 border-yellow-800 text-yellow-300',
  purple: 'bg-purple-900/30 border-purple-800 text-purple-300',
  orange: 'bg-orange-900/30 border-orange-800 text-orange-300',
  teal:   'bg-teal-900/30 border-teal-800 text-teal-300',
  indigo: 'bg-indigo-900/30 border-indigo-800 text-indigo-300',
  pink:   'bg-pink-900/30 border-pink-800 text-pink-300',
  amber:  'bg-amber-900/30 border-amber-800 text-amber-300',
  slate:  'bg-slate-800/60 border-slate-700 text-slate-300',
  rose:   'bg-rose-900/30 border-rose-800 text-rose-300',
  violet: 'bg-violet-900/30 border-violet-800 text-violet-300',
};

export default function LoanSelector({ loan, setLoan }) {
  const isNonQM   = loan.programCategory === 'NonQM';
  const typeList  = isNonQM ? NONQM_TYPES : AGENCY_TYPES;
  const info      = PROGRAM_INFO[loan.loanType];

  function switchCategory(cat) {
    setLoan(prev => ({
      ...prev,
      programCategory: cat,
      loanType: cat === 'NonQM' ? 'DSCR' : 'Conventional',
    }));
  }

  return (
    <div className="space-y-4">
      <h2 className="text-white font-semibold">Loan Parameters</h2>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Category toggle */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Documentation Type</label>
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            {[['Agency', 'Agency / Full Doc'], ['NonQM', 'Non-QM / Alt Doc']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => switchCategory(val)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition ${
                  loan.programCategory === val
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Program / path selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {isNonQM ? 'Qualifying Path' : 'Loan Program'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {typeList.map(t => (
              <button
                key={t}
                onClick={() => setLoan(prev => ({ ...prev, loanType: t }))}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition text-left leading-tight ${
                  loan.loanType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Loan Purpose</label>
          <select
            value={loan.loanPurpose}
            onChange={e => setLoan(prev => ({ ...prev, loanPurpose: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LOAN_PURPOSES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Occupancy */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Occupancy</label>
          <select
            value={loan.occupancy}
            onChange={e => setLoan(prev => ({ ...prev, occupancy: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {OCCUPANCY.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Quick reference card */}
      {info && (
        <div className={`border rounded-xl px-4 py-3 ${colorMap[info.color] || colorMap.slate}`}>
          <p className="text-xs font-semibold opacity-70 mb-1.5">{info.label}</p>
          <ul className="space-y-0.5">
            {info.notes.map(n => (
              <li key={n} className="text-xs flex items-start gap-1.5">
                <span className="mt-0.5 opacity-60">·</span> {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
