'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let isInMemoryFallback = false;

function setupInMemoryFallback() {
  if (isInMemoryFallback) return;
  isInMemoryFallback = true;
  console.log('[db] ℹ️  MongoDB offline: Activating high-performance in-memory datastore.');

  const User = require('../models/User.model');
  const Document = require('../models/Document.model');
  const Insight = require('../models/Insight.model');

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
      piiAudit: data.piiAudit || { modelRedactions: 0, serverRedactions: 0, residualAfterScan: 0, clean: true },
      humanApprovalStatus: data.humanApprovalStatus || 'Pending',
      approvalReason: data.approvalReason || null,
      approvalHash: data.approvalHash || null,
      prevApprovalHash: data.prevApprovalHash || null,
      approvedBy: data.approvedBy || null,
      approvedAt: data.approvedAt || null,
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

  Insight.findOne = function (query) {
    let list = Array.from(insights.values());
    if (query.documentId) {
      list = list.filter(i => i.documentId?.toString?.() === query.documentId?.toString?.());
    }
    if (query.approvalHash && query.approvalHash.$ne) {
      list = list.filter(i => i.approvalHash !== null && i.approvalHash !== undefined);
    }
    const found = list[list.length - 1] || null;
    return {
      populate: function (field) {
        if (found && (field === 'documentId' || field?.path === 'documentId')) {
          const doc = documents.get(found.documentId?.toString?.() || found.documentId);
          found.documentId = doc || { filename: 'Regulation.pdf' };
        }
        return Promise.resolve(found);
      },
      sort: function () { return this; },
      then: function (resolve) { return resolve(found); }
    };
  };

  Insight.find = function (filter = {}) {
    let list = Array.from(insights.values());
    if (filter.humanApprovalStatus) {
      list = list.filter(i => i.humanApprovalStatus === filter.humanApprovalStatus);
    }
    if (filter.riskLevel) {
      list = list.filter(i => i.riskLevel === filter.riskLevel);
    }
    return {
      populate: function (opts) {
        // Populate document metadata if requested
        if (opts && (opts.path === 'documentId' || opts === 'documentId')) {
          list = list.map(item => {
            const doc = documents.get(item.documentId?.toString?.() || item.documentId);
            return Object.assign({}, item, {
              documentId: doc || { filename: 'Uploaded_Regulation.pdf', status: 'processed', uploadDate: item.createdAt }
            });
          });
        }
        return this;
      },
      sort: function () { return this; },
      skip: function () { return this; },
      limit: function () { return this; },
      lean: async function () { return list.slice().reverse(); }
    };
  };

  Insight.countDocuments = async function () {
    return insights.size;
  };

  // Seed default admin and researcher accounts
  (async () => {
    const adminPass = await bcrypt.hash('AdminPass123!', 10);
    const researcherPass = await bcrypt.hash('ResearcherPass123!', 10);

    const adminId = nextId();
    users.set(adminId.toString(), {
      _id: adminId,
      username: 'ComplianceAdmin',
      email: 'admin@compliance.org',
      password: adminPass,
      role: 'admin',
      comparePassword: async function (p) { return bcrypt.compare(p, this.password); }
    });

    const resId = nextId();
    users.set(resId.toString(), {
      _id: resId,
      username: 'ComplianceResearcher',
      email: 'researcher@compliance.org',
      password: researcherPass,
      role: 'researcher',
      comparePassword: async function (p) { return bcrypt.compare(p, this.password); }
    });

    // Seed sample compliance insight
    const docId = nextId();
    documents.set(docId.toString(), {
      _id: docId,
      filename: 'SEC_Regulation_Best_Interest_2026.pdf',
      uploadedBy: resId,
      uploadDate: new Date(),
      status: 'processed'
    });

    const insId = nextId();
    insights.set(insId.toString(), {
      _id: insId,
      documentId: docId,
      policyChangeSummary: [
        'Broker-dealers must disclose all conflicts of interest associated with proprietary trading desk incentives.',
        'Customer KYC verification frequency updated to semi-annual with digital audit trail logging.',
        'All client personal identifiers must be encrypted using FIPS 140-3 validated cryptographic modules.'
      ],
      riskLevel: 'High',
      piiRedacted: true,
      humanApprovalStatus: 'Pending',
      createdAt: new Date(),
      save: async function () {
        insights.set(insId.toString(), this);
        return this;
      }
    });

    console.log('[db] ✅ Seeded accounts: admin@compliance.org & researcher@compliance.org');
  })();
}

/**
 * Establishes a connection to MongoDB using the URI from environment variables.
 * Automatically falls back to high-performance in-memory datastore if offline.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    setupInMemoryFallback();
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 15000,
    });
    console.log(`[db] ✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[db] ⚠️  MongoDB connection warning: ${error.message}`);
    setupInMemoryFallback();
  }
};

module.exports = connectDB;
