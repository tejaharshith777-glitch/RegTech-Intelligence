'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
  uploadDocument,
  getInsights,
  updateInsightApproval,
  getInsightById,
  compareDocuments,
  verifyAuditChain,
} = require('../controllers/research.controller');

const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');
const { approveInsightSchema, validate } = require('../validators/auth.validator');

// ─── Upload-specific Rate Limiter ──────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload limit reached. Please wait before uploading more files.',
  },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Upload Document with Provenance & PII Guardrail
router.post(
  '/upload',
  protect,
  uploadLimiter,
  upload.single('document'),
  uploadDocument
);

// Get All Insights (Dashboard)
router.get('/insights', protect, getInsights);

// UPGRADE 4: Verify SHA-256 Hash Chain Integrity
router.get('/audit/verify', protect, verifyAuditChain);

// UPGRADE 2: Compare Two Document Versions
router.post('/compare', protect, compareDocuments);

// Get Single Insight by ID
router.get('/insights/:id', protect, getInsightById);

// Approve or Reject an Insight (Human-in-the-Loop decision)
router.put(
  '/insights/:id/approve',
  protect,
  requireAdmin,
  validate(approveInsightSchema),
  updateInsightApproval
);

module.exports = router;
