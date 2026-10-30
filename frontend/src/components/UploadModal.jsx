import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, X, FileText, Loader2, CheckCircle2, AlertTriangle,
  RefreshCw, ShieldCheck, Sparkles, Trash2,
} from 'lucide-react';
import { researchService, errorMessage } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Queue-based upload.
 *
 * Each file gets its own lifecycle line, so a failure on file 3 does not
 * silently swallow files 1 and 2. The drop zone stays visible and accepts
 * several PDFs at once.
 */

const MAX_MB = 15;
const MAX_FILES = 8;

/** Minimal valid one-page PDFs with a real (uncompressed) text layer. */
const SAMPLE_PDFS = [
  {
    name: 'FINRA_Regulatory_Notice_2026.pdf',
    label: 'FINRA 26-08 · algorithmic trading',
    lines: [
      'FINRA REGULATORY NOTICE 26-08: ALGORITHMIC TRADING GOVERNANCE',
      'Prepared by: Michael Vance (SSN: 111-22-3333, Email: mvance@broker-dealer.finra.org)',
      'Scope: This notice applies to member firms that operate algorithmic execution venues.',
      '[1] Member firms must update customer order routing disclosures on the public investor portal within 30 calendar days of each quarter.',
      '[2] Algorithmic execution systems must complete semi-annual stress testing under stressed liquidity conditions.',
    ],
  },
  {
    name: 'SEC_Digital_Assets_Directive_2026.pdf',
    label: 'SEC 2026-D · qualified custody',
    lines: [
      'SEC SPECIAL DIRECTIVE 2026-D: QUALIFIED CUSTODY STANDARDS',
      'Audited by: Sarah Jenkins (Email: sjenkins@sec-review.gov, Direct Line: 202-551-8900)',
      'Scope: Registered digital asset custodians and broker-dealers holding client crypto assets.',
      '[1] Digital asset custodians must maintain 100% segregated cold wallet balances at all times.',
      '[2] A cryptographic proof-of-reserves attestation must be filed every 24 hours.',
    ],
  },
  {
    name: 'GDPR_Cross_Border_Transfer_Audit.pdf',
    label: 'GDPR Art. 46 · data transfers',
    lines: [
      'EU GDPR ENFORCEMENT MEMORANDUM: ARTICLE 46 AUDIT GUIDANCE',
      'Lead Examiner: Elena Rostova (Phone: +44 20 7946 0912, Passport: GBR-90823412)',
      'Scope: Controllers and processors transferring personal data outside the EEA.',
      '[1] Standard Contractual Clauses must be supplemented by a documented transfer impact assessment.',
      '[2] Transfer impact assessments must be re-certified annually and retained for five years.',
    ],
  },
  {
    name: 'HIPAA_Security_Rule_Cybersecurity_Update.pdf',
    label: 'HIPAA · ePHI security update',
    lines: [
      'HHS HIPAA SECURITY AMENDMENT: MANDATORY ePHI ENCRYPTION STANDARDS',
      'Privacy Liaison: David K. Miller (DOB: 1982-04-15, Address: 742 Evergreen Terrace, Seattle, WA)',
      'Scope: Covered entities and business associates handling electronic protected health information.',
      '[1] Covered entities must implement phishing-resistant multi-factor authentication for all ePHI access.',
      '[2] Ransomware incidents affecting ePHI must be reported to HHS OCR within 72 hours of discovery.',
    ],
  },
  {
    name: 'Basel_III_Capital_Adequacy_Framework.pdf',
    label: 'Basel III · capital buffers',
    lines: [
      'BASEL COMMITTEE ADVISORY: CAPITAL CONSERVATION AND BUFFER CALIBRATION',
      'Risk Controller: Marcus Thorne (Tax ID: 88-9912345, Confidential Internal Extension: x4812)',
      'Scope: Internationally active banks and systemically important deposit-taking institutions.',
      '[1] Tier 1 common equity ratio requirement is raised to 10.5% for internationally active banks.',
      '[2] Liquidity Coverage Ratio tests must withstand a 30-day liquidity shock scenario.',
    ],
  },
  {
    name: 'AML_CFT_FinCEN_Travel_Rule_Revision.pdf',
    label: 'FinCEN · travel rule revision',
    lines: [
      'FinCEN BSA RULEMAKING: TRAVEL RULE COMPLIANCE FOR VIRTUAL FUNDS',
      'Compliance Certifier: Rebecca Lin (SSN: 000-88-7654, Passport: USA-A89213401)',
      'Scope: Money services businesses and virtual asset service providers transacting in convertible virtual currency.',
      '[1] Funds transmittal recordkeeping threshold is lowered from $3,000 to $1,000 for virtual asset transfers.',
      '[2] Originator and beneficiary identifiers must be screened against sanctions lists in real time.',
    ],
  },
];

