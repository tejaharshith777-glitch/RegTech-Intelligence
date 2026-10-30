'use strict';

const fs = require('fs');
const path = require('path');

const sampleDocs = [
  {
    filename: 'FINRA_Regulatory_Notice_2026.pdf',
    title: 'FINRA REGULATORY NOTICE 26-08: ALGORITHMIC TRADING GOVERNANCE',
    piiText: 'Prepared by: Michael Vance (SSN: 111-22-3333, Email: mvance@broker-dealer.finra.org)',
    policies: [
      'Member firms must update customer order routing disclosures monthly on public websites.',
      'Supervisory procedures for algorithmic execution systems must undergo annual independent stress audits.',
      'Pre-trade risk controls must enforce automated kill-switches for anomalous message volume.'
    ]
  },
  {
    filename: 'SEC_Digital_Assets_Directive_2026.pdf',
    title: 'SEC SPECIAL DIRECTIVE 2026-D: QUALIFIED CUSTODY STANDARDS',
    piiText: 'Audited by: Sarah Jenkins (Email: sjenkins@sec-review.gov, Direct Line: 202-551-8900)',
    policies: [
      'Digital asset custodians must maintain 100% segregated cold storage reserves at all times.',
      'Registered investment advisers are prohibited from engaging non-qualified foreign custodial entities.',
      'Daily cryptographic proof-of-reserve attestation certificates must be submitted to the Commission portal.'
    ]
  },
  {
    filename: 'GDPR_Cross_Border_Transfer_Audit.pdf',
    title: 'EU GDPR ENFORCEMENT MEMORANDUM: ARTICLE 46 AUDIT GUIDANCE',
    piiText: 'Lead Examiner: Elena Rostova (Phone: +44 20 7946 0912, Passport: GBR-90823412)',
    policies: [
      'Standard Contractual Clauses (SCCs) must include supplementary encryption key escrow restrictions.',
      'Data exporters must conduct documented Transfer Impact Assessments (TIAs) annually.',
      'Direct government intelligence access requests require mandatory notice to supervisory authorities within 24 hours.'
    ]
  },
  {
    filename: 'HIPAA_Security_Rule_Cybersecurity_Update.pdf',
    title: 'HHS HIPAA SECURITY AMENDMENT: MANDATORY ePHI ENCRYPTION STANDARDS',
    piiText: 'Privacy Liaison: David K. Miller (DOB: 1982-04-15, Address: 742 Evergreen Terrace, Seattle, WA)',
    policies: [
      'Covered entities must implement phishing-resistant hardware MFA for all administrative ePHI systems.',
      'Cybersecurity breach incident disclosures must be filed with HHS OCR within 72 hours of initial discovery.',
      'Legacy clinical databases containing patient social security numbers must be de-identified or encrypted with AES-256.'
    ]
  },
  {
    filename: 'Basel_III_Capital_Adequacy_Framework.pdf',
    title: 'BASEL COMMITTEE ADVISORY: CAPITAL CONSERVATION AND BUFFER CALIBRATION',
    piiText: 'Risk Controller: Marcus Thorne (Tax ID: 88-9912345, Confidential Internal Extension: x4812)',
    policies: [
      'Tier 1 common equity ratio requirement calibrated up to 10.5% for internationally active institutions.',
      'Liquidity Coverage Ratio (LCR) stress tests must model extreme 30-day sovereign debt market illiquidity.',
      'Counterparty credit valuation adjustments (CVA) must incorporate climate risk exposure metrics.'
    ]
  },
  {
    filename: 'AML_CFT_FinCEN_Travel_Rule_Revision.pdf',
    title: 'FinCEN BSA RULEMAKING: TRAVEL RULE COMPLIANCE FOR VIRTUAL FUNDS',
    piiText: 'Compliance Certifier: Rebecca Lin (SSN: 000-88-7654, Passport: USA-A89213401)',
    policies: [
      'Funds transmittal recordkeeping threshold lowered from $3,000 to $250 for cross-border transactions.',
      'Originator and beneficiary legal entity identifiers must be validated against real-time OFAC sanctions lists.',
      'Suspicious Activity Reports (SARs) must be retained with full transactional telemetry for minimum 7 years.'
    ]
  }
];

/**
 * Wrap one line of text so it stays inside the printable area.
 *
 * The page is 612pt wide with 50pt margins, and the extractor joins text-show
 * operators with no separator - so every wrapped line keeps its trailing space.
 * Without that, "stress " + "audits" would extract as "stressaudits" and the
 * clause provenance check would fail on a document that looks perfectly fine.
 */
const MAX_CHARS = 80;

function wrapText(text, maxChars = MAX_CHARS) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current + ' '); // keep the space: see note above
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Escape the three characters that are special inside a PDF string literal. */
const pdfEscape = (text) =>
  String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function buildPdfBuffer(doc) {
  // ── Lay the page out first, then serialise ────────────────────────────────
  // Each entry is one rendered line with absolute baseline positioning, so a
  // long clause wraps instead of running off the right edge of the page.
  const lines = [];
  let y = 720;

  const add = (text, { bold = false, size = 11, leading = 15 } = {}) => {
    lines.push({ text, bold, size, y });
    y -= leading;
  };

  wrapText(doc.title, 74).forEach((line) => add(line, { bold: true, size: 12, leading: 16 }));
  add(' ');
  wrapText(doc.piiText).forEach((line) => add(line));
  add(' ');
  add('POLICY MANDATES & REGULATORY UPDATES:', { bold: true });

  doc.policies.forEach((policy, idx) => {
    const prefix = `[${idx + 1}] `;
    const wrapped = wrapText(policy, MAX_CHARS - prefix.length);
    // Hanging indent so continuation lines stay visually subordinate.
    wrapped.forEach((line, i) => add(i === 0 ? prefix + line : '    ' + line));
    add(' ', { leading: 8 });
  });

  const streamContent = lines
    .map(
      (l) =>
        `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf 50 ${l.y} Td (${pdfEscape(l.text)}) Tj ET`
    )
    .join('\n');

  // ── Objects ──────────────────────────────────────────────────────────────
  // /Resources and the /Font dictionaries are mandatory: without them /F1 is
  // undefined and viewers render a blank page.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(streamContent, 'utf-8')} >>\nstream\n${streamContent}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  // ── Serialise with byte-accurate xref offsets ────────────────────────────
  let out = '%PDF-1.4\n';
  const offsets = [];

  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'utf-8'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(out, 'utf-8');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    out += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(out, 'utf-8');
}

const outDir = path.join(__dirname, '..', 'sample-compliance-docs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

sampleDocs.forEach(doc => {
  const filePath = path.join(outDir, doc.filename);
  fs.writeFileSync(filePath, buildPdfBuffer(doc));
  console.log(`[sample-pdf] Created: ${doc.filename}`);
});

console.log(`\n✅ Generated ${sampleDocs.length} real regulatory compliance PDFs in: sample-compliance-docs/`);
