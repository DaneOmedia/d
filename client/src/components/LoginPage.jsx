import React, { useState } from 'react';
import axios from 'axios';

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { password });
      onLogin(data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-5">
            <img
              src="/OPTF_LOGO__2_.png"
              alt="Option Funding"
              className="h-24 w-auto object-contain"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Option Funding</h1>
          <p className="text-[#ebe9d3]/60 mt-1 text-sm">AI Pre-Underwrite Engine</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#ebe9d3]/80 mb-2">
                Team Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#86051b] focus:border-transparent transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#86051b] hover:bg-[#9e0720] disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[#86051b] focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Confidential — Authorized Use Only
        </p>
      </div>
    </div>
  );
}
