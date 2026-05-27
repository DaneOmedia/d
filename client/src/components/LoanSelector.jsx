import React from 'react';

const LOAN_TYPES = ['Conventional', 'FHA', 'VA', 'USDA'];
const LOAN_PURPOSES = ['Purchase', 'Rate-Term Refi', 'Cash-Out Refi'];
const OCCUPANCY = ['Primary', 'Second Home', 'Investment'];

const PROGRAM_INFO = {
  Conventional: { color: 'blue', label: 'Fnma / Fhlmc', notes: ['Min 620 FICO', 'Max 97% LTV (primary)', 'Max 50% DTI w/ DU Approve'] },
  FHA: { color: 'green', label: 'HUD / FHA', notes: ['Min 580 FICO (3.5% down)', '500-579 → 10% down', 'Max 57% DTI w/ comp. factors'] },
  VA: { color: 'yellow', label: 'VA Pamphlet 26-7', notes: ['No FICO min (lender 580+)', '100% LTV', '41% DTI guideline'] },
  USDA: { color: 'purple', label: 'USDA RD', notes: ['Min 640 FICO', '100% LTV + guarantee fee', 'Rural areas / income limits'] },
};

const colorMap = {
  blue: 'bg-blue-900/30 border-blue-800 text-blue-300',
  green: 'bg-green-900/30 border-green-800 text-green-300',
  yellow: 'bg-yellow-900/30 border-yellow-800 text-yellow-300',
  purple: 'bg-purple-900/30 border-purple-800 text-purple-300',
};

export default function LoanSelector({ loan, setLoan }) {
  const info = PROGRAM_INFO[loan.loanType];

  return (
    <div className="space-y-4">
      <h2 className="text-white font-semibold">Loan Parameters</h2>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Loan Type */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Loan Program</label>
          <div className="grid grid-cols-2 gap-2">
            {LOAN_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setLoan(prev => ({ ...prev, loanType: t }))}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
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

      {/* Program quick reference */}
      <div className={`border rounded-xl px-4 py-3 ${colorMap[info.color]}`}>
        <p className="text-xs font-semibold opacity-70 mb-1.5">{info.label} Key Guidelines</p>
        <ul className="space-y-0.5">
          {info.notes.map(n => (
            <li key={n} className="text-xs flex items-start gap-1.5">
              <span className="mt-0.5 opacity-60">·</span> {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
