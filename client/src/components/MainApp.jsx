import React, { useState } from 'react';
import axios from 'axios';
import UploadArea from './UploadArea';
import LoanSelector from './LoanSelector';
import Results from './Results';

const INITIAL_LOAN = { loanType: 'Conventional', loanPurpose: 'Purchase', occupancy: 'Primary', programCategory: 'Agency' };

export default function MainApp({ token, onLogout }) {
  const [files, setFiles] = useState([]);
  const [loan, setLoan] = useState(INITIAL_LOAN);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('upload');

  async function handleAnalyze() {
    if (files.length === 0) return;
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f.file));
      formData.append('loanType', loan.loanType);
      formData.append('loanPurpose', loan.loanPurpose);
      formData.append('occupancy', loan.occupancy);
      const labels = {};
      files.forEach((f, i) => { labels[i] = f.label; });
      formData.append('labels', JSON.stringify(labels));

      const { data } = await axios.post('/api/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        timeout: 300000,
      });

      setResult(data);
      setStage('results');
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out after 5 minutes. Try with fewer or smaller documents.');
      } else {
        setError(err.response?.data?.error || 'Analysis failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleNewScenario() {
    setStage('upload');
    setResult(null);
    setError('');
  }

  function handleReset() {
    setFiles([]);
    setLoan(INITIAL_LOAN);
    setResult(null);
    setError('');
    setStage('upload');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/optf-logo.svg"
              alt="Option Funding"
              className="h-10 w-auto object-contain"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div>
              <h1 className="text-white font-bold text-base leading-none">Option Funding</h1>
              <p className="text-[#ebe9d3]/50 text-xs mt-0.5">AI Pre-Underwrite Engine</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-slate-500 hover:text-slate-300 text-sm transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {stage === 'upload' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <UploadArea files={files} setFiles={setFiles} />
              </div>
              <div className="space-y-5">
                <LoanSelector loan={loan} setLoan={setLoan} />
                <button
                  onClick={handleAnalyze}
                  disabled={files.length === 0 || loading}
                  className="w-full bg-[#86051b] hover:bg-[#9e0720] disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold py-4 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[#86051b] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing Documents...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Run Pre-Underwrite Analysis
                    </>
                  )}
                </button>
                {files.length === 0 && (
                  <p className="text-slate-600 text-xs text-center">Upload at least one document to begin</p>
                )}
                {loading && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                    <p className="text-[#ebe9d3]/70 text-sm">Claude is reading your documents...</p>
                    <p className="text-slate-600 text-xs mt-1">This can take 20–60 seconds depending on file size</p>
                  </div>
                )}
              </div>
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-xl px-5 py-4">
                <p className="font-medium text-sm">Analysis Error</p>
                <p className="text-xs mt-0.5 text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {stage === 'results' && result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Underwriting Analysis</h2>
              <div className="flex gap-3">
                <button
                  onClick={handleNewScenario}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  New Scenario (same docs)
                </button>
                <button
                  onClick={handleReset}
                  className="bg-[#86051b] hover:bg-[#9e0720] text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New File
                </button>
              </div>
            </div>
            <Results result={result} loan={loan} />
          </div>
        )}
      </main>
    </div>
  );
}
