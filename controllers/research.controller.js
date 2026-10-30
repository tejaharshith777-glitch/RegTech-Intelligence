'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const { getGeminiClient } = require('../config/gemini');
const Document = require('../models/Document.model');
const Insight = require('../models/Insight.model');
const { redactPolicyChanges } = require('../utils/piiGuard');

// ─── Gemini Prompt Builder with Provenance ────────────────────────────────────

/**
 * Constructs the structured prompt sent to Gemini.
 * Enforces provenance: page, verbatim clause, obligation tier, and strict JSON.
 */
const buildGeminiPrompt = () => `
You are an expert Regulatory Compliance Analyst AI agent operating under strict legal audit guardrails.

Your task is to analyze the provided PDF document and extract actionable regulatory obligations with EXACT PROVENANCE. Follow ALL rules below without exception.

GUARDRAILS (MANDATORY):
1. PII REDACTION: Scan all extracted text for Personally Identifiable Information (PII) including names,
   SSNs, phone numbers, emails, addresses, DOBs, passport numbers, and financial account numbers.
   Replace EVERY occurrence of PII with [REDACTED]. This is a non-negotiable security requirement.

2. PROVENANCE (PAGE + VERBATIM CLAUSE):
   For EVERY policy change or obligation you extract, you MUST provide:
   - "change": A concise summary of the mandate (max 200 characters).
   - "page": The PDF page number where the change appears (integer, default 1 if single page).
   - "verbatimClause": The EXACT sentence(s) from the document, copied character-for-character.
     Never paraphrase. If you cannot locate an exact clause, omit the change.
   - "obligation": Exactly one of: "MANDATORY" | "RECOMMENDED" | "ADVISORY".
   - "deadline": The compliance deadline as written in the text, or null if unspecified.

3. RISK CLASSIFICATION: Based on the severity, penalties, and operational breadth, assign an overall
   risk level: "Low" | "Medium" | "High".

4. STRICT JSON OUTPUT ONLY: Return ONLY a valid JSON object matching the schema below. No markdown fences.

OUTPUT SCHEMA:
{
  "policyChangeSummary": [
    {
      "change": "...",
      "page": 1,
      "verbatimClause": "...",
      "obligation": "MANDATORY" | "RECOMMENDED" | "ADVISORY",
      "deadline": "30 days" | null
    }
  ],
  "riskLevel": "Low" | "Medium" | "High",
  "piiRedacted": true | false
}

If no significant policy changes are found, return:
{
  "policyChangeSummary": [
    {
      "change": "No actionable regulatory obligations identified.",
      "page": 1,
      "verbatimClause": "Document reviewed in full; no compliance amendments detected.",
      "obligation": "ADVISORY",
      "deadline": null
    }
  ],
  "riskLevel": "Low",
  "piiRedacted": false
}
`;

// ─── JSON Parser with Guardrails ─────────────────────────────────────────────

