import React, { useRef, useState } from 'react';

const DOC_LABELS = ['1003 Application', 'Paystub', 'W2', 'Bank Statement', 'Tax Return', 'Credit Report', 'Purchase Contract', 'Other'];

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE_MB = 40;
const MAX_FILES = 15;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }) {
  if (type === 'application/pdf') {
    return (
      <div className="w-9 h-9 bg-red-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-red-400 text-xs font-bold">PDF</span>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 bg-[#86051b]/30 rounded-lg flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-[#ebe9d3]/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

export default function UploadArea({ files, setFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);

  function processFiles(incoming) {
    const errs = [];
    const valid = [];
    Array.from(incoming).forEach(f => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errs.push(`${f.name} exceeds ${MAX_SIZE_MB}MB limit`);
        return;
      }
      const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowed.includes(f.type)) {
        errs.push(`${f.name} is not a supported file type (PDF, JPG, PNG)`);
        return;
      }
      valid.push({ file: f, label: guessLabel(f.name), id: `${f.name}-${f.size}-${Date.now()}` });
    });
    setErrors(errs);
    setFiles(prev => {
      const existing = new Set(prev.map(p => p.id));
      const deduped = valid.filter(v => !existing.has(v.id));
      const next = [...prev, ...deduped];
      if (next.length > MAX_FILES) {
        setErrors(e => [...e, `Maximum ${MAX_FILES} files allowed`]);
        return next.slice(0, MAX_FILES);
      }
      return next;
    });
  }

  function guessLabel(name) {
    const n = name.toLowerCase();
    if (n.includes('1003') || n.includes('urla') || n.includes('application')) return '1003 Application';
    if (n.includes('paystub') || n.includes('pay_stub') || n.includes('paycheck')) return 'Paystub';
    if (n.includes('w2') || n.includes('w-2')) return 'W2';
    if (n.includes('bank') || n.includes('statement') || n.includes('chase') || n.includes('bofa') || n.includes('wells')) return 'Bank Statement';
    if (n.includes('1040') || n.includes('tax')) return 'Tax Return';
    if (n.includes('credit') || n.includes('report')) return 'Credit Report';
    if (n.includes('contract') || n.includes('purchase') || n.includes('psa')) return 'Purchase Contract';
    return 'Other';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }

  function handleChange(e) {
    processFiles(e.target.files);
    e.target.value = '';
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function updateLabel(id, label) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, label } : f));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Upload Documents</h2>
        {files.length > 0 && (
          <span className="text-xs text-[#ebe9d3]/50">{files.length} file{files.length !== 1 ? 's' : ''} ready</span>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-[#86051b] bg-[#86051b]/10'
            : 'border-slate-700 hover:border-[#86051b]/50 bg-slate-900/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={handleChange}
        />
        <svg className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-[#86051b]' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-slate-300 font-medium text-sm">Drop documents here or click to browse</p>
        <p className="text-slate-600 text-xs mt-1">PDF, JPG, PNG — up to {MAX_SIZE_MB}MB each — max {MAX_FILES} files</p>
        <p className="text-slate-600 text-xs mt-2">1003 · Paystubs · Bank Statements · W2s · Tax Returns</p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-red-400 text-xs">{e}</p>
          ))}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <FileIcon type={f.file.type} />

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{f.file.name}</p>
                <p className="text-[#ebe9d3]/40 text-xs">{formatBytes(f.file.size)}</p>
              </div>

              <select
                value={f.label}
                onChange={e => updateLabel(f.id, e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#86051b]"
              >
                {DOC_LABELS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              <button
                onClick={() => removeFile(f.id)}
                className="text-slate-600 hover:text-red-400 transition flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
