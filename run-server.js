'use strict';

/**
 * Live Server Runner for Manual Browser Verification
 * ──────────────────────────────────────────────────
 * Connects to MongoDB (or provides memory storage if offline),
 * boots the Express server, and serves the UI verification console.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User.model');
const Document = require('./models/Document.model');
const Insight = require('./models/Insight.model');

// Check if MongoDB is connected or set up in-memory mock store
async function bootstrapDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/regulatory_compliance_db';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('[db] ✅ Connected to active MongoDB instance');
  } catch (err) {
    console.log('[db] ℹ️  Local MongoDB offline. Bootstrapping fast in-memory store for verification...');
    setupMockDB();
  }
}

function setupMockDB() {
  const users = new Map();
  const documents = new Map();
  const insights = new Map();
  let counter = 1;

  function nextId() {
    return new mongoose.Types.ObjectId((counter++).toString(16).padStart(24, '0'));
  }

  User.findOne = function (query) {
    return {
      select: function () {
        for (const u of users.values()) {
          if (query.email && u.email === query.email) {
            return Promise.resolve(Object.assign({}, u, {
              comparePassword: async function (p) { return bcrypt.compare(p, this.password); }
            }));
          }
        }
        return Promise.resolve(null);
      },
      then: function (resolve) {
        for (const u of users.values()) {
          if (query.email && u.email === query.email) {
            return resolve(Object.assign({}, u, {
              comparePassword: async function (p) { return bcrypt.compare(p, this.password); }
            }));
          }
        }
        return resolve(null);
      }
    };
  };

  User.findById = function (id) {
    return {
      select: function () {
        const u = users.get(id?.toString());
        if (!u) return Promise.resolve(null);
        const copy = Object.assign({}, u);
        delete copy.password;
        return Promise.resolve(copy);
      }
    };
  };

  User.create = async function (data) {
    const id = nextId();
    const hash = await bcrypt.hash(data.password, 10);
    const u = {
      _id: id,
      username: data.username,
      email: data.email,
      password: hash,
      role: data.role || 'researcher',
      comparePassword: async function (p) { return bcrypt.compare(p, this.password); }
    };
    users.set(id.toString(), u);
    return u;
  };

  Document.create = async function (data) {
    const id = nextId();
    const d = {
      _id: id,
      filename: data.filename,
      uploadedBy: data.uploadedBy,
      uploadDate: new Date(),
      status: data.status || 'pending',
      save: async function () { return this; }
    };
    documents.set(id.toString(), d);
    return d;
  };

  Insight.create = async function (data) {
    const id = nextId();
    const ins = {
      _id: id,
      documentId: data.documentId,
      policyChangeSummary: data.policyChangeSummary,
      riskLevel: data.riskLevel,
      piiRedacted: data.piiRedacted,
      humanApprovalStatus: data.humanApprovalStatus || 'Pending',
      createdAt: new Date(),
      save: async function () {
        insights.set(id.toString(), this);
        return this;
      }
    };
    insights.set(id.toString(), ins);
    return ins;
  };

  Insight.findById = async function (id) {
    const ins = insights.get(id?.toString());
    if (!ins) return null;
    return Object.assign({}, ins, {
      populate: function () { return this; },
      save: async function () {
        insights.set(id.toString(), this);
        return this;
      }
    });
  };

  Insight.find = function (filter = {}) {
    let list = Array.from(insights.values());
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
    return insights.size;
  };

  // Seed sample initial insight for instant verification
  const demoDocId = nextId();
  documents.set(demoDocId.toString(), {
    _id: demoDocId,
    filename: 'FINRA_Broker_Dealer_Notice_2026.pdf',
    uploadDate: new Date(),
    status: 'processed'
  });

  const demoInsightId = nextId();
  insights.set(demoInsightId.toString(), {
    _id: demoInsightId,
    documentId: { filename: 'FINRA_Broker_Dealer_Notice_2026.pdf' },
    policyChangeSummary: [
      'Customer order routing disclosure must be updated monthly rather than quarterly.',
      'Supervisory procedures for algorithmic execution systems must undergo annual stress audits.'
    ],
    riskLevel: 'Medium',
    piiRedacted: true,
    humanApprovalStatus: 'Pending',
    createdAt: new Date(),
    save: async function () {
      insights.set(demoInsightId.toString(), this);
      return this;
    }
  });

  console.log('[db] ✅ Seeded initial compliance insight ready for human review.');
}

async function start() {
  await bootstrapDB();
  const app = require('./server');
  console.log('\n============================================================');
  console.log('  🌐 REGULATORY COMPLIANCE PLATFORM — LIVE VERIFICATION LINK');
  console.log('  👉 http://localhost:5000');
  console.log('  👉 Health Check: http://localhost:5000/api/health');
  console.log('============================================================\n');
}

start();
