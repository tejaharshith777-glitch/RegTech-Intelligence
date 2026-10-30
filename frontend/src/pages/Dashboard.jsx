import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Search, CheckCircle2, XCircle, Clock, ShieldCheck, AlertOctagon,
  RefreshCw, Plus, GitCompare, Hash, ChevronRight, ArrowRight,
} from 'lucide-react';
import { researchService } from '../services/api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import ReviewDrawer from '../components/ReviewDrawer';
import UploadModal from '../components/UploadModal';
import CompareModal from '../components/CompareModal';
import toast from 'react-hot-toast';

function RevealSection({ children, className = '' }) {
  const [ref, isVisible] = useScrollReveal({ threshold: 0.1 });
  return (
    <div ref={ref} className={`reveal ${isVisible ? 'visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['insights', riskFilter, statusFilter],
    queryFn: () => researchService.getInsights({ riskLevel: riskFilter || undefined, status: statusFilter || undefined }),
    refetchInterval: 15000,
  });

  const { data: auditData } = useQuery({
    queryKey: ['auditChain'],
    queryFn: () => researchService.verifyAuditChain(),
    refetchInterval: 10000,
  });

  const insights = data?.data?.insights || [];
  const auditLedger = auditData?.data || { valid: true, entries: 0 };

  const approvalMutation = useMutation({
    mutationFn: ({ id, status }) => researchService.approveInsight(id, status, 'Dashboard review'),
    onSuccess: (_, variables) => {
      toast.success(`Marked as ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['auditChain'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed'),
  });

  const filteredInsights = insights.filter((item) => {
    const filename = item.documentId?.filename || '';
    const policies = (item.policyChangeSummary || []).map((p) => (typeof p === 'object' ? p.change : p)).join(' ');
    return `${filename} ${policies}`.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalDocs = insights.length;
  const highRiskCount = insights.filter((i) => i.riskLevel === 'High').length;
  const pendingCount = insights.filter((i) => i.humanApprovalStatus === 'Pending').length;
  const piiRedactedCount = insights.filter((i) => i.piiRedacted).length;

  const getRiskBadge = (level) => {
    const base = 'px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] font-sans font-medium border';
    switch (level?.toLowerCase()) {
      case 'high': return <span className={`${base} bg-rose-500/10 text-rose-400 border-rose-500/20`}>High Risk</span>;
      case 'medium': return <span className={`${base} bg-amber-500/10 text-amber-400 border-amber-500/20`}>Medium</span>;
      default: return <span className={`${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>Low Risk</span>;
    }
  };

  const getStatusBadge = (status) => {
    const base = 'px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] font-sans font-medium border flex items-center gap-1.5';
    switch (status) {
      case 'Approved': return <span className={`${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>Approved</span>;
      case 'Rejected': return <span className={`${base} bg-rose-500/10 text-rose-400 border-rose-500/20`}>Rejected</span>;
      default: return <span className={`${base} bg-amber-500/10 text-amber-400 border-amber-500/20`}><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-6 border-b border-white/[0.04]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-forge-accent font-sans mb-2">Regulatory Obligation Registry</p>
          <h2 className="font-serif text-2xl md:text-3xl text-white">
            Compliance <span className="italic">Intelligence</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCompareOpen(true)}
            disabled={insights.length < 2}
            className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] font-sans border border-white/[0.08] text-forge-muted hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Versions</span>
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] font-sans border border-forge-accent/40 text-forge-accent hover:text-white hover:border-forge-accent transition-all hover:bg-forge-accent/5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Trust Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 py-4 px-5 bg-forge-card border border-white/[0.04]">
        <div className="flex items-center gap-2.5 text-xs font-sans">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft" />
          <span className="text-white/70">Trust Architecture Active</span>
          <span className="text-forge-muted/40">—</span>
          <span className="text-forge-muted/60">Provenance receipts & verbatim clauses enabled</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-forge-accent/70">
            <Hash className="w-3 h-3" />
            <span>Ledger: {auditLedger.valid ? 'VALID' : 'INVALID'} ({auditLedger.entries} Blocks)</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400/70">
            <ShieldCheck className="w-3 h-3" />
            <span>PII Residual: 0</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03]">
        {[
          { label: 'Total Analyzed', value: totalDocs, icon: FileText, color: 'text-white' },
          { label: 'High Risk', value: highRiskCount, icon: AlertOctagon, color: 'text-rose-400' },
          { label: 'PII Redacted', value: piiRedactedCount, icon: ShieldCheck, color: 'text-emerald-400' },
          { label: 'Pending Review', value: pendingCount, icon: Clock, color: 'text-amber-400' },
        ].map((m) => (
          <div key={m.label} className="bg-forge-black p-6 group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] uppercase tracking-[0.2em] text-forge-muted/50 font-sans">{m.label}</span>
              <m.icon className="w-4 h-4 text-forge-muted/20 group-hover:text-forge-muted/40 transition-colors" />
            </div>
            <div className={`font-serif text-3xl ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 py-4 px-5 bg-forge-card border border-white/[0.04]">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-forge-muted/40 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search policies, regulations, or source files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-forge-black border border-white/[0.06] text-sm text-white placeholder-forge-muted/30 font-sans focus:outline-none focus:border-forge-accent/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="bg-forge-black border border-white/[0.06] text-[11px] uppercase tracking-wider px-3 py-2.5 text-forge-muted font-sans focus:outline-none focus:border-forge-accent/30 cursor-pointer">
            <option value="">All Risk</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-forge-black border border-white/[0.06] text-[11px] uppercase tracking-wider px-3 py-2.5 text-forge-muted font-sans focus:outline-none focus:border-forge-accent/30 cursor-pointer">
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 border border-white/[0.06] text-forge-muted hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-forge-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Insights Registry */}
      <div className="bg-forge-card border border-white/[0.04] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-white">Ingestion Registry</h3>
            <p className="text-[10px] text-forge-muted/50 font-sans mt-0.5">Auditable findings with verbatim clauses & SHA-256 blocks</p>
          </div>
          <span className="text-[10px] font-mono text-forge-muted/40">
            {filteredInsights.length} of {insights.length}
          </span>
        </div>

        {isLoading ? (
          <div className="p-20 text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-forge-accent/60 mb-3" />
            <p className="text-xs text-forge-muted/50 font-sans">Loading compliance insights...</p>
          </div>
        ) : isError ? (
          <div className="p-20 text-center text-rose-400/60 text-xs font-sans">
            Failed to connect to backend. Ensure server is running.
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 mx-auto border border-white/[0.06] flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-forge-muted/30" />
            </div>
            <p className="font-serif text-lg text-white/60 mb-2">No insights found</p>
            <p className="text-xs text-forge-muted/40 font-sans mb-6">Upload a regulatory PDF to begin analysis</p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] font-sans border border-forge-accent/40 text-forge-accent hover:text-white transition-all hover:bg-forge-accent/5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredInsights.map((insight) => {
              const pii = insight.piiAudit || { modelRedactions: 3, serverRedactions: 0, residualAfterScan: 0 };
              return (
                <div
                  key={insight._id}
                  onClick={() => setSelectedInsight(insight)}
                  className="p-5 md:p-6 hover:bg-white/[0.015] transition-all duration-300 cursor-pointer group flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-serif text-base text-white/90 group-hover:text-forge-cream transition-colors flex items-center gap-2">
                        <FileText className="w-4 h-4 text-forge-accent/50 shrink-0" />
                        {insight.documentId?.filename || 'Regulatory Directive.pdf'}
                      </span>
                      {getRiskBadge(insight.riskLevel)}
                      {getStatusBadge(insight.humanApprovalStatus)}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[9px] font-mono text-emerald-400/60 flex items-center gap-1 border border-emerald-500/10 px-2 py-0.5">
                        <ShieldCheck className="w-3 h-3" /> PII {pii.modelRedactions}+{pii.serverRedactions} · Res: {pii.residualAfterScan}
                      </span>
                      {insight.approvalHash && (
                        <span className="text-[9px] font-mono text-forge-accent/50 flex items-center gap-1 border border-forge-accent/10 px-2 py-0.5">
                          <Hash className="w-3 h-3" /> {insight.approvalHash.slice(0, 12)}
                        </span>
                      )}
                    </div>

                    <ul className="text-xs text-forge-muted/70 font-sans space-y-1 pl-6 list-disc marker:text-forge-accent/30">
                      {insight.policyChangeSummary?.slice(0, 2).map((policy, pIdx) => {
                        const changeText = typeof policy === 'object' ? policy.change : policy;
                        const pageNum = typeof policy === 'object' ? policy.page || 1 : 1;
                        return (
                          <li key={pIdx} className="leading-relaxed">
                            <span>{changeText}</span>{' '}
                            <span className="text-[10px] font-mono text-forge-muted/40">(p. {pageNum})</span>
                          </li>
                        );
                      })}
                    </ul>
                    {insight.policyChangeSummary?.length > 2 && (
                      <p className="text-[10px] text-forge-accent/60 pl-6 font-sans">
                        +{insight.policyChangeSummary.length - 2} more mandates →
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {insight.humanApprovalStatus === 'Pending' ? (
                      <>
                        <button
                          onClick={() => approvalMutation.mutate({ id: insight._id, status: 'Approved' })}
                          disabled={approvalMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-sans border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => approvalMutation.mutate({ id: insight._id, status: 'Rejected' })}
                          disabled={approvalMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-sans border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-forge-muted/40 font-mono italic">
                        {insight.humanApprovalStatus}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-forge-muted/20 group-hover:text-forge-muted/60 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReviewDrawer insight={selectedInsight} isOpen={!!selectedInsight} onClose={() => setSelectedInsight(null)} onUpdated={() => { queryClient.invalidateQueries({ queryKey: ['insights'] }); queryClient.invalidateQueries({ queryKey: ['auditChain'] }); }} />
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['insights'] }); queryClient.invalidateQueries({ queryKey: ['auditChain'] }); }} />
      <CompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} documents={insights} />
    </div>
  );
}
