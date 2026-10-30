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

function buildPdfBuffer(doc) {
  const streamContent = `BT
/F1 12 Tf
50 720 Td
(${doc.title}) Tj
0 -24 Td
(${doc.piiText}) Tj
0 -24 Td
(POLICY MANDATES & REGULATORY UPDATES:) Tj
${doc.policies.map((p, idx) => `0 -18 Td\n([${idx + 1}] ${p}) Tj`).join('\n')}
ET`;

  const streamLen = Buffer.byteLength(streamContent, 'utf-8');

  const pdfBody = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length ${streamLen} >> stream
${streamContent}
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
${214 + 60 + streamLen}
%%EOF`;

  return Buffer.from(pdfBody, 'utf-8');
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
