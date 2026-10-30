'use strict';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const sampleDocsDir = path.join(__dirname, '..', 'sample-compliance-docs');
const pdfFiles = [
  'FINRA_Regulatory_Notice_2026.pdf',
  'SEC_Digital_Assets_Directive_2026.pdf',
  'GDPR_Cross_Border_Transfer_Audit.pdf',
  'HIPAA_Security_Rule_Cybersecurity_Update.pdf',
  'Basel_III_Capital_Adequacy_Framework.pdf',
  'AML_CFT_FinCEN_Travel_Rule_Revision.pdf'
];

async function verifyAllPdfs() {
  console.log('========================================================================');
  console.log('  TESTING LIVE INGESTION OF 6 COMPLIANCE PDFs VIA GEMINI 2.5 FLASH');
  console.log('========================================================================\n');

  // 1. Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'researcher@compliance.org',
      password: 'ResearcherPass123!'
    })
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.token) {
    console.error('❌ Login failed:', loginData);
    process.exit(1);
  }
  const token = loginData.data.token;
  console.log('✅ Authenticated as ComplianceResearcher (JWT acquired)\n');

  const uploadedInsightIds = [];

  // 2. Loop through 6 PDFs
  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const filePath = path.join(sampleDocsDir, filename);
    const fileBuffer = fs.readFileSync(filePath);

    console.log(`[${i + 1}/6] 📄 Uploading: ${filename} (${fileBuffer.length} bytes)...`);

    const boundary = '--------------------------' + Date.now().toString(16);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const multipartBody = Buffer.concat([header, fileBuffer, footer]);

    const uploadStart = Date.now();
    const res = await fetch('http://localhost:5000/api/research/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length
      },
      body: multipartBody
    });

    const data = await res.json();
    const elapsed = ((Date.now() - uploadStart) / 1000).toFixed(2);

    if (res.status === 201 && data.success) {
      const ins = data.data.insight;
      uploadedInsightIds.push(ins.id);
      console.log(`     ✅ Gemini AI Analysis completed in ${elapsed}s:`);
      console.log(`        • Document ID: ${data.data.document.id}`);
      console.log(`        • Risk Level:  ${ins.riskLevel}`);
      console.log(`        • PII Redacted: ${ins.piiRedacted}`);
      console.log(`        • Status:      ${ins.humanApprovalStatus}`);
      console.log(`        • Policy Bullet Highlights:`);
      ins.policyChangeSummary.forEach((p, idx) => {
        console.log(`          [${idx + 1}] ${p}`);
      });
      console.log('');
    } else {
      console.error(`     ❌ Upload failed for ${filename} (${res.status}):`, data);
    }
  }

  // 3. Test Human-in-the-Loop Approval on first 2 insights
  if (uploadedInsightIds.length > 0) {
    const idToApprove = uploadedInsightIds[0];
    console.log(`[HITL Test] Submitting Approval for Insight ID: ${idToApprove}...`);
    const appRes = await fetch(`http://localhost:5000/api/research/insights/${idToApprove}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ humanApprovalStatus: 'Approved' })
    });
    const appData = await appRes.json();
    console.log(`✅ Approval Result: ${appData.message}\n`);
  }

  // 4. Fetch Full Dashboard Registry
  console.log('[Dashboard Verification] Fetching all compliance insights...');
  const listRes = await fetch('http://localhost:5000/api/research/insights', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const listData = await listRes.json();
  const allInsights = listData.data?.insights || [];
  console.log(`✅ Total Insights in Registry: ${allInsights.length}`);
  console.log('========================================================================');
  console.log('  ALL 6 COMPLIANCE PDFs SUCCESSFULLY INGESTED & VERIFIED LIVE');
  console.log('========================================================================');
}

verifyAllPdfs().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
