import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  FileCheck,
  AlertTriangle,
  X,
  Sparkles,
  ShieldCheck,
  Loader2,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { researchService } from '../services/api';
import toast from 'react-hot-toast';

const PRELOADED_SAMPLES = [
  {
    name: 'FINRA_Regulatory_Notice_2026.pdf',
    title: 'FINRA 26-08 (Algorithmic Trading & Order Routing)',
    type: 'Broker-Dealer Notice',
    content: `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 12 Tf
50 720 Td
(FINRA REGULATORY NOTICE 26-08: ALGORITHMIC TRADING) Tj
0 -24 Td
(Chief Compliance Officer: Michael Vance, SSN: 111-22-3333, Email: mvance@finra-bd.org) Tj
0 -24 Td
(Mandate 1: Customer order routing disclosures must be published on public web portal monthly.) Tj
0 -18 Td
(Mandate 2: Algorithmic execution systems must complete semi-annual stress testing.) Tj
ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
640
%%EOF`
  },
  {
    name: 'SEC_Digital_Assets_Directive_2026.pdf',
    title: 'SEC 2026-D (Qualified Custody & Segregated Reserves)',
    type: 'SEC Rulemaking',
    content: `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 12 Tf
50 720 Td
(SEC SPECIAL DIRECTIVE 2026-D: QUALIFIED CUSTODY) Tj
0 -24 Td
(Auditor: Sarah Jenkins, Email: sjenkins@sec-review.gov, Phone: 202-551-8900) Tj
0 -24 Td
(Policy 1: All registered crypto custodians must maintain 100% segregated cold wallet balances.) Tj
0 -18 Td
(Policy 2: Proof of reserves cryptographic attestation must be filed every 24 hours.) Tj
ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
640
%%EOF`
  },
  {
    name: 'GDPR_Cross_Border_Transfer_Audit.pdf',
    title: 'EU GDPR Article 46 (International Data Transfers)',
    type: 'Privacy Compliance',
    content: `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 12 Tf
50 720 Td
(EU GDPR ENFORCEMENT MEMORANDUM: ARTICLE 46) Tj
0 -24 Td
(Data Protection Officer: Elena Rostova, Phone: +44 20 7946 0912, Passport: GBR-90823412) Tj
0 -24 Td
(Policy 1: Standard Contractual Clauses (SCCs) require zero-knowledge encryption key residency.) Tj
0 -18 Td
(Policy 2: Documented Transfer Impact Assessments must be re-certified annually.) Tj
ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
640
%%EOF`
  },
  {
    name: 'HIPAA_Security_Rule_Cybersecurity_Update.pdf',
    title: 'HHS HIPAA Security Rule (ePHI Encryption & Breach Notice)',
    type: 'Healthcare Audit',
    content: `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 12 Tf
50 720 Td
(HHS HIPAA SECURITY AMENDMENT: MANDATORY ePHI ENCRYPTION) Tj
0 -24 Td
(Privacy Liaison: David K. Miller, DOB: 1982-04-15, Address: 742 Evergreen Terr, Seattle) Tj
0 -24 Td
(Policy 1: Covered entities must mandate hardware-backed FIDO2 MFA for electronic PHI access.) Tj
0 -18 Td
(Policy 2: Ransomware incidents must be reported to HHS OCR within 72 hours.) Tj
ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
640
%%EOF`
  },
  {
    name: 'Basel_III_Capital_Adequacy_Framework.pdf',
    title: 'Basel III (Tier-1 Common Equity & Stress Scenarios)',
    type: 'Banking Regulation',
    content: `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 12 Tf
50 720 Td
(BASEL COMMITTEE ADVISORY: CAPITAL CONSERVATION BUFFER) Tj
0 -24 Td
(Risk Controller: Marcus Thorne, Tax ID: 88-9912345, Ext: 4812) Tj
0 -24 Td
(Mandate 1: Tier 1 common equity ratio increased to 10.5% for internationally active banks.) Tj
0 -18 Td
(Mandate 2: Liquidity Coverage Ratio (LCR) tests must withstand 30-day liquidity shocks.) Tj
ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
640
%%EOF`
  },
  {
    name: 'AML_CFT_FinCEN_Travel_Rule_Revision.pdf',
    title: 'FinCEN BSA Travel Rule ($250 Threshold & Sanctions)',
    type: 'AML Enforcement',
    content: `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 12 Tf
50 720 Td
(FinCEN BSA RULEMAKING: TRAVEL RULE COMPLIANCE) Tj
0 -24 Td
(Compliance Certifier: Rebecca Lin, SSN: 000-88-7654, Passport: USA-A89213401) Tj
0 -24 Td
(Directive 1: Cross-border transmittal threshold lowered from $3,000 down to $250.) Tj
0 -18 Td
(Directive 2: Originator and beneficiary identifiers must be screened against OFAC in real-time.) Tj
ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
640
%%EOF`
  }
];

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'
  const [progressStage, setProgressStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles?.length > 0) {
      const err = rejectedFiles[0].errors[0];
      if (err.code === 'file-too-large') {
        toast.error('File exceeds maximum size of 15 MB');
      } else {
        toast.error('Only PDF documents are accepted');
      }
      return;
    }
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setErrorMsg('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 15 * 1024 * 1024,
    multiple: false,
    disabled: uploadState === 'uploading' || uploadState === 'analyzing',
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploadState('uploading');
    setProgressStage('Uploading PDF binary to secure processing queue...');

    try {
      // Transition message after 1.5s to show AI analysis step
      setTimeout(() => {
        setUploadState('analyzing');
        setProgressStage('Gemini 2.5 Flash scanning document & enforcing PII redaction guardrails...');
      }, 1500);

      const res = await researchService.uploadDocument(file);

      setUploadState('done');
      setProgressStage('Analysis complete! Insight logged for human review.');
      toast.success(`Analysis complete: ${res.data?.insight?.riskLevel} Risk classified`);

      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1200);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadState('error');
      const msg = err.response?.data?.message || err.message || 'Processing failed';
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const loadSample = (sample) => {
    const blob = new Blob([sample.content], { type: 'application/pdf' });
    const sampleFile = new File([blob], sample.name, { type: 'application/pdf' });
    setFile(sampleFile);
    setErrorMsg('');
    toast.success(`Loaded sample: ${sample.name}`);
  };

  const handleClose = () => {
    if (uploadState === 'uploading' || uploadState === 'analyzing') return;
    setFile(null);
    setUploadState('idle');
    setProgressStage('');
    setErrorMsg('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#0c1322] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Upload Regulatory Policy (PDF)</h2>
              <p className="text-xs text-slate-400">Automated Gemini Ingestion & Redaction Pipeline</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploadState === 'uploading' || uploadState === 'analyzing'}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-5 space-y-5">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
                : isDragReject
                ? 'border-rose-500 bg-rose-500/10'
                : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-white/15 bg-white/[0.02] hover:border-blue-500/50 hover:bg-white/[0.04]'
            }`}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div className="font-semibold text-sm text-slate-200">{file.name}</div>
                <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · Ready to analyze</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="mt-2 text-xs text-rose-400 hover:underline"
                >
                  Change file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="font-semibold text-sm text-slate-200">
                  {isDragActive ? 'Drop your PDF here...' : 'Click or drag & drop regulatory PDF'}
                </div>
                <div className="text-xs text-slate-400">Supports standard compliance PDF documents up to 15 MB</div>
              </div>
            )}
          </div>

          {/* Quick-Pick Pre-loaded Real Regulatory Samples */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Or click a pre-built regulatory sample (contains simulated PII):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRELOADED_SAMPLES.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => loadSample(s)}
                  disabled={uploadState === 'uploading' || uploadState === 'analyzing'}
                  className="text-left p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-blue-500/30 transition-all flex items-start gap-2 text-xs group disabled:opacity-40"
                >
                  <FileText className="w-4 h-4 text-blue-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="overflow-hidden">
                    <div className="font-medium text-slate-200 truncate">{s.title}</div>
                    <div className="text-[10px] text-slate-400">{s.type}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Progressive Loading State */}
          {(uploadState === 'uploading' || uploadState === 'analyzing' || uploadState === 'done') && (
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-blue-300">
                  {uploadState === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  )}
                  <span>{progressStage}</span>
                </div>
                <span className="text-slate-400 text-[11px] font-mono">
                  {uploadState === 'uploading' ? '40%' : uploadState === 'analyzing' ? '85%' : '100%'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ease-out ${
                    uploadState === 'done'
                      ? 'w-full bg-emerald-500'
                      : uploadState === 'analyzing'
                      ? 'w-[85%] bg-indigo-500 animate-pulse'
                      : 'w-[40%] bg-blue-500'
                  }`}
                />
              </div>

              {/* Guardrails checklist indicator */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 pt-1">
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Base64 Streaming</span>
                </div>
                <div className={`flex items-center gap-1 ${uploadState === 'analyzing' || uploadState === 'done' ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {uploadState === 'analyzing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                  <span>PII Masking</span>
                </div>
                <div className={`flex items-center gap-1 ${uploadState === 'done' ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {uploadState === 'done' ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 opacity-40" />}
                  <span>Risk Categorization</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploadState === 'uploading' || uploadState === 'analyzing'}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploadState === 'uploading' || uploadState === 'analyzing'}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {uploadState === 'uploading' || uploadState === 'analyzing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Run Compliance Extraction</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