const parseGeminiResponse = (rawText) => {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (jsonError) {
    throw new Error(
      `Gemini returned malformed JSON: ${jsonError.message}. Preview: ${cleaned.slice(0, 200)}`
    );
  }

  if (!Array.isArray(parsed.policyChangeSummary) || parsed.policyChangeSummary.length === 0) {
    throw new Error('Gemini response missing or empty "policyChangeSummary" array.');
  }

  // Normalize items to ensure provenance structure
  parsed.policyChangeSummary = parsed.policyChangeSummary.map((item, idx) => {
    if (typeof item === 'string') {
      return {
        change: item,
        page: 1,
        verbatimClause: item,
        obligation: 'MANDATORY',
        deadline: null,
      };
    }
    return {
      change: item.change || `Obligation #${idx + 1}`,
      page: Number(item.page) || 1,
      verbatimClause: item.verbatimClause || item.change || 'Clause unavailable',
      obligation: ['MANDATORY', 'RECOMMENDED', 'ADVISORY'].includes(item.obligation)
        ? item.obligation
        : 'MANDATORY',
      deadline: item.deadline || null,
    };
  });

  if (!['Low', 'Medium', 'High'].includes(parsed.riskLevel)) {
    parsed.riskLevel = 'Medium';
  }

  return parsed;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc Upload PDF, extract policy provenance via Gemini, apply 2nd-pass PII guard, persist
 * @route POST /api/research/upload
 */
const uploadDocument = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please attach a PDF file with field name "document".',
    });
  }

  const { originalname, buffer, mimetype, size } = req.file;
  let documentRecord = null;

  try {
    documentRecord = await Document.create({
      filename: originalname,
      uploadedBy: req.user._id,
      status: 'pending',
    });

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-pro-latest',
    ];

    let geminiResult = null;
    let usedModelName = 'gemini-2.5-flash';

    for (const modelName of candidateModels) {
      try {
        console.log(`[research] 🤖 Analyzing "${originalname}" using ${modelName}...`);
        const model = geminiClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        geminiResult = await model.generateContent([buildGeminiPrompt(), pdfPart]);
        usedModelName = modelName;
        break; // Succeeded!
      } catch (err) {
        const isQuotaOrTransient =
          err.message?.includes('429') ||
          err.message?.includes('503') ||
          err.message?.includes('quota') ||
          err.message?.includes('high demand');

        if (isQuotaOrTransient) {
          console.warn(`[research] ⚠️  Model ${modelName} hit quota/transient issue. Cascading to next model...`);
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!geminiResult) {
      throw new Error('All AI candidate models exhausted their capacity. Please try again shortly.');
    }

    const rawResponseText = geminiResult.response.text();
    const parsed = parseGeminiResponse(rawResponseText);

    // ── UPGRADE 3: Deterministic Second-Pass PII Guard ───────────────────────
    const { items: sanitizedPolicies, meta: piiAudit } = redactPolicyChanges(parsed.policyChangeSummary);

    const hasPiiRedaction = parsed.piiRedacted || piiAudit.modelRedactions > 0 || piiAudit.serverRedactions > 0;

    // ── Save Insight Record with Provenance & PII Telemetry ──────────────────
    const insight = await Insight.create({
      documentId: documentRecord._id,
      policyChangeSummary: sanitizedPolicies,
      riskLevel: parsed.riskLevel,
      piiRedacted: hasPiiRedaction,
      piiAudit: {
        modelRedactions: piiAudit.modelRedactions,
        serverRedactions: piiAudit.serverRedactions,
        residualAfterScan: piiAudit.residualAfterScan,
        clean: piiAudit.clean,
      },
      humanApprovalStatus: 'Pending',
    });

    documentRecord.status = 'processed';
    await documentRecord.save();

    console.log(`[research] ✅ Processed "${originalname}": ${sanitizedPolicies.length} mandates | PII (Model: ${piiAudit.modelRedactions}, Server: ${piiAudit.serverRedactions}, Residual: ${piiAudit.residualAfterScan})`);

    return res.status(201).json({
      success: true,
      message: 'Document analyzed with provenance and deterministic PII verification.',
      data: {
        document: {
          id: documentRecord._id,
          filename: documentRecord.filename,
          status: documentRecord.status,
          uploadDate: documentRecord.uploadDate,
        },
        insight: {
          id: insight._id,
          policyChangeSummary: insight.policyChangeSummary,
          riskLevel: insight.riskLevel,
          piiRedacted: insight.piiRedacted,
          piiAudit: insight.piiAudit,
          humanApprovalStatus: insight.humanApprovalStatus,
        },
      },
    });
  } catch (error) {
    if (documentRecord && documentRecord.status === 'pending') {
      try {
        documentRecord.status = 'failed';
        await documentRecord.save();
      } catch (saveError) {
        console.error(`[research] Status fail error: ${saveError.message}`);
      }
    }
    return next(error);
  }
};

/**
 * @desc Retrieve all insights for the dashboard
 * @route GET /api/research/insights
 */
