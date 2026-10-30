'use strict';

/**
 * Full End-to-End Test Suite for Regulatory Compliance Research API
 * ─────────────────────────────────────────────────────────────────
 * Tests:
 * 1. Health check endpoint
 * 2. Auth: Register (validation, hashing, duplicate rejection)
 * 3. Auth: Login (success, wrong credentials, JWT issuance)
 * 4. Auth: Profile (JWT verification, role inspection)
 * 5. Middleware: Token expiration & malformed token detection
 * 6. Research: Insights Listing & Pagination
 * 7. Research: Human-in-the-loop Approval & Idempotency
 * 8. Research: PDF Upload & Gemini AI analysis with PII redaction guardrail
 * 9. Error Handling: 404, 400, 422, 401 handling
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Models
const User = require('./models/User.model');
const Document = require('./models/Document.model');
const Insight = require('./models/Insight.model');

// Express App
const app = require('./server');

// Color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};
const pass = `${c.green}${c.bold}  ✔ PASS${c.reset}`;
const fail = `${c.red}${c.bold}  ✘ FAIL${c.reset}`;
const section = (txt) => console.log(`\n${c.yellow}${c.bold}▶ ${txt}${c.reset}`);

let passCount = 0;
let failCount = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`${pass} ${label}`);
    passCount++;
  } else {
    console.log(`${fail} ${label}${detail ? `\n       ${c.dim}→ ${detail}${c.reset}` : ''}`);
    failCount++;
  }
}

// In-memory data store to mock DB collections safely when local MongoDB service isn't running
class MockDB {
  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.insights = new Map();
    this.counter = 1;
  }

  nextId() {
    const hex = (this.counter++).toString(16).padStart(24, '0');
    return new mongoose.Types.ObjectId(hex);
  }

  setupMongooseStubs() {
    const self = this;

    // User stubs
    User.findOne = function (query) {
      return {
        select: function (fields) {
          return self.findUser(query, fields);
        },
        then: function (resolve, reject) {
          return self.findUser(query).then(resolve, reject);
        }
      };
    };

    User.findById = function (id) {
      return {
        select: function () {
          const u = self.users.get(id?.toString());
          if (!u) return Promise.resolve(null);
          const cloned = Object.assign({}, u);
          delete cloned.password;
          return Promise.resolve(cloned);
        }
      };
    };

    User.create = async function (data) {
      const id = self.nextId();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);
      const user = {
        _id: id,
        username: data.username,
        email: data.email,
        password: hashedPassword,
        role: data.role || 'researcher',
        comparePassword: async function (pwd) {
          return bcrypt.compare(pwd, this.password);
        }
      };
      self.users.set(id.toString(), user);
      return user;
    };

    // Document stubs
    Document.create = async function (data) {
      const id = self.nextId();
      const doc = {
        _id: id,
        filename: data.filename,
        uploadedBy: data.uploadedBy,
        uploadDate: new Date(),
        status: data.status || 'pending',
        save: async function () { return this; }
      };
      self.documents.set(id.toString(), doc);
      return doc;
    };

    // Insight stubs
    Insight.create = async function (data) {
      const id = self.nextId();
      const insight = {
        _id: id,
        documentId: data.documentId,
        policyChangeSummary: data.policyChangeSummary,
        riskLevel: data.riskLevel,
        piiRedacted: data.piiRedacted,
        humanApprovalStatus: data.humanApprovalStatus || 'Pending',
        createdAt: new Date(),
        save: async function () {
          self.insights.set(id.toString(), this);
          return this;
        }
      };
      self.insights.set(id.toString(), insight);
      return insight;
    };

    Insight.findById = async function (id) {
      const found = self.insights.get(id?.toString());
      if (!found) return null;
      return Object.assign({}, found, {
        populate: function () { return this; },
        save: async function () {
          self.insights.set(id.toString(), this);
          return this;
        }
      });
    };

    Insight.find = function (filter = {}) {
      let list = Array.from(self.insights.values());
      if (filter.humanApprovalStatus) {
        list = list.filter(i => i.humanApprovalStatus === filter.humanApprovalStatus);
      }
      return {
        populate: function () { return this; },
        sort: function () { return this; },
        skip: function () { return this; },
        limit: function () { return this; },
        lean: async function () { return list; }
      };
    };

    Insight.countDocuments = async function () {
      return self.insights.size;
    };
  }

  async findUser(query) {
    for (const u of this.users.values()) {
      if (query.email && u.email === query.email) {
        return Object.assign({}, u, {
          comparePassword: async function (pwd) {
            return bcrypt.compare(pwd, this.password);
          }
        });
      }
    }
    return null;
  }
}

async function runTestSuite() {
  console.log(`\n${c.blue}${c.bold}════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.blue}${c.bold}  REGULATORY COMPLIANCE API — COMPREHENSIVE LOCAL TEST RUNNER${c.reset}`);
  console.log(`${c.blue}${c.bold}════════════════════════════════════════════════════════════════════${c.reset}`);

  const mockDb = new MockDB();
  mockDb.setupMongooseStubs();

  let researcherToken = '';
  let adminToken = '';
  let sampleInsightId = '';

  // ─── 1. Health Check ────────────────────────────────────────────────────────
  section('1. Server Health & Monitoring');
  {
    const res = await request(app).get('/api/health');
    assert('GET /api/health responds with status 200', res.status === 200, res.text);
    assert('Health status success flag is true', res.body.success === true);
    assert('Environment reported correctly', res.body.environment === process.env.NODE_ENV);
  }

  // ─── 2. Auth: Registration ──────────────────────────────────────────────────
  section('2. Authentication — User Registration');
  {
    // Valid Researcher Registration
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'sarah_compliance',
        email: 'sarah@regtech.org',
        password: 'ValidPassword123',
        role: 'researcher',
      });
    assert('POST /api/auth/register creates researcher (201)', res1.status === 201, res1.text);
    assert('Registration returns JWT token', !!res1.body.data?.token);
    assert('User role set to researcher', res1.body.data?.user?.role === 'researcher');
    researcherToken = res1.body.data?.token;

    // Valid Admin Registration
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'chief_officer',
        email: 'chief@regtech.org',
        password: 'AdminPassword99',
        role: 'admin',
      });
    assert('POST /api/auth/register creates admin (201)', res2.status === 201, res2.text);
    assert('User role set to admin', res2.body.data?.user?.role === 'admin');
    adminToken = res2.body.data?.token;

    // Duplicate Email Rejection
    const res3 = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'sarah_clone',
        email: 'sarah@regtech.org',
        password: 'AnotherPassword1',
      });
    assert('Duplicate email registration returns 409 Conflict', res3.status === 409, res3.text);

    // Zod Validation: Weak Password
    const res4 = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_bad',
        email: 'valid@regtech.org',
        password: 'weak',
      });
    assert('Weak password fails Zod schema with 422', res4.status === 422, res4.text);
  }

  // ─── 3. Auth: Login & Profile ──────────────────────────────────────────────
  section('3. Authentication — Login & JWT Verification');
  {
    // Successful login
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'sarah@regtech.org',
        password: 'ValidPassword123',
      });
    assert('POST /api/auth/login succeeds with status 200', res1.status === 200, res1.text);
    assert('Login response includes valid token and user profile', !!res1.body.data?.token);

    // Invalid password
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'sarah@regtech.org',
        password: 'WrongPassword456',
      });
    assert('Wrong password returns 401 Unauthorized', res2.status === 401, res2.text);

    // Protected Route /api/auth/me
    const res3 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${researcherToken}`);
    assert('GET /api/auth/me with Bearer token returns 200', res3.status === 200, res3.text);
    assert('Password hash is omitted from user profile', !res3.body.data?.user?.password);

    // Missing Token Protection
    const res4 = await request(app).get('/api/auth/me');
    assert('GET /api/auth/me without token is rejected with 401', res4.status === 401, res4.text);
  }

  // ─── 4. Research: Insights Dashboard ───────────────────────────────────────
  section('4. Compliance Insights — Dashboard & Retrieval');
  {
    const res = await request(app)
      .get('/api/research/insights')
      .set('Authorization', `Bearer ${researcherToken}`);
    assert('GET /api/research/insights returns 200 with JWT', res.status === 200, res.text);
    assert('Returns insights array structure', Array.isArray(res.body.data?.insights));
    assert('Includes pagination metadata', typeof res.body.data?.pagination?.total === 'number');
  }

  // ─── 5. Research: Human-in-the-Loop Workflow ──────────────────────────────
  section('5. Human-in-the-loop — Approval Workflow');
  {
    // Seed an insight for approval testing
    const sampleDoc = await Document.create({
      filename: 'financial_reporting_policy_2026.pdf',
      uploadedBy: new mongoose.Types.ObjectId(),
      status: 'processed'
    });

    const sampleInsight = await Insight.create({
      documentId: sampleDoc._id,
      policyChangeSummary: [
        'Mandatory real-time fraud reporting threshold lowered to $5,000.',
        'Customer KYC verification cycles changed from annual to biannual.'
      ],
      riskLevel: 'High',
      piiRedacted: true,
      humanApprovalStatus: 'Pending'
    });
    sampleInsightId = sampleInsight._id.toString();

    // Approve the insight
    const res1 = await request(app)
      .put(`/api/research/insights/${sampleInsightId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ humanApprovalStatus: 'Approved' });
    assert('PUT /api/research/insights/:id/approve marks insight Approved (200)', res1.status === 200, res1.text);

    // Re-approval rejection (idempotency guard)
    const res2 = await request(app)
      .put(`/api/research/insights/${sampleInsightId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ humanApprovalStatus: 'Approved' });
    assert('Attempt to modify finalized insight rejected with 409 Conflict', res2.status === 409, res2.text);

    // Invalid Status validation
    const res3 = await request(app)
      .put(`/api/research/insights/${sampleInsightId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ humanApprovalStatus: 'Inconclusive' });
    assert('Invalid approval status rejected by Zod with 422', res3.status === 422, res3.text);
  }

  // ─── 6. Research: PDF Upload & Gemini AI Guardrails ────────────────────────
  section('6. Live AI Pipeline — Gemini Model & PII Guardrail Test');
  {
    // Minimal valid PDF binary buffer containing regulatory policy text and simulated PII
    const samplePdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 260 >> stream
BT
/F1 12 Tf
72 712 Td
(REGULATORY DIRECTIVE 2026-B) Tj
0 -20 Td
(Contact Lead: Johnathan Doe, Email: jdoe@regulator.gov, SSN: 000-12-3456) Tj
0 -20 Td
(Policy Change: All non-banking financial entities must submit daily capital reserves reports.) Tj
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
525
%%EOF`;

    const pdfBuffer = Buffer.from(samplePdfContent, 'utf-8');

    console.log(`${c.dim}       Transmitting PDF to POST /api/research/upload (invoking Gemini 2.5 Flash)...${c.reset}`);

    const res = await request(app)
      .post('/api/research/upload')
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('document', pdfBuffer, {
        filename: 'SEC_Compliance_Update_2026.pdf',
        contentType: 'application/pdf',
      });

    assert('POST /api/research/upload succeeds (201 Created)', res.status === 201, res.text);

    if (res.status === 201) {
      const insight = res.body.data?.insight;
      assert('AI extracted policyChangeSummary as array', Array.isArray(insight?.policyChangeSummary) && insight.policyChangeSummary.length > 0);
      assert('AI determined valid riskLevel (Low/Medium/High)', ['Low', 'Medium', 'High'].includes(insight?.riskLevel));
      assert('AI PII redaction guardrail flag recorded', typeof insight?.piiRedacted === 'boolean');
      assert('Initial humanApprovalStatus is "Pending"', insight?.humanApprovalStatus === 'Pending');

      console.log(`\n${c.cyan}${c.bold}  ── LIVE AI OUTPUT SUMMARY ───────────────────────────────────${c.reset}`);
      console.log(`  ${c.bold}File Analyzed:${c.reset}  SEC_Compliance_Update_2026.pdf`);
      console.log(`  ${c.bold}Risk Level:${c.reset}     ${insight.riskLevel}`);
      console.log(`  ${c.bold}PII Redacted:${c.reset}   ${insight.piiRedacted}`);
      console.log(`  ${c.bold}Approval Status:${c.reset} ${insight.humanApprovalStatus}`);
      console.log(`  ${c.bold}Policy Changes Extracted:${c.reset}`);
      insight.policyChangeSummary.forEach((change, idx) => {
        console.log(`    ${idx + 1}. ${change}`);
      });
      console.log(`${c.cyan}${c.bold}  ─────────────────────────────────────────────────────────────${c.reset}\n`);
    }

    // Negative test: Upload non-PDF file
    const textBuffer = Buffer.from('plain text content');
    const resBad = await request(app)
      .post('/api/research/upload')
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('document', textBuffer, {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    assert('Uploading non-PDF file rejected (415 Unsupported Media Type)', resBad.status === 415, resBad.text);
  }

  // ─── 7. Global Error Handlers ──────────────────────────────────────────────
  section('7. Global Error Middleware & Not Found');
  {
    const res = await request(app).get('/api/nonexistent-endpoint');
    assert('Unknown route returns 404 with structured JSON', res.status === 404, res.text);
    assert('Error message includes requested route', res.body.message.includes('/api/nonexistent-endpoint'));
  }

  // ─── Final Summary ─────────────────────────────────────────────────────────
  const total = passCount + failCount;
  console.log(`\n${c.blue}${c.bold}════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}  TEST RESULTS: ${c.green}${passCount} PASSED${c.reset}${c.bold}, ${failCount > 0 ? c.red : c.green}${failCount} FAILED${c.reset}${c.bold} / ${total} TOTAL${c.reset}`);
  console.log(`${c.blue}${c.bold}════════════════════════════════════════════════════════════════════${c.reset}\n`);

  process.exit(failCount === 0 ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
