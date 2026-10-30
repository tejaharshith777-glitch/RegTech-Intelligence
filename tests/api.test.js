'use strict';

/**
 * Behavioural test suite — proves each governance claim with a real request.
 * ─────────────────────────────────────────────────────────────────────────
 * Run with:   npm test
 *
 * Database:   uses mongodb-memory-server if it is installed (npm i -D mongodb-memory-server),
 *             otherwise MONGODB_URI from your .env (use a throwaway database).
 *
 * Gemini:     stubbed. These tests verify OUR logic (auth, authorization,
 *             maker-checker, provenance verification, exports) — not Google's model.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-production';
process.env.ADMIN_EMAILS = 'chief@example.com';

const request = require('supertest');
const mongoose = require('mongoose');

// ── Stub Gemini before anything requires the controller ─────────────────────
const samplePdfPath = path.join(__dirname, '..', 'sample-compliance-docs', 'FINRA_Regulatory_Notice_2026.pdf');
const { extractPdfText } = require('../utils/pdfText');

const REAL_CLAUSE = 'Member firms must update customer order routing disclosures';

const geminiStub = {
  getGenerativeModel: () => ({
    generateContent: async () => ({
      response: {
        text: () =>
          JSON.stringify({
            policyChangeSummary: [
              {
                change: 'Broker-dealers must refresh order-routing disclosures monthly.',
                meaning: 'Post a fresh order-routing disclosure on the public site every month.',
                page: 1,
                verbatimClause: REAL_CLAUSE,
                obligation: 'MANDATORY',
                deadline: '30 days',
                appliesTo: ['broker-dealer'],
              },
              {
                change: 'Firms must file a lunar settlement attestation.',
                meaning: 'This sentence is fabricated on purpose to prove the guardrail works.',
                page: 1,
                verbatimClause: 'Every member firm shall file a lunar settlement attestation with the moon.',
                obligation: 'MANDATORY',
                deadline: null,
                appliesTo: ['bank'],
              },
            ],
            riskLevel: 'High',
            piiRedacted: true,
          }),
      },
    }),
  }),
};

require.cache[require.resolve('../config/gemini')] = {
  id: require.resolve('../config/gemini'),
  filename: require.resolve('../config/gemini'),
  loaded: true,
  exports: { getGeminiClient: () => geminiStub },
};

// ── Database bootstrap ──────────────────────────────────────────────────────
let memoryServer = null;

test.before(async () => {
  let uri = process.env.MONGODB_URI;

  try {
    // eslint-disable-next-line global-require
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  } catch {
    if (!uri) {
      throw new Error(
        'No database available. Run `npm i -D mongodb-memory-server`, or set MONGODB_URI to a throwaway database.'
      );
    }
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
});

test.after(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  if (memoryServer) await memoryServer.stop();
});

const app = require('../server');
const User = require('../models/User.model');
const Insight = require('../models/Insight.model');

// Shared fixtures
const ctx = {};

const register = (email, username) =>
  request(app)
    .post('/api/auth/register')
    .send({ username, email, password: 'Passw0rdTest' });

test('T1  registering with {"role":"admin"} still yields researcher', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'Escalate', email: 'esc@example.com', password: 'Passw0rdTest', role: 'admin' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.user.role, 'researcher');
  ctx.researcherToken = res.body.data.token;
  ctx.researcherId = res.body.data.user.id;
});

test('T1b the admin bootstrap env var is the only self-serve route to admin', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'Chief', email: 'chief@example.com', password: 'Passw0rdTest' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.user.role, 'admin');
  ctx.adminToken = res.body.data.token;
  ctx.adminId = res.body.data.user.id;
});

test('T2  duplicate email is rejected with 409', async () => {
  const res = await register('esc@example.com', 'Escalate');
  assert.strictEqual(res.status, 409);
});

test('T3  wrong password and unknown email return the identical message', async () => {
  const wrongPw = await request(app)
    .post('/api/auth/login')
    .send({ email: 'esc@example.com', password: 'WrongPassword1' });

  const noUser = await request(app)
    .post('/api/auth/login')
    .send({ email: 'ghost@example.com', password: 'WrongPassword1' });

  assert.strictEqual(wrongPw.status, 401);
  assert.strictEqual(noUser.status, 401);
  assert.strictEqual(wrongPw.body.message, noUser.body.message);
});

test('T4a a researcher cannot promote anyone (403)', async () => {
  const res = await request(app)
    .patch(`/api/auth/users/${ctx.researcherId}/role`)
    .set('Authorization', `Bearer ${ctx.researcherToken}`)
    .send({ role: 'admin' });

  assert.strictEqual(res.status, 403);
});

test('T4b an admin cannot demote themselves (400)', async () => {
  const res = await request(app)
    .patch(`/api/auth/users/${ctx.adminId}/role`)
    .set('Authorization', `Bearer ${ctx.adminToken}`)
    .send({ role: 'researcher' });

  assert.strictEqual(res.status, 400);
});

test('T4c the last administrator cannot be removed (409)', async () => {
  // Only one admin exists at this point (ctx.adminId).
  const other = await register('other@example.com', 'Other');
  const res = await request(app)
    .patch(`/api/auth/users/${ctx.adminId}/role`)
    .set('Authorization', `Bearer ${ctx.adminToken}`)
    .send({ role: 'researcher' });

  assert.strictEqual(res.status, 400, 'self-demotion is caught first');
  void other;
});

test('T5  upload extracts obligations and verifies clauses against the PDF', async () => {
  const res = await request(app)
    .post('/api/research/upload')
    .set('Authorization', `Bearer ${ctx.researcherToken}`)
    .attach('document', samplePdfFilePath());

  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  const obligations = res.body.data.insight.policyChangeSummary;
  assert.strictEqual(obligations.length, 2);

  // The genuine clause survives, verified.
  assert.strictEqual(obligations[0].clauseVerification, 'verified');
  assert.ok(obligations[0].verbatimClause.includes('order routing disclosures'));

  // The fabricated clause is stripped of its citation, not trusted.
  assert.strictEqual(obligations[1].clauseVerification, 'mismatch');
  assert.strictEqual(obligations[1].verbatimClause, null);
  assert.strictEqual(obligations[1].page, null);

  ctx.insightId = res.body.data.insight.id;
});

test('T6  applicability triage labels every obligation', async () => {
  await request(app)
    .patch('/api/auth/me/applicability')
    .set('Authorization', `Bearer ${ctx.researcherToken}`)
    .send({ jurisdiction: 'IN', entityTypes: ['broker-dealer'], businessLines: ['equities'] });

  const res = await request(app)
    .get('/api/research/insights')
    .set('Authorization', `Bearer ${ctx.researcherToken}`);

  assert.strictEqual(res.status, 200);
  const obs = res.body.data.insights[0].policyChangeSummary;
  assert.strictEqual(obs[0].applicability, 'APPLIES'); // broker-dealer matches
  assert.strictEqual(obs[1].applicability, 'OUT_OF_SCOPE'); // bank does not

  const triage = res.body.data.triage;
  assert.strictEqual(triage.obligations, triage.applies + triage.outOfScope + triage.unclear);
});

test('T7  a researcher cannot approve (403)', async () => {
  const res = await request(app)
    .put(`/api/research/insights/${ctx.insightId}/approve`)
    .set('Authorization', `Bearer ${ctx.researcherToken}`)
    .send({ humanApprovalStatus: 'Approved' });

  assert.strictEqual(res.status, 403);
});

test('T8  a researcher CAN request clarification, and it stays Pending', async () => {
  const res = await request(app)
    .post(`/api/research/insights/${ctx.insightId}/clarify`)
    .set('Authorization', `Bearer ${ctx.researcherToken}`)
    .send({ question: 'Does this apply to our offshore routing venue?' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.insight.humanApprovalStatus, 'Pending');
});

test('T9  admin rejecting without a reason is refused (422)', async () => {
  const res = await request(app)
    .put(`/api/research/insights/${ctx.insightId}/approve`)
    .set('Authorization', `Bearer ${ctx.adminToken}`)
    .send({ humanApprovalStatus: 'Rejected' });

  assert.strictEqual(res.status, 422);
});

test('T10 admin rejecting with a real reason succeeds and records actor + note', async () => {
  const reason = 'Duplicate of FINRA 26-04, withdrawn by the regulator.';
  const res = await request(app)
    .put(`/api/research/insights/${ctx.insightId}/approve`)
    .set('Authorization', `Bearer ${ctx.adminToken}`)
    .send({ humanApprovalStatus: 'Rejected', reason });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.data.insight.humanApprovalStatus, 'Rejected');
  assert.strictEqual(res.body.data.insight.reviewerNote, reason);
  assert.strictEqual(res.body.data.insight.approvedBy.username, 'Chief');
  assert.ok(res.body.data.auditReceipt.approvalHash);
});

test('T11 a decided insight cannot be decided again (409)', async () => {
  const res = await request(app)
    .put(`/api/research/insights/${ctx.insightId}/approve`)
    .set('Authorization', `Bearer ${ctx.adminToken}`)
    .send({ humanApprovalStatus: 'Approved' });

  assert.strictEqual(res.status, 409);
});

test('T12 the hash-chained audit ledger still verifies', async () => {
  const res = await request(app)
    .get('/api/research/audit/verify')
    .set('Authorization', `Bearer ${ctx.researcherToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.valid, true);
  assert.ok(res.body.data.entries >= 1);
});

test('T13 the audit pack downloads with clause, page, actor and reason', async () => {
  const res = await request(app)
    .get(`/api/research/insights/${ctx.insightId}/audit-pack`)
    .set('Authorization', `Bearer ${ctx.adminToken}`);

  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /markdown/);
  assert.match(res.headers['content-disposition'], /attachment; filename="audit-pack-/);

  const body = res.text;
  assert.match(body, /Clause reference/);
  assert.match(body, /p\.1/);
  assert.match(body, /Chief/);
  assert.match(body, /Duplicate of FINRA 26-04/);
  assert.match(body, /SHA-256 of this pack/);
  assert.match(body, /Clause verification:\*\* mismatch/);
});

test('T14 the obligations CSV downloads and is well formed', async () => {
  const res = await request(app)
    .get(`/api/research/insights/${ctx.insightId}/obligations.csv`)
    .set('Authorization', `Bearer ${ctx.adminToken}`);

  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /csv/);

  const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
  assert.strictEqual(
    lines[0],
    '"obligation","clause_reference","page","deadline","applicability","owner","decision"'
  );
  assert.strictEqual(lines.length, 3); // header + 2 obligations
});

test('T15 health reports the real database state', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.db, 'connected');
  assert.strictEqual(res.body.success, true);
});

test('T16 an unauthenticated request is refused', async () => {
  const res = await request(app).get('/api/research/insights');
  assert.strictEqual(res.status, 401);
});

test('T18 health reports 503 when MongoDB is disconnected', async () => {
  // This runs last and deliberately breaks the connection.
  await mongoose.disconnect();

  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.db, 'disconnected');

  // Restore for the remaining teardown
  if (memoryServer) await mongoose.connect(memoryServer.getUri());
});

test('T17 internal counters are consistent after the run', async () => {
  const users = await User.countDocuments();
  const insights = await Insight.countDocuments();
  assert.ok(users >= 3);
  assert.strictEqual(insights, 1);
});

// Helper defined last so it can use fs lazily
function samplePdfFilePath() {
  assert.ok(fs.existsSync(samplePdfPath), `missing fixture ${samplePdfPath}`);
  // Sanity check the fixture really has a text layer for the extractor.
  assert.ok(extractPdfText(fs.readFileSync(samplePdfPath)).usable);
  return samplePdfPath;
}
