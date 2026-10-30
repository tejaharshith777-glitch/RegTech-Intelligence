import React, { useEffect, useState } from 'react';
import {
  X, ShieldCheck, CheckCircle, XCircle, FileText, Loader2, Lock,
  ChevronDown, ChevronUp, Hash, Clock, Fingerprint, AlertTriangle,
  Download, Table2, HelpCircle, ShieldAlert, UserCheck,
} from 'lucide-react';
import { researchService, errorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const TIERS = {
  MANDATORY: 'text-coral border-coral/40 bg-coral/10',
  RECOMMENDED: 'text-amber border-amber/40 bg-amber/10',
  ADVISORY: 'text-sky border-sky/40 bg-sky/10',
};

const APPLICABILITY = {
  APPLIES: { label: 'Applies to you', cls: 'text-mint border-mint/40 bg-mint/10' },
  OUT_OF_SCOPE: { label: 'Out of scope', cls: 'text-forge-dim border-forge-border bg-forge-dark' },
  UNCLEAR: { label: 'Needs judgement', cls: 'text-amber border-amber/40 bg-amber/10' },
};

/**
 * Review drawer.
 *
 * Design rules baked in:
 *  - a control the server will refuse is never rendered as enabled
 *  - "Request clarification" is a question, not a decision: status stays Pending
 *  - a rejection requires a reason in the UI, matching the server's 422
 *  - decided findings show exactly who decided, when, and why
 */
export default function ReviewDrawer({ insight, isOpen, onClose, onUpdated }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [openClause, setOpenClause] = useState(null);
  const [decision, setDecision] = useState(null); // 'Approved' | 'Rejected' | 'clarify'
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    setDecision(null);
    setNote('');
    setError('');
    setOpenClause(null);
  }, [insight?._id]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !insight) return null;

  const obligations = insight.policyChangeSummary || [];
  const isFinalized = insight.humanApprovalStatus !== 'Pending';
  const pii = insight.piiAudit || { modelRedactions: 0, serverRedactions: 0, residualAfterScan: 0 };

  const submit = async () => {
    setError('');

    if (decision === 'Approved' || decision === 'Rejected') {
      if (!isAdmin) {
        setError('Only an administrator can approve or reject a finding.');
        return;
      }
      if (decision === 'Rejected' && note.trim().length < 10) {
        setError('A rejection reason of at least 10 characters is required.');
        return;
      }
    }
    if (decision === 'clarify' && note.trim().length < 5) {
      setError('Write the question you want answered (at least 5 characters).');
      return;
    }

    setBusy(true);
    try {
      if (decision === 'clarify') {
        await researchService.clarifyInsight(insight._id, note.trim());
        toast.success('Clarification requested. The finding stays open.');
      } else {
        await researchService.approveInsight(insight._id, decision, note.trim());
        toast.success(
          decision === 'Approved'
            ? 'Approved and sealed into the audit ledger'
            : 'Rejected and sealed into the audit ledger'
        );
      }
      onUpdated?.();
      onClose?.();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'pack') await researchService.downloadAuditPack(insight._id);
      else await researchService.downloadObligationsCsv(insight._id);
      toast.success('Download started');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Review finding"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-2xl h-full bg-forge-dark border-l border-forge-border flex flex-col animate-slide-left" style={{ borderColor: '#252a3a' }}>
        {/* Header */}
        <div className="p-5 border-b border-forge-border flex items-start justify-between gap-4" style={{ borderColor: '#252a3a' }}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded bg-forge-accent/10 border border-forge-accent/30 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-forge-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg text-forge-cream truncate">
                {insight.documentId?.filename || 'Regulatory circular'}
              </h2>
              <p className="text-3xs font-mono text-forge-dim mt-0.5 truncate">{insight._id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded text-forge-dim hover:text-forge-text hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status strip */}
          <div className="grid grid-cols-3 gap-2">
            <Meta label="Risk" value={insight.riskLevel || 'Low'} />
            <Meta label="Decision" value={insight.humanApprovalStatus} />
            <Meta label="Obligations" value={String(obligations.length)} />
          </div>

          {/* PII proof */}
          <div className="p-4 rounded-lg bg-mint/[0.06] border border-mint/25">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-mint">
                <ShieldCheck className="w-4 h-4" />
                Deterministic PII guard
              </div>
              <span className="text-3xs font-mono text-mint px-2 py-0.5 rounded bg-mint/15 border border-mint/30">
                residual {pii.residualAfterScan ?? 0}
              </span>
            </div>
            <p className="text-xs text-forge-muted leading-relaxed">
              The model is asked to redact identifiers. After it runs, a regex scan checks its
              output again — model redactions: {pii.modelRedactions ?? 0}, server redactions:{' '}
              {pii.serverRedactions ?? 0}.
            </p>
          </div>

          {/* Obligations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-2xs uppercase tracking-[0.16em] text-forge-dim">
                Obligations &amp; provenance
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => doExport('csv')}
                  disabled={exporting === 'csv'}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-forge-border text-3xs uppercase tracking-[0.1em] text-forge-dim hover:text-forge-text transition-colors disabled:opacity-50"
                  style={{ borderColor: '#252a3a' }}
                >
                  {exporting === 'csv' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Table2 className="w-3 h-3" />} CSV
                </button>
                <button
                  onClick={() => doExport('pack')}
                  disabled={exporting === 'pack'}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-forge-border text-3xs uppercase tracking-[0.1em] text-forge-dim hover:text-forge-text transition-colors disabled:opacity-50"
                  style={{ borderColor: '#252a3a' }}
                >
                  {exporting === 'pack' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Pack
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {obligations.map((ob, idx) => {
                const expanded = openClause === idx;
                const app = APPLICABILITY[ob.applicability] || APPLICABILITY.UNCLEAR;

                return (
                  <div key={idx} className="rounded-lg bg-forge-card border border-forge-border overflow-hidden" style={{ borderColor: '#252a3a' }}>
                    <button
                      onClick={() => setOpenClause(expanded ? null : idx)}
                      className="w-full text-left p-4"
                      aria-expanded={expanded}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`px-1.5 py-0.5 rounded border text-3xs font-mono uppercase ${TIERS[ob.obligation] || TIERS.MANDATORY}`}>
                          {ob.obligation || 'MANDATORY'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border text-3xs uppercase tracking-[0.1em] ${app.cls}`}>
                          {app.label}
                        </span>
                        {ob.verbatimClause ? (
                          <span className="flex items-center gap-1 text-3xs font-mono text-mint">
                            <Fingerprint className="w-3 h-3" /> p.{ob.page} verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-3xs font-mono text-amber">
                            <AlertTriangle className="w-3 h-3" /> no verifiable clause
                          </span>
                        )}
                        {ob.deadline && (
                          <span className="flex items-center gap-1 text-3xs font-mono text-amber">
                            <Clock className="w-3 h-3" /> {ob.deadline}
                          </span>
                        )}
                      </div>

                      {ob.meaning && (
                        <p className="text-sm text-forge-text leading-relaxed mb-1.5">
                          <span className="text-2xs uppercase tracking-[0.14em] text-forge-accent block mb-1">
                            What this means
                          </span>
                          {ob.meaning}
                        </p>
                      )}
                      <p className="text-sm text-forge-muted leading-relaxed">{ob.change}</p>

                      <div className="flex items-center justify-end gap-1 mt-2 text-3xs text-forge-dim">
                        {expanded ? 'hide clause' : 'view clause'}
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4 animate-fade-in">
                        {ob.verbatimClause ? (
                          <blockquote className="p-3.5 rounded bg-forge-black border-l-2 border-mint/60">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-3xs uppercase tracking-[0.14em] text-forge-dim">
                                Clause · page {ob.page}
                              </span>
                              <span className="text-3xs font-mono text-mint">
                                matched in PDF
                              </span>
                            </div>
                            <p className="font-serif italic text-sm text-forge-cream/90 leading-relaxed">
                              “{ob.verbatimClause}”
                            </p>
                          </blockquote>
                        ) : (
                          <div className="p-3.5 rounded bg-amber/[0.06] border-l-2 border-amber/60">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber" />
                              <span className="text-3xs uppercase tracking-[0.14em] text-amber">
                                Citation withheld
                              </span>
                            </div>
                            <p className="text-xs text-forge-muted leading-relaxed">
                              The quoted sentence was not found in this PDF, so it is not shown as
                              evidence. Treat the obligation as unverified and re-read the source
                              before relying on it.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ledger receipt */}
          {insight.approvalHash && (
            <div className="p-4 rounded-lg bg-violet/[0.06] border border-violet/25">
              <div className="flex items-center gap-2 text-xs font-medium text-violet mb-2">
                <Hash className="w-4 h-4" /> Tamper-evident ledger block
              </div>
              <dl className="space-y-1 text-3xs font-mono">
                <Row term="Block hash" value={insight.approvalHash} />
                <Row term="Previous" value={insight.prevApprovalHash || 'GENESIS'} />
                <Row term="Decided by" value={insight.approvedBy?.username || 'unknown'} />
                <Row term="Decided at" value={insight.approvedAt ? new Date(insight.approvedAt).toLocaleString() : '—'} />
              </dl>
            </div>
          )}

          {/* Existing note */}
          {insight.reviewerNote && (
            <div className="p-4 rounded-lg bg-forge-card border border-forge-border" style={{ borderColor: '#252a3a' }}>
              <div className="text-2xs uppercase tracking-[0.16em] text-forge-dim mb-2">Reviewer note</div>
              <p className="text-sm text-forge-text leading-relaxed">“{insight.reviewerNote}”</p>
            </div>
          )}
        </div>

        {/* Footer / actions */}
        <div className="p-5 border-t border-forge-border bg-forge-black/50 space-y-3" style={{ borderColor: '#252a3a' }}>
          {isFinalized ? (
            <FinalizedBanner insight={insight} />
          ) : (
            <>
              {/* Decision buttons */}
              <div className="grid grid-cols-3 gap-2">
                <DecisionButton
                  active={decision === 'Approved'}
                  disabled={!isAdmin}
                  onClick={() => { setDecision('Approved'); setError(''); }}
                  icon={CheckCircle}
                  label="Approve"
                  tone="mint"
                  title={!isAdmin ? 'Requires administrator approval' : 'Approve this finding'}
                />
                <DecisionButton
                  active={decision === 'Rejected'}
                  disabled={!isAdmin}
                  onClick={() => { setDecision('Rejected'); setError(''); }}
                  icon={XCircle}
                  label="Reject"
                  tone="coral"
                  title={!isAdmin ? 'Requires administrator approval' : 'Reject this finding'}
                />
                <DecisionButton
                  active={decision === 'clarify'}
                  onClick={() => { setDecision('clarify'); setError(''); }}
                  icon={HelpCircle}
                  label="Ask"
                  tone="sky"
                  title="Request clarification — the finding stays open"
                />
              </div>

              {!isAdmin && (
                <div className="flex items-center gap-2 text-2xs text-forge-dim">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Approve and reject require an administrator. You can still ask a question.
                </div>
              )}

              {decision && (
                <div className="space-y-2 animate-fade-in">
                  <label className="block">
                    <span className="block text-2xs uppercase tracking-[0.14em] text-forge-dim mb-1.5">
                      {decision === 'clarify'
                        ? 'Your question'
                        : decision === 'Rejected'
                          ? 'Rejection reason (required, 10+ characters)'
                          : 'Approval note (optional)'}
                    </span>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => { setNote(e.target.value); setError(''); }}
                      placeholder={
                        decision === 'clarify'
                          ? 'Does this apply to our offshore routing venue?'
                          : decision === 'Rejected'
                            ? 'Duplicate of an earlier notice; regulator withdrew this section.'
                            : 'Reviewed against the Q3 control matrix.'
                      }
                      className="textarea-base"
                      autoFocus
                    />
                  </label>

                  {error && (
                    <div role="alert" className="flex items-start gap-2 p-2.5 rounded border border-coral/40 bg-coral/10 text-coral text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => { setDecision(null); setNote(''); setError(''); }} className="btn-ghost flex-1 !py-2.5 !text-2xs">
                      Cancel
                    </button>
                    <button onClick={submit} disabled={busy} className="btn-primary flex-1 !py-2.5 !text-2xs">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {decision === 'clarify' ? 'Send question' : decision === 'Approved' ? 'Approve & seal' : 'Reject & seal'}
                    </button>
                  </div>
                </div>
              )}

              {error && !decision && (
                <div role="alert" className="flex items-start gap-2 p-2.5 rounded border border-coral/40 bg-coral/10 text-coral text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────── */

function FinalizedBanner({ insight }) {
  const approved = insight.humanApprovalStatus === 'Approved';
  return (
    <div
      className={`p-3.5 rounded-lg border flex items-start gap-2.5 ${
        approved ? 'border-mint/35 bg-mint/[0.07]' : 'border-coral/35 bg-coral/[0.07]'
      }`}
    >
      <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${approved ? 'text-mint' : 'text-coral'}`} />
      <div className="text-xs leading-relaxed">
        <div className={`font-medium ${approved ? 'text-mint' : 'text-coral'}`}>
          {insight.humanApprovalStatus} by {insight.approvedBy?.username || 'unknown'}
          {insight.approvedAt && ` · ${new Date(insight.approvedAt).toLocaleDateString()}`}
        </div>
        {insight.reviewerNote && (
          <div className="text-forge-muted mt-1">“{insight.reviewerNote}”</div>
        )}
        <div className="text-forge-dim mt-1.5 flex items-center gap-1.5">
          <UserCheck className="w-3 h-3" /> Decision is terminal and sealed in the ledger.
        </div>
      </div>
    </div>
  );
}

function DecisionButton({ active, disabled, onClick, icon: Icon, label, tone, title }) {
  const tones = {
    mint: { on: 'border-mint/70 bg-mint/20 text-mint', off: 'text-forge-text hover:text-mint hover:border-mint/50' },
    coral: { on: 'border-coral/70 bg-coral/20 text-coral', off: 'text-forge-text hover:text-coral hover:border-coral/50' },
    sky: { on: 'border-sky/70 bg-sky/20 text-sky', off: 'text-forge-text hover:text-sky hover:border-sky/50' },
  };
  const t = tones[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded border text-2xs uppercase tracking-[0.1em] transition-colors ${
        disabled
          ? 'border-forge-border text-forge-dim/50 cursor-not-allowed'
          : active
            ? t.on
            : `border-forge-border ${t.off}`
      }`}
      style={!active ? { borderColor: '#252a3a' } : undefined}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Meta({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-forge-card border border-forge-border" style={{ borderColor: '#252a3a' }}>
      <div className="text-3xs uppercase tracking-[0.14em] text-forge-dim mb-1">{label}</div>
      <div className="text-sm text-forge-text">{value}</div>
    </div>
  );
}

function Row({ term, value }) {
  return (
    <div className="flex gap-2">
      <dt className="text-forge-dim w-24 shrink-0">{term}</dt>
      <dd className="text-forge-text break-all">{value}</dd>
    </div>
  );
}