const getInsights = async (req, res, next) => {
  try {
    const { status, riskLevel, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      filter.humanApprovalStatus = status;
    }
    if (riskLevel && ['Low', 'Medium', 'High'].includes(riskLevel)) {
      filter.riskLevel = riskLevel;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [insights, total] = await Promise.all([
      Insight.find(filter)
        .populate({
          path: 'documentId',
          select: 'filename uploadedBy uploadDate status',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Insight.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        insights,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc Approve or reject an insight with SHA-256 hash chaining
 * @route PUT /api/research/insights/:id/approve
 */
const updateInsightApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { humanApprovalStatus, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `"${id}" is not a valid Insight ID.`,
      });
    }

    const insight = await Insight.findById(id);
    if (!insight) {
      return res.status(404).json({
        success: false,
        message: 'Insight not found.',
      });
    }

    if (insight.humanApprovalStatus !== 'Pending') {
      return res.status(409).json({
        success: false,
        message: `Insight has already been ${insight.humanApprovalStatus.toLowerCase()}. Decisions are locked by the audit trail.`,
      });
    }

    // ── UPGRADE 4: Hash-Chained Audit Ledger ─────────────────────────────────
    // Find the last finalized block in the ledger
    const lastFinalized = await Insight.findOne({
      approvalHash: { $ne: null },
    }).sort({ approvedAt: -1 });

    const prevHash = lastFinalized?.approvalHash || 'GENESIS_COMPLIANCE_BLOCK_0000000000000000';
    const timestamp = new Date().toISOString();
    const userId = req.user?._id?.toString() || 'SYSTEM_REVIEWER';

    const ledgerPayload = `${prevHash}|${insight._id}|${humanApprovalStatus}|${userId}|${timestamp}|${reason || ''}`;
    const approvalHash = crypto.createHash('sha256').update(ledgerPayload).digest('hex');

    insight.humanApprovalStatus = humanApprovalStatus;
    insight.approvalReason = reason || null;
    insight.prevApprovalHash = prevHash;
    insight.approvalHash = approvalHash;
    insight.approvedBy = req.user?._id;
    insight.approvedAt = new Date();

    await insight.save();

    console.log(`[audit-ledger] 🔗 Hash-chain extended: block ${approvalHash.slice(0, 12)}... (prev: ${prevHash.slice(0, 12)}...)`);

    return res.status(200).json({
      success: true,
      message: `Insight has been successfully ${humanApprovalStatus.toLowerCase()}.`,
      data: {
        insight,
        auditReceipt: {
          approvalHash,
          prevApprovalHash: prevHash,
          timestamp,
          ledgerValid: true,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc UPGRADE 4: Verify the integrity of the SHA-256 audit ledger
 * @route GET /api/research/audit/verify
 */
const verifyAuditChain = async (req, res, next) => {
  try {
    const chain = await Insight.find({ approvalHash: { $ne: null } })
      .sort({ approvedAt: 1 })
      .lean();

    if (chain.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          valid: true,
          entries: 0,
          message: 'Audit ledger is currently empty. Genesis block ready.',
        },
      });
    }

    let isValid = true;
    let failureReason = null;

    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      const prevHash = i === 0
        ? 'GENESIS_COMPLIANCE_BLOCK_0000000000000000'
        : chain[i - 1].approvalHash;

      if (current.prevApprovalHash !== prevHash) {
        isValid = false;
        failureReason = `Block link mismatch at index ${i}: expected prevHash ${prevHash}, got ${current.prevApprovalHash}`;
        break;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        valid: isValid,
        entries: chain.length,
        lastHash: chain[chain.length - 1]?.approvalHash,
        failureReason,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc UPGRADE 2: Regulatory Version Diff
 * @route POST /api/research/compare
 * Compares two regulatory documents and extracts additions, removals, and modifications
 */
const compareDocuments = async (req, res, next) => {
  try {
    const { documentIdA, documentIdB } = req.body;

    if (!documentIdA || !documentIdB) {
      return res.status(400).json({
        success: false,
        message: 'Both documentIdA and documentIdB are required for version comparison.',
      });
    }

    const [insightA, insightB] = await Promise.all([
      Insight.findOne({ documentId: documentIdA }).populate('documentId', 'filename'),
      Insight.findOne({ documentId: documentIdB }).populate('documentId', 'filename'),
    ]);

    if (!insightA || !insightB) {
      return res.status(404).json({
        success: false,
        message: 'One or both documents do not have extracted insights.',
      });
    }

    const policiesA = insightA.policyChangeSummary || [];
    const policiesB = insightB.policyChangeSummary || [];

    // Structural comparison
    const changesA = policiesA.map((p) => p.change || p);
    const changesB = policiesB.map((p) => p.change || p);

    const added = policiesB.filter(
      (b) => !changesA.some((a) => a.toLowerCase().includes((b.change || '').slice(0, 25).toLowerCase()))
    );

    const removed = policiesA.filter(
      (a) => !changesB.some((b) => b.toLowerCase().includes((a.change || '').slice(0, 25).toLowerCase()))
    );

    const modified = [];
    policiesA.forEach((pA) => {
      const match = policiesB.find((pB) => {
        const textA = (pA.change || '').toLowerCase();
        const textB = (pB.change || '').toLowerCase();
        return textA !== textB && (textA.includes(textB.slice(0, 20)) || textB.includes(textA.slice(0, 20)));
      });
      if (match) {
        modified.push({
          before: pA.change,
          after: match.change,
          beforePage: pA.page,
          afterPage: match.page,
          clauseRef: match.verbatimClause,
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        documentA: { id: documentIdA, filename: insightA.documentId?.filename },
        documentB: { id: documentIdB, filename: insightB.documentId?.filename },
        diffSummary: {
          addedCount: added.length,
          removedCount: removed.length,
          modifiedCount: modified.length,
        },
        added,
        removed,
        modified,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getInsightById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `"${id}" is not a valid Insight ID.` });
    }
    const insight = await Insight.findById(id).populate('documentId', 'filename uploadedBy uploadDate status').lean();
    if (!insight) {
      return res.status(404).json({ success: false, message: 'Insight not found.' });
    }
    return res.status(200).json({ success: true, data: { insight } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadDocument,
  getInsights,
  updateInsightApproval,
  getInsightById,
  compareDocuments,
  verifyAuditChain,
};
