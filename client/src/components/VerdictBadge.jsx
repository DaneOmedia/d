import React from 'react';

const CONFIG = {
  APPROVE: {
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-600',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    label: 'APPROVE / ELIGIBLE',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  AWC: {
    bg: 'bg-amber-900/40',
    border: 'border-amber-600',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    label: 'APPROVE WITH CONDITIONS',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  'APPROVE WITH CONDITIONS': {
    bg: 'bg-amber-900/40',
    border: 'border-amber-600',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    label: 'APPROVE WITH CONDITIONS',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  SUSPEND: {
    bg: 'bg-orange-900/40',
    border: 'border-orange-600',
    text: 'text-orange-300',
    dot: 'bg-orange-400',
    label: 'SUSPEND',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  INELIGIBLE: {
    bg: 'bg-red-900/40',
    border: 'border-red-600',
    text: 'text-red-300',
    dot: 'bg-red-500',
    label: 'INELIGIBLE',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export default function VerdictBadge({ verdict, verdictCode }) {
  const key = verdictCode || verdict || 'SUSPEND';
  const cfg = CONFIG[key] || CONFIG[verdict] || CONFIG.SUSPEND;

  return (
    <div className={`inline-flex items-center gap-3 ${cfg.bg} border ${cfg.border} rounded-2xl px-5 py-3`}>
      <span className={`${cfg.text}`}>{cfg.icon}</span>
      <div>
        <p className="text-slate-400 text-xs">Pre-Underwrite Verdict</p>
        <p className={`font-bold text-lg leading-tight ${cfg.text}`}>{cfg.label}</p>
      </div>
      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} animate-pulse ml-1`} />
    </div>
  );
}
