import React, { useState } from 'react';
import {
  GitCompare,
  X,
  PlusCircle,
  MinusCircle,
  Edit3,
  Loader2,
  FileText,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { researchService } from '../services/api';
import toast from 'react-hot-toast';

export default function CompareModal({ isOpen, onClose, documents = [] }) {
  const [docA, setDocA] = useState('');
  const [docB, setDocB] = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCompare = async () => {
    if (!docA || !docB) {
      toast.error('Select two regulatory documents to compare');
      return;
    }
    if (docA === docB) {
      toast.error('Select two distinct document versions');
      return;
    }

    setLoading(true);
    setDiffResult(null);

    try {
      const res = await researchService.compareDocuments(docA, docB);
      setDiffResult(res.data);
      toast.success('Version comparison complete!');
    } catch (err) {
      console.error('Diff error:', err);
      const msg = err.response?.data?.message || err.message || 'Comparison failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#0a0a0c] border border-white/[0.08] rounded-sm shadow-2xl p-6 md:p-8 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-forge-accent/10 border border-forge-accent/30 flex items-center justify-center text-forge-accent">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-xl text-white tracking-wide">Regulatory Version Diff Engine</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-forge-muted font-sans mt-0.5">Track obligation additions, removals, and threshold shifts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-forge-muted hover:text-white rounded hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Selectors */}
        <div className="py-5 border-b border-white/[0.06] shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-sans uppercase tracking-[0.2em] text-forge-muted">
              Base Mandate (Version 1)
            </label>
            <select
              value={docA}
              onChange={(e) => setDocA(e.target.value)}
              className="w-full p-2.5 bg-[#111114] border border-white/[0.08] rounded-sm text-xs text-forge-cream focus:outline-none focus:border-forge-accent/50 font-sans"
            >
              <option value="">Select Document A...</option>
              {documents.map((d) => (
                <option key={d.documentId?._id || d._id} value={d.documentId?._id || d._id}>
                  {d.documentId?.filename || 'Document'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-sans uppercase tracking-[0.2em] text-forge-muted">
              Target Mandate (Version 2)
            </label>
            <select
              value={docB}
              onChange={(e) => setDocB(e.target.value)}
              className="w-full p-2.5 bg-[#111114] border border-white/[0.08] rounded-sm text-xs text-forge-cream focus:outline-none focus:border-forge-accent/50 font-sans"
            >
              <option value="">Select Document B...</option>
              {documents.map((d) => (
                <option key={d.documentId?._id || d._id} value={d.documentId?._id || d._id}>
                  {d.documentId?.filename || 'Document'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff Results Container */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
              <div className="text-xs">Computing structural diff between obligations...</div>
            </div>
          ) : !diffResult ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Select two documents above and click <b>"Compare Versions"</b> to view obligation evolution.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Diff Summary Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-center">
                  <div className="text-lg font-bold text-emerald-400">
                    +{diffResult.diffSummary?.addedCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Added Obligations
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/20 text-center">
                  <div className="text-lg font-bold text-rose-400">
                    -{diffResult.diffSummary?.removedCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Removed / Sunset
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-center">
                  <div className="text-lg font-bold text-amber-400">
                    ~{diffResult.diffSummary?.modifiedCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Modified Thresholds
                  </div>
                </div>
              </div>

              {/* Added Obligations */}
              {diffResult.added?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Newly Added Obligations (Present in V2 only)</span>
                  </div>
                  <div className="space-y-1.5">
                    {diffResult.added.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs text-slate-200"
                      >
                        <div className="font-semibold text-emerald-300">
                          {item.change || item}
                        </div>
                        {item.verbatimClause && (
                          <div className="font-serif italic text-slate-400 text-[11px] mt-1 pl-2 border-l border-emerald-500/30">
                            "{item.verbatimClause}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modified Obligations */}
              {diffResult.modified?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Amended Clauses & Scope Shifts</span>
                  </div>
                  <div className="space-y-2">
                    {diffResult.modified.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs space-y-1.5"
                      >
                        <div className="text-rose-300 line-through text-[11px]">
                          V1: {item.before}
                        </div>
                        <div className="text-emerald-300 font-semibold text-[11px]">
                          V2: {item.after}
                        </div>
                        {item.clauseRef && (
                          <div className="font-serif italic text-slate-400 text-[11px] pl-2 border-l border-amber-500/30">
                            "{item.clauseRef}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed Obligations */}
              {diffResult.removed?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>Removed or Replaced Mandates</span>
                  </div>
                  <div className="space-y-1.5">
                    {diffResult.removed.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 text-xs text-rose-300/80 line-through"
                      >
                        {item.change || item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] font-sans text-forge-muted hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={loading || !docA || !docB}
            onClick={handleCompare}
            className="flex items-center gap-2 px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] font-sans font-semibold text-black bg-white hover:bg-forge-cream rounded-sm shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
            <span>Compare Versions</span>
          </button>
        </div>
      </div>
    </div>
  );
}
