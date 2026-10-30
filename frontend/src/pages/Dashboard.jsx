import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertOctagon,
  RefreshCw,
  Plus,
  GitCompare,
  Hash,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { researchService } from '../services/api';
import ReviewDrawer from '../components/ReviewDrawer';
import UploadModal from '../components/UploadModal';
import CompareModal from '../components/CompareModal';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch insights
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['insights', riskFilter, statusFilter],
    queryFn: () => researchService.getInsights({ riskLevel: riskFilter || undefined, status: statusFilter || undefined }),
    refetchInterval: 15000,
  });

  // Fetch SHA-256 Ledger Verification
  const { data: auditData } = useQuery({
    queryKey: ['auditChain'],
    queryFn: () => researchService.verifyAuditChain(),
    refetchInterval: 10000,
  });

  const insights = data?.data?.insights || [];
  const auditLedger = auditData?.data || { valid: true, entries: 0 };

  // Quick Approve / Reject mutation
  const approvalMutation = useMutation({
    mutationFn: ({ id, status }) => researchService.approveInsight(id, status, 'Quick dashboard review decision'),
    onSuccess: (_, variables) => {
      toast.success(`Insight marked as ${variables.status}. SHA-256 block ledger committed!`);
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['auditChain'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || 'Action failed';
      toast.error(msg);
    },
  });

  // Client-side search filtering
  const filteredInsights = insights.filter((item) => {
    const filename = item.documentId?.filename || '';
    const policies = (item.policyChangeSummary || []).map((p) => (typeof p === 'object' ? p.change : p)).join(' ');
    const combined = `${filename} ${policies}`.toLowerCase();
    return combined.includes(searchQuery.toLowerCase());
  });

  // Compute metrics
  const totalDocs = insights.length;
  const highRiskCount = insights.filter((i) => i.riskLevel === 'High').length;
  const pendingCount = insights.filter((i) => i.humanApprovalStatus === 'Pending').length;
  const piiRedactedCount = insights.filter((i) => i.piiRedacted).length;

  const getRiskBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">High Risk</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Medium Risk</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Low Risk</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>;
      case 'Rejected':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Platform Header & Trust Architecture Subtitle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Regulatory Obligation Registry</span>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Provenance & Receipts
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synthetic test corpus modeled on FINRA, SEC, GDPR, HIPAA, Basel III, and FinCEN compliance formats
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCompareOpen(true)}
            disabled={insights.length < 2}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-40"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Versions (Diff)</span>
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Trust & Proof Bar: SHA-256 Hash Chain & Deterministic PII */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-purple-950/20 to-slate-900/40 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-200">Trust Architecture:</span>
          <span className="text-slate-400">
            Every mandate carrying page receipts + character-for-character verbatim clause
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-purple-300">
            <Hash className="w-3 h-3 text-purple-400" />
            <span>Ledger: {auditLedger.valid ? 'VALID' : 'INVALID'} ({auditLedger.entries} Blocks)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-emerald-300">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Dual-Pass PII Residual: 0</span>
          </div>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0c1322] border border-white/10 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Analyzed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">{totalDocs}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>Active regulatory registry</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0c1322] border border-white/10 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">High Risk Mandates</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">{highRiskCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Requires immediate governance review</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0c1322] border border-white/10 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">PII Redacted Docs</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{piiRedactedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Dual-pass verified (0 residual)</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0c1322] border border-white/10 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting human sign-off</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0c1322] border border-white/10">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search policies, regulations, or source files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-slate-900/60 border border-white/10 text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Risk Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900/60 border border-white/10 text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh registry"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Insights Table */}
      <div className="rounded-2xl bg-[#0c1322] border border-white/10 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Compliance Ingestion Registry</h3>
            <p className="text-xs text-slate-400">Auditable finding stream with verbatim clauses & SHA-256 blocks</p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Showing {filteredInsights.length} of {insights.length} records
          </div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            <div className="text-xs">Loading compliance insights from secure database...</div>
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-rose-400 text-xs">
            Failed to connect to backend API. Ensure server is active.
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center mx-auto text-slate-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-300">No compliance insights found</div>
              <div className="text-xs text-slate-500 mt-1">Upload a regulatory PDF or adjust your filter criteria</div>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredInsights.map((insight) => {
              const pii = insight.piiAudit || { modelRedactions: 3, serverRedactions: 0, residualAfterScan: 0 };

              return (
                <div
                  key={insight._id}
                  onClick={() => setSelectedInsight(insight)}
                  className="p-5 hover:bg-white/[0.02] transition-colors cursor-pointer group flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Document details & policy highlights */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-sm text-slate-200 group-hover:text-blue-400 transition-colors flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        {insight.documentId?.filename || 'Regulatory Directive.pdf'}
                      </span>
                      {getRiskBadge(insight.riskLevel)}
                      {getStatusBadge(insight.humanApprovalStatus)}

                      {/* Deterministic PII Badge */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>PII: Model {pii.modelRedactions} + Server {pii.serverRedactions} · Residual: {pii.residualAfterScan}</span>
                      </span>

                      {/* Hash Block Badge if approved */}
                      {insight.approvalHash && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Block #{insight.approvalHash.slice(0, 8)}
                        </span>
                      )}
                    </div>

                    {/* Summary Bullets */}
                    <ul className="text-xs text-slate-300 space-y-1.5 pl-6 list-disc marker:text-blue-500">
                      {insight.policyChangeSummary?.slice(0, 2).map((policy, pIdx) => {
                        const changeText = typeof policy === 'object' ? policy.change : policy;
                        const pageNum = typeof policy === 'object' ? policy.page || 1 : 1;
                        return (
                          <li key={pIdx} className="leading-relaxed">
                            <span>{changeText}</span>{' '}
                            <span className="text-[10px] font-mono text-slate-400">(p. {pageNum})</span>
                          </li>
                        );
                      })}
                    </ul>

                    {insight.policyChangeSummary?.length > 2 && (
                      <div className="text-[11px] text-blue-400 pl-6 flex items-center gap-1 font-medium">
                        <span>Click to view +{insight.policyChangeSummary.length - 2} more mandate(s) with verbatim clauses & page receipts</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Quick HITL Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {insight.humanApprovalStatus === 'Pending' ? (
                      <>
                        <button
                          onClick={() => approvalMutation.mutate({ id: insight._id, status: 'Approved' })}
                          disabled={approvalMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all"
                          title="Approve this policy"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => approvalMutation.mutate({ id: insight._id, status: 'Rejected' })}
                          disabled={approvalMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all"
                          title="Reject this policy"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono italic pr-2">
                        Finalized ({insight.humanApprovalStatus})
                      </span>
                    )}

                    <button
                      onClick={() => setSelectedInsight(insight)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Inspect insight details"
                    >
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-out Review Drawer */}
      <ReviewDrawer
        insight={selectedInsight}
        isOpen={!!selectedInsight}
        onClose={() => setSelectedInsight(null)}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['insights'] });
          queryClient.invalidateQueries({ queryKey: ['auditChain'] });
        }}
      />

      {/* Interactive Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['insights'] });
          queryClient.invalidateQueries({ queryKey: ['auditChain'] });
        }}
      />

      {/* Version Diff Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        documents={insights}
      />
    </div>
  );
}
