import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Search, CheckCircle2, XCircle, Clock, ShieldCheck, AlertOctagon,
  RefreshCw, Plus, GitCompare, Hash, ChevronRight, Download, Table2,
  ShieldAlert, Lock, Inbox, Fingerprint, Settings2, AlertTriangle,
} from 'lucide-react';
import { researchService, errorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';
import ReviewDrawer from '../components/ReviewDrawer';
import CompareModal from '../components/CompareModal';
import ApplicabilityGate from '../components/ApplicabilityGate';
import toast from 'react-hot-toast';

const APPLICABILITY_STYLES = {
  APPLIES: { label: 'Applies', className: 'text-mint border-mint/40 bg-mint/10' },
  OUT_OF_SCOPE: { label: 'Out of scope', className: 'text-forge-dim border-forge-border bg-forge-dark' },
  UNCLEAR: { label: 'Unclear', className: 'text-amber border-amber/40 bg-amber/10' },
};

const currency = (n) => new Intl.NumberFormat('en-IN').format(n);

export default function Dashboard({ onOpenUpload }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [selected, setSelected] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appliesFilter, setAppliesFilter] = useState(''); // '' | APPLIES | OUT_OF_SCOPE | UNCLEAR
  const [scopeOpen, setScopeOpen] = useState(false);
  const [exportingId, setExportingId] = useState(null);

  const {
    data, isLoading, isError, error, refetch, isFetching,
  } = useQuery({
    queryKey: ['insights', riskFilter, statusFilter],
    queryFn: () => researchService.getInsights({
      riskLevel: riskFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  const { data: auditData, isError: auditError } = useQuery({
    queryKey: ['auditChain'],
    queryFn: () => researchService.verifyAuditChain(),
  });

  const insights = data?.data?.insights || [];
  const triage = data?.data?.triage || { obligations: 0, applies: 0, outOfScope: 0, unclear: 0, needsReview: 0 };
  const ledger = auditData?.data;

  const pendingCount = insights.filter((i) => i.humanApprovalStatus === 'Pending').length;
  const highRisk = insights.filter((i) => i.riskLevel === 'High').length;
  const piiCount = insights.reduce(
    (sum, i) => sum + (i.piiAudit?.modelRedactions || 0) + (i.piiAudit?.serverRedactions || 0),
    0
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return insights.filter((insight) => {
      const haystack = [
        insight.documentId?.filename || '',
        ...(insight.policyChangeSummary || []).map((p) => `${p.change} ${p.verbatimClause || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;

      if (appliesFilter) {
        const has = (insight.policyChangeSummary || []).some((p) => p.applicability === appliesFilter);
        if (!has) return false;
      }
      return true;
    });
  }, [insights, search, appliesFilter]);

  const exportOne = async (insight, kind) => {
    setExportingId(`${insight._id}-${kind}`);
    try {
      if (kind === 'pack') await researchService.downloadAuditPack(insight._id);
      else await researchService.downloadObligationsCsv(insight._id);
      toast.success(kind === 'pack' ? 'Audit pack downloaded' : 'CSV downloaded');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExportingId(null);
    }
  };

  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['auditChain'] });
  };

  /* ── Loading ─────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <RefreshCw className="w-6 h-6 animate-spin text-forge-accent" />
        <p className="text-sm text-forge-muted">Loading your obligations…</p>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────── */
  if (isError) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <div className="w-12 h-12 mx-auto rounded-lg bg-coral/10 border border-coral/30 flex items-center justify-center mb-5">
          <AlertTriangle className="w-5 h-5 text-coral" />
        </div>
        <h2 className="font-serif text-2xl text-white mb-3">Could not load obligations</h2>
        <p className="text-sm text-forge-muted mb-6 leading-relaxed">{errorMessage(error)}</p>
        <button onClick={refreshAll} className="btn-primary">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Obligation registry</p>
          <h1 className="font-serif text-3xl md:text-4xl text-white leading-tight">
            Compliance <span className="italic text-gradient-gold">intelligence</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setScopeOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded border border-forge-border text-2xs uppercase tracking-[0.12em] text-forge-muted hover:text-forge-text hover:border-forge-accent/50 transition-colors"
            style={{ borderColor: '#252a3a' }}
            title="Change the entity types used to triage obligations"
          >
            <Settings2 className="w-3.5 h-3.5" />
            My scope
          </button>

          <button
            onClick={() => setCompareOpen(true)}
            disabled={insights.length < 2}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded border border-forge-border text-2xs uppercase tracking-[0.12em] text-forge-muted hover:text-forge-text hover:border-forge-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: '#252a3a' }}
            title={insights.length < 2 ? 'Upload at least two circulars to compare versions' : 'Compare two circulars'}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare
          </button>

          <button onClick={onOpenUpload} className="btn-primary !py-2.5 !px-5 !text-2xs">
            <Plus className="w-3.5 h-3.5" />
            Upload circular
          </button>
        </div>
      </div>

      {/* ── Triage bar (every number is a filter) ───────────── */}
      <div className="rounded-lg bg-forge-card border border-forge-border p-4" style={{ borderColor: '#252a3a' }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-sm">
            <span className="text-forge-text font-medium">{currency(triage.obligations)} obligations</span>
            <span className="text-forge-dim">·</span>
            <button
              onClick={() => setAppliesFilter(appliesFilter === 'APPLIES' ? '' : 'APPLIES')}
              className={`px-2 py-0.5 rounded text-mint hover:bg-mint/10 transition-colors ${appliesFilter === 'APPLIES' ? 'bg-mint/10 underline' : ''}`}
            >
              {triage.applies + triage.unclear > 0 ? triage.applies : 0} apply to you
            </button>
            <span className="text-forge-dim">·</span>
            <button
              onClick={() => setAppliesFilter(appliesFilter === 'OUT_OF_SCOPE' ? '' : 'OUT_OF_SCOPE')}
              className={`px-2 py-0.5 rounded text-forge-muted hover:bg-white/5 transition-colors ${appliesFilter === 'OUT_OF_SCOPE' ? 'bg-white/5 underline' : ''}`}
            >
              {triage.outOfScope} out of scope
            </button>
            <span className="text-forge-dim">·</span>
            <button
              onClick={() => setAppliesFilter(appliesFilter === 'UNCLEAR' ? '' : 'UNCLEAR')}
              className={`px-2 py-0.5 rounded text-amber hover:bg-amber/10 transition-colors ${appliesFilter === 'UNCLEAR' ? 'bg-amber/10 underline' : ''}`}
            >
              {triage.unclear} need judgement
            </button>
            {appliesFilter && (
              <button
                onClick={() => setAppliesFilter('')}
                className="ml-1 text-2xs uppercase tracking-[0.12em] text-forge-dim hover:text-forge-text underline"
              >
                clear
              </button>
            )}
          </div>

          {/* Ledger state */}
          <div className="flex items-center gap-3 text-2xs font-mono">
            {auditError ? (
              <span className="text-coral flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> ledger unreachable
              </span>
            ) : ledger ? (
              <span className={`flex items-center gap-1.5 ${ledger.valid ? 'text-mint' : 'text-coral'}`}>
                <Hash className="w-3 h-3" />
                ledger {ledger.valid ? 'valid' : 'BROKEN'} · {ledger.entries} blocks
              </span>
            ) : (
              <span className="text-forge-dim flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" /> checking ledger
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Circulars ingested', value: insights.length, icon: FileText, color: '#eef1f8' },
          { label: 'High risk', value: highRisk, icon: AlertOctagon, color: '#ff7a90' },
          { label: 'Awaiting decision', value: pendingCount, icon: Clock, color: '#fbbf24' },
          { label: 'PII redactions', value: piiCount, icon: ShieldCheck, color: '#4ade9c' },
        ].map((m) => (
          <div key={m.label} className="rounded-lg bg-forge-card border border-forge-border p-4" style={{ borderColor: '#252a3a' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs uppercase tracking-[0.12em] text-forge-dim">{m.label}</span>
              <m.icon className="w-4 h-4" style={{ color: m.color, opacity: 0.75 }} />
            </div>
            <div className="font-serif text-3xl" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-forge-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Search circulars, obligations or clause text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10"
            aria-label="Search obligations"
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="input-base sm:w-40 cursor-pointer"
          aria-label="Filter by risk"
        >
          <option value="">All risk</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base sm:w-44 cursor-pointer"
          aria-label="Filter by decision status"
        >
          <option value="">All decisions</option>
          <option value="Pending">Awaiting decision</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>

        <button
          onClick={refreshAll}
          disabled={isFetching}
          className="px-4 rounded border border-forge-border text-forge-muted hover:text-forge-text transition-colors disabled:opacity-50"
          style={{ borderColor: '#252a3a' }}
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-forge-accent' : ''}`} />
        </button>
      </div>

      {/* ── Registry ────────────────────────────────────────── */}
      {insights.length === 0 ? (
        <EmptyState onOpenUpload={onOpenUpload} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg bg-forge-card border border-forge-border py-16 text-center" style={{ borderColor: '#252a3a' }}>
          <Search className="w-6 h-6 text-forge-dim mx-auto mb-4" />
          <p className="font-serif text-lg text-forge-text mb-1.5">No obligations match those filters</p>
          <p className="text-sm text-forge-muted mb-5">Try clearing the search or the triage filter.</p>
          <button
            onClick={() => { setSearch(''); setAppliesFilter(''); setRiskFilter(''); setStatusFilter(''); }}
            className="btn-ghost !py-2.5 !px-5 !text-2xs"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((insight) => {
            const obligations = insight.policyChangeSummary || [];
            const applies = obligations.filter((o) => o.applicability === 'APPLIES').length;
            const decided = insight.humanApprovalStatus !== 'Pending';

            return (
              <article
                key={insight._id}
                className="rounded-lg bg-forge-card border border-forge-border hover:border-forge-accent/30 transition-colors overflow-hidden"
                style={{ borderColor: '#252a3a' }}
              >
                <div className="p-5">
                  {/* Title row */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <button onClick={() => setSelected(insight)} className="flex items-start gap-2.5 text-left group flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-forge-accent shrink-0 mt-1" />
                      <span className="min-w-0">
                        <span className="block font-serif text-lg text-forge-cream group-hover:text-forge-gold transition-colors truncate">
                          {insight.documentId?.filename || 'Regulatory circular'}
                        </span>
                        <span className="block text-2xs text-forge-dim mt-0.5">
                          {obligations.length} obligation{obligations.length === 1 ? '' : 's'}
                          {applies > 0 && ` · ${applies} apply to you`}
                          {insight.createdAt && ` · ingested ${new Date(insight.createdAt).toLocaleDateString()}`}
                        </span>
                      </span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <RiskBadge level={insight.riskLevel} />
                      <StatusBadge status={insight.humanApprovalStatus} />
                    </div>
                  </div>

                  {/* Obligation previews (two layers) */}
                  <div className="space-y-2 mb-4">
                    {obligations.slice(0, 2).map((ob, idx) => (
                      <div key={idx} className="p-3 rounded bg-forge-black/60 border border-forge-border" style={{ borderColor: '#252a3a' }}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <TierChip tier={ob.obligation} />
                          <ApplicabilityChip value={ob.applicability} />
                          {ob.verbatimClause ? (
                            <span className="flex items-center gap-1 text-3xs font-mono text-mint">
                              <Fingerprint className="w-3 h-3" /> p.{ob.page}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-3xs font-mono text-amber">
                              <AlertTriangle className="w-3 h-3" /> no verifiable clause
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-forge-text leading-relaxed">{ob.change}</p>
                        {ob.verbatimClause && (
                          <p className="mt-1.5 text-xs text-forge-dim italic line-clamp-1">
                            “{ob.verbatimClause}”
                          </p>
                        )}
                      </div>
                    ))}
                    {obligations.length > 2 && (
                      <button
                        onClick={() => setSelected(insight)}
                        className="text-2xs text-forge-gold hover:underline pl-1"
                      >
                        + {obligations.length - 2} more →
                      </button>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-forge-border" style={{ borderColor: '#252a3a' }}>
                    <div className="flex items-center gap-2">
                      {decided ? (
                        <span className="text-2xs text-forge-dim flex items-center gap-1.5">
                          <Lock className="w-3 h-3" />
                          {insight.humanApprovalStatus} by {insight.approvedBy?.username || 'unknown'}
                          {insight.approvedAt && ` · ${new Date(insight.approvedAt).toLocaleDateString()}`}
                        </span>
                      ) : (
                        <span className="text-2xs text-amber flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Awaiting administrator decision
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportOne(insight, 'csv')}
                        disabled={exportingId === `${insight._id}-csv`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-forge-border text-3xs uppercase tracking-[0.1em] text-forge-muted hover:text-forge-text hover:border-forge-accent/40 transition-colors disabled:opacity-50"
                        style={{ borderColor: '#252a3a' }}
                        title="Download obligations as CSV"
                      >
                        <Table2 className="w-3 h-3" /> CSV
                      </button>
                      <button
                        onClick={() => exportOne(insight, 'pack')}
                        disabled={exportingId === `${insight._id}-pack`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-forge-border text-3xs uppercase tracking-[0.1em] text-forge-muted hover:text-forge-text hover:border-forge-accent/40 transition-colors disabled:opacity-50"
                        style={{ borderColor: '#252a3a' }}
                        title="Download the audit pack"
                      >
                        <Download className="w-3 h-3" /> Audit pack
                      </button>
                      <button
                        onClick={() => setSelected(insight)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-forge-raised text-3xs uppercase tracking-[0.1em] text-forge-text hover:bg-forge-accent/15 hover:text-forge-gold transition-colors"
                      >
                        Review <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Non-admin notice, visible without opening the drawer */}
                {!decided && !isAdmin && (
                  <div className="px-5 py-2.5 bg-forge-dark/60 border-t border-forge-border flex items-center gap-2 text-2xs text-forge-dim" style={{ borderColor: '#252a3a' }}>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    You can read and request clarification. Approval requires an administrator.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ReviewDrawer
        insight={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onUpdated={refreshAll}
      />

      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} documents={insights} />

      {scopeOpen && (
        <ApplicabilityGate
          onDone={() => setScopeOpen(false)}
          onSkip={() => setScopeOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Small pieces ───────────────────────────────────────────── */

function EmptyState({ onOpenUpload }) {
  return (
    <div className="rounded-lg bg-forge-card border border-dashed border-forge-border py-20 px-6 text-center" style={{ borderColor: '#2f3548' }}>
      <div className="w-14 h-14 mx-auto rounded-lg bg-forge-accent/10 border border-forge-accent/30 flex items-center justify-center mb-5">
        <Inbox className="w-6 h-6 text-forge-accent" />
      </div>
      <h2 className="font-serif text-2xl text-white mb-2">No circulars yet</h2>
      <p className="text-sm text-forge-muted max-w-sm mx-auto mb-7 leading-relaxed">
        Drop your first regulatory PDF here. You will get obligations with verified clauses,
        PII redaction proof, and a triage against your declared scope.
      </p>
      <button onClick={onOpenUpload} className="btn-primary">
        <Plus className="w-4 h-4" /> Upload your first circular
      </button>
      <p className="text-3xs text-forge-dim mt-5">
        Sample circulars are built in if you do not have a PDF handy.
      </p>
    </div>
  );
}

function RiskBadge({ level }) {
  const styles =
    level === 'High'
      ? 'text-coral border-coral/40 bg-coral/10'
      : level === 'Medium'
        ? 'text-amber border-amber/40 bg-amber/10'
        : 'text-mint border-mint/40 bg-mint/10';
  return (
    <span className={`px-2 py-1 rounded border text-3xs uppercase tracking-[0.12em] ${styles}`}>
      {level || 'Low'}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    Approved: { cls: 'text-mint border-mint/40 bg-mint/10', Icon: CheckCircle2 },
    Rejected: { cls: 'text-coral border-coral/40 bg-coral/10', Icon: XCircle },
    Pending: { cls: 'text-amber border-amber/40 bg-amber/10', Icon: Clock },
  };
  const { cls, Icon } = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-3xs uppercase tracking-[0.12em] ${cls}`}>
      <Icon className="w-3 h-3" />
      {status === 'Pending' ? 'Awaiting' : status}
    </span>
  );
}

function TierChip({ tier }) {
  const map = {
    MANDATORY: 'text-coral border-coral/40 bg-coral/10',
    RECOMMENDED: 'text-amber border-amber/40 bg-amber/10',
    ADVISORY: 'text-sky border-sky/40 bg-sky/10',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded border text-3xs font-mono uppercase ${map[tier] || map.MANDATORY}`}>
      {tier || 'MANDATORY'}
    </span>
  );
}

function ApplicabilityChip({ value }) {
  const style = APPLICABILITY_STYLES[value] || APPLICABILITY_STYLES.UNCLEAR;
  return (
    <span className={`px-1.5 py-0.5 rounded border text-3xs uppercase tracking-[0.1em] ${style.className}`}>
      {style.label}
    </span>
  );
}
