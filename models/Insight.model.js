'use strict';

const mongoose = require('mongoose');

/**
 * Individual Policy Change Mandate with Provenance
 */
const policyObligationSchema = new mongoose.Schema(
  {
    change: {
      type: String,
      required: [true, 'Policy change summary is required.'],
    },
    page: {
      type: Number,
      default: 1,
    },
    verbatimClause: {
      type: String,
      required: [true, 'Verbatim source clause is required for audit provenance.'],
    },
    obligation: {
      type: String,
      enum: ['MANDATORY', 'RECOMMENDED', 'ADVISORY'],
      default: 'MANDATORY',
    },
    deadline: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

/**
 * @typedef {Object} IInsight
 * @property {mongoose.Types.ObjectId} documentId - Reference to source Document
 * @property {Array} policyChangeSummary - Structured changes with provenance receipts
 * @property {'Low'|'Medium'|'High'} riskLevel - AI risk classification
 * @property {boolean} piiRedacted - Boolean flag indicating redaction was performed
 * @property {Object} piiAudit - Deterministic scanner audit telemetry
 * @property {'Pending'|'Approved'|'Rejected'} humanApprovalStatus - HITL decision status
 * @property {string} approvalHash - SHA-256 audit ledger hash
 * @property {string} prevApprovalHash - Previous ledger block hash
 */
const insightSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document reference is required.'],
    },
    policyChangeSummary: {
      type: [policyObligationSchema],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'policyChangeSummary must contain at least one obligation mandate.',
      },
    },
    riskLevel: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: "riskLevel must be 'Low', 'Medium', or 'High'.",
      },
      required: [true, 'Risk level is required.'],
    },
    piiRedacted: {
      type: Boolean,
      required: true,
      default: false,
    },
    piiAudit: {
      modelRedactions: { type: Number, default: 0 },
      serverRedactions: { type: Number, default: 0 },
      residualAfterScan: { type: Number, default: 0 },
      clean: { type: Boolean, default: true },
    },
    humanApprovalStatus: {
      type: String,
      enum: {
        values: ['Pending', 'Approved', 'Rejected'],
        message: "humanApprovalStatus must be 'Pending', 'Approved', or 'Rejected'.",
      },
      default: 'Pending',
    },
    approvalReason: {
      type: String,
      default: null,
    },
    approvalHash: {
      type: String,
      default: null,
    },
    prevApprovalHash: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
insightSchema.index({ documentId: 1 });
insightSchema.index({ humanApprovalStatus: 1 });
insightSchema.index({ riskLevel: 1 });
insightSchema.index({ approvalHash: 1 });

const Insight = mongoose.model('Insight', insightSchema);
module.exports = Insight;