/** Escapes PDF string special characters. */
const pdfEscape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Build a real, minimal PDF with the given lines of text. */
function buildPdf(lines) {
  const content = [
    'BT',
    '/F1 12 Tf',
    '56 750 Td',
    ...lines.flatMap((line, i) => (i === 0 ? [`(${pdfEscape(line)}) Tj`] : ['0 -26 Td', `(${pdfEscape(line)}) Tj`])),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

let uid = 0;

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const update = (id, patch) =>
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const processOne = async (item) => {
    update(item.id, { state: 'uploading', message: 'Sending PDF to the API…' });
    try {
      const res = await researchService.uploadDocument(item.file, (evt) => {
        if (evt.total) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          update(item.id, { progress: pct });
        }
      });

      update(item.id, { state: 'analyzing', message: 'Extracting obligations and verifying clauses…' });
      const count = res.data?.insight?.policyChangeSummary?.length || 0;
      const verified = res.data?.provenance?.verified ?? 0;

      update(item.id, {
        state: 'done',
        progress: 100,
        message: `${count} obligation${count === 1 ? '' : 's'} · ${verified} clause${verified === 1 ? '' : 's'} verified`,
        insightId: res.data?.insight?.id,
      });
      return true;
    } catch (err) {
      update(item.id, { state: 'error', message: errorMessage(err) });
      return false;
    }
  };

  const runQueue = useCallback(
    async (items) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);

      let ok = 0;
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        if (await processOne(item)) ok++;
      }

      runningRef.current = false;
      setRunning(false);
      if (ok > 0) {
        onSuccess?.();
        toast.success(`${ok} document${ok === 1 ? '' : 's'} analysed`);
      }
    },
    [onSuccess]
  );

  const addFiles = (files) => {
    const accepted = [];
    const rejected = [];

    files.forEach((file) => {
      if (file.type !== 'application/pdf') rejected.push(`${file.name}: not a PDF`);
      else if (file.size > MAX_MB * 1024 * 1024) rejected.push(`${file.name}: over ${MAX_MB} MB`);
      else if (file.size === 0) rejected.push(`${file.name}: file is empty`);
      else accepted.push(file);
    });

    if (rejected.length) {
      rejected.slice(0, 3).forEach((r) => toast.error(r));
    }
    if (!accepted.length) return;

    const items = accepted.slice(0, MAX_FILES).map((file) => ({
      id: `f${++uid}`,
      file,
      name: file.name,
      size: file.size,
      state: 'queued',
      message: 'Waiting…',
      progress: 0,
    }));

    setQueue((q) => [...q, ...items]);
    // Kick off after the state update has been applied.
    setTimeout(() => runQueue(items), 0);
  };

  const onDrop = useCallback(
    (accepted, rejections) => {
      if (rejections?.length) {
        rejections.slice(0, 3).forEach((r) => {
          const code = r.errors?.[0]?.code;
          toast.error(code === 'file-too-large' ? `${r.file.name}: over ${MAX_MB} MB` : `${r.file.name}: only PDFs are accepted`);
        });
      }
      if (accepted?.length) addFiles(accepted);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_MB * 1024 * 1024,
    multiple: true,
    noClick: false,
  });

  const loadSample = (sample) => {
    const blob = buildPdf(sample.lines);
    const file = new File([blob], sample.name, { type: 'application/pdf' });
    addFiles([file]);
  };

  const retry = (item) => {
    update(item.id, { state: 'queued', message: 'Retrying…', progress: 0 });
    setTimeout(() => runQueue([{ ...item, state: 'queued' }]), 0);
  };

  const close = () => {
    if (running) return;
    setQueue([]);
    onClose();
  };

  if (!isOpen) return null;

  const done = queue.filter((q) => q.state === 'done').length;
  const failed = queue.filter((q) => q.state === 'error').length;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Upload circulars"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) close();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-lg bg-forge-dark border border-forge-border shadow-lift" style={{ borderColor: '#252a3a' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 border-b border-forge-border bg-forge-dark/95 backdrop-blur" style={{ borderColor: '#252a3a' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-forge-accent/10 border border-forge-accent/30 flex items-center justify-center">
              <UploadCloud className="w-4 h-4 text-forge-accent" />
            </div>
            <div>
              <h2 className="font-serif text-lg text-forge-cream">Ingest regulatory circulars</h2>
              <p className="text-2xs text-forge-dim mt-0.5">
                PDF only · up to {MAX_MB} MB each · processed in memory
              </p>
            </div>
          </div>
          <button
            onClick={close}
            disabled={running}
            className="p-2 rounded text-forge-dim hover:text-forge-text hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
            title={running ? 'Processing in progress' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Drop zone - always visible */}
          <div
            {...getRootProps()}
            className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-forge-accent bg-forge-accent/10 scale-[0.995]'
                : 'border-forge-border hover:border-forge-accent/50 hover:bg-white/[0.02]'
            }`}
            style={!isDragActive ? { borderColor: '#2f3548' } : undefined}
          >
            <input {...getInputProps()} />
            <div className="w-12 h-12 mx-auto rounded-lg bg-forge-accent/10 border border-forge-accent/25 flex items-center justify-center mb-3">
              <UploadCloud className="w-5 h-5 text-forge-accent" />
            </div>
            <p className="text-sm text-forge-text font-medium mb-1">
              {isDragActive ? 'Drop your PDFs here' : 'Drop PDFs here, or click to browse'}
            </p>
            <p className="text-2xs text-forge-dim">
              You can add several circulars at once. Each one is analysed on its own.
            </p>
          </div>

          {/* Samples */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-forge-accent" />
              <span className="text-2xs uppercase tracking-[0.16em] text-forge-dim">
                Or try a built-in sample circular
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {SAMPLE_PDFS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => loadSample(s)}
                  disabled={running}
                  className="text-left p-2.5 rounded bg-forge-card border border-forge-border hover:border-forge-accent/40 transition-colors flex items-start gap-2 disabled:opacity-50"
                  style={{ borderColor: '#252a3a' }}
                >
                  <FileText className="w-3.5 h-3.5 text-forge-accent mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs text-forge-text truncate">{s.label}</span>
                    <span className="block text-3xs text-forge-dim">Synthetic sample</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs uppercase tracking-[0.16em] text-forge-dim">
                  Queue · {done} done{failed ? ` · ${failed} failed` : ''}
                </span>
                {!running && (
                  <button
                    onClick={() => setQueue([])}
                    className="text-2xs text-forge-dim hover:text-coral transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {queue.map((item) => (
                <div key={item.id} className="p-3 rounded bg-forge-card border border-forge-border" style={{ borderColor: '#252a3a' }}>
                  <div className="flex items-center gap-2.5">
                    <StateIcon state={item.state} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-forge-text truncate">{item.name}</div>
                      <div className={`text-3xs truncate ${item.state === 'error' ? 'text-coral' : 'text-forge-dim'}`}>
                        {item.message}
                      </div>
                    </div>
                    <span className="text-3xs font-mono text-forge-dim shrink-0">
                      {(item.size / 1024).toFixed(0)} KB
                    </span>
                    {item.state === 'error' && (
                      <button
                        onClick={() => retry(item)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-forge-border text-3xs text-forge-muted hover:text-forge-gold hover:border-forge-accent/50 transition-colors"
                        style={{ borderColor: '#252a3a' }}
                      >
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                  </div>

                  {(item.state === 'uploading' || item.state === 'analyzing') && (
                    <div className="mt-2 h-1 rounded-full bg-forge-black overflow-hidden">
                      <div
                        className="h-full bg-forge-accent transition-all duration-300"
                        style={{ width: `${item.state === 'analyzing' ? 88 : Math.max(item.progress, 8)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded bg-forge-black border border-forge-border" style={{ borderColor: '#252a3a' }}>
            <ShieldCheck className="w-3.5 h-3.5 text-mint mt-0.5 shrink-0" />
            <p className="text-3xs text-forge-dim leading-relaxed">
              Files are held in memory for the duration of the request and are never written to
              disk. Extracted text is scanned for PII by a deterministic regex guard after the
              model runs, and every quoted clause is checked against the PDF text layer.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 p-5 border-t border-forge-border bg-forge-dark/95 backdrop-blur" style={{ borderColor: '#252a3a' }}>
          <span className="text-2xs text-forge-dim">
            {running ? 'Processing… you can leave this open.' : 'Nothing is committed until an administrator decides.'}
          </span>
          <button onClick={close} disabled={running} className="btn-ghost !py-2.5 !px-5 !text-2xs">
            {done > 0 && !running ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StateIcon({ state }) {
  if (state === 'done') return <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />;
  if (state === 'error') return <AlertTriangle className="w-4 h-4 text-coral shrink-0" />;
  if (state === 'uploading' || state === 'analyzing') return <Loader2 className="w-4 h-4 text-forge-accent animate-spin shrink-0" />;
  return <FileText className="w-4 h-4 text-forge-dim shrink-0" />;
}
