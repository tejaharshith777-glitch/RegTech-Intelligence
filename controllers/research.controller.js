'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const { getGeminiClient, listAvailableModels, generateWithRest } = require('../config/gemini');
const Document = require('../models/Document.model');
const Insight = require('../models/Insight.model');
const { redactPolicyChanges } = require('../utils/piiGuard');
const { extractPdfText, verifyClause, squash } = require('../utils/pdfText');

// ─── Gemini Prompt Builder with Provenance ────────────────────────────────────

/**
 * Constructs the structured prompt sent to Gemini.
 * Enforces provenance: page, verbatim clause, obligation tier, declared scope.
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
   - "meaning": One plain-language sentence explaining what the firm must actually do, written for
     someone who has not read the regulation.
   - "page": The PDF page number where the change appears (integer, default 1 if single page).
   - "verbatimClause": The EXACT sentence(s) from the document, copied character-for-character.
     Never paraphrase. If you cannot locate an exact clause, omit the change.
   - "obligation": Exactly one of: "MANDATORY" | "RECOMMENDED" | "ADVISORY".
   - "deadline": The compliance deadline as written in the text, or null if unspecified.
   - "appliesTo": Array of entity types the obligation targets, derived ONLY from the document's
     stated scope section (for example ["NBFC","bank"]). Use an empty array if the document does
     not state its scope. Never guess an entity type that is not written in the document.

   For every policy change also return the EXACT sentence from the document that states it
   (copy character-for-character, never paraphrase), the page number it appears on, whether it
   is MANDATORY/RECOMMENDED/ADVISORY, and which entity types it applies to based only on the
   document's stated scope. If you cannot locate an exact clause, omit that change.

3. RISK CLASSIFICATION: Based on the severity, penalties, and operational breadth, assign an overall
   risk level: "Low" | "Medium" | "High".

4. STRICT JSON OUTPUT ONLY: Return ONLY a valid JSON object matching the schema below. No markdown fences.

OUTPUT SCHEMA:
{
  "policyChangeSummary": [
    {
      "change": "...",
      "meaning": "...",
      "page": 1,
      "verbatimClause": "...",
      "obligation": "MANDATORY" | "RECOMMENDED" | "ADVISORY",
      "deadline": "30 days" | null,
      "appliesTo": ["bank"] | []
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
      "meaning": "No action is required from this document.",
      "page": 1,
      "verbatimClause": "",
      "obligation": "ADVISORY",
      "deadline": null,
      "appliesTo": []
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
        meaning: item,
        page: 1,
        verbatimClause: item,
        obligation: 'MANDATORY',
        deadline: null,
        appliesTo: [],
      };
    }

    const appliesTo = Array.isArray(item.appliesTo)
      ? item.appliesTo.filter((e) => typeof e === 'string' && e.trim()).map((e) => e.trim())
      : [];

    return {
      change: item.change || `Obligation #${idx + 1}`,
      meaning: item.meaning || null,
      page: Number(item.page) || 1,
      verbatimClause: item.verbatimClause || item.clause || item.change || '',
      obligation: ['MANDATORY', 'RECOMMENDED', 'ADVISORY'].includes(item.obligation)
        ? item.obligation
        : 'MANDATORY',
      deadline: item.deadline || null,
      appliesTo,
    };
  });

  if (!['Low', 'Medium', 'High'].includes(parsed.riskLevel)) {
    parsed.riskLevel = 'Medium';
  }

  return parsed;
};

// ─── Clause Verification ─────────────────────────────────────────────────────

/**
 * Checks every returned clause against the real PDF text.
 * A clause the document does not contain is not a citation - it is a hazard.
 * Such obligations are kept, but their clause and page are nulled so the UI
 * can never present a fabricated reference as evidence.
 *
 * @param {Array} obligations
 * @param {{ text: string, usable: boolean, pageCount: number }} extracted
 */
const verifyObligationClauses = (obligations, extracted) => {
  const gaps = { verified: 0, unverified: 0, mismatch: 0 };

  const items = obligations.map((ob) => {
    const clause = (ob.verbatimClause || '').trim();

    if (!extracted.usable) {
      // No text layer (likely a scan). Be explicit rather than pretend.
      gaps.unverified++;
      return { ...ob, clauseVerification: 'unverified' };
    }

    if (!clause) {
      gaps.mismatch++;
      return { ...ob, verbatimClause: null, page: null, clauseVerification: 'mismatch' };
    }

    const { verified } = verifyClause(clause, extracted);
    if (!verified) {
      gaps.mismatch++;
      console.warn(`[provenance] ⚠️  Clause not found in document, nulling reference: "${clause.slice(0, 70)}..."`);
      return { ...ob, verbatimClause: null, page: null, clauseVerification: 'mismatch' };
    }

    gaps.verified++;

    // Clamp the page to the real page count.
    let page = Number(ob.page);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (extracted.pageCount > 0 && page > extracted.pageCount) page = extracted.pageCount;

    return { ...ob, page, clauseVerification: 'verified' };
  });

  return { items, gaps };
};

// ─── Applicability Triage ────────────────────────────────────────────────────

/**
 * APPLIES       - the user's declared entity types intersect the obligation's scope
 * OUT_OF_SCOPE  - the obligation declares a scope, and the user is not in it
 * UNCLEAR       - the document never stated a scope
 */
const computeApplicability = (obligation, user) => {
  const declared = (user?.applicability?.entityTypes || []).map((e) => String(e).toLowerCase().trim());
  const targets = (obligation?.appliesTo || []).map((e) => String(e).toLowerCase().trim());

  if (!targets.length) return 'UNCLEAR';
  if (!declared.length) return 'UNCLEAR';

  const overlap = targets.some((t) => declared.some((d) => t === d || t.includes(d) || d.includes(t)));
  return overlap ? 'APPLIES' : 'OUT_OF_SCOPE';
};

/** Decorate an insight with per-obligation applicability (response only, never stored). */
const decorateInsight = (insight, user) => {
  // Mongoose subdocuments must be converted with toObject(); spreading them
  // yields internal fields instead of the schema values.
  const plainObligation = (ob) => {
    if (ob === null || ob === undefined) return { change: '' };
    if (typeof ob !== 'object') return { change: String(ob) };
    if (typeof ob.toObject === 'function') return ob.toObject();
    return ob;
  };

  const obligations = (insight.policyChangeSummary || []).map((ob) => {
    const plain = plainObligation(ob);
    return { ...plain, applicability: computeApplicability(plain, user) };
  });

  const base =
    typeof insight.toObject === 'function' ? insight.toObject() : { ...insight };

  return { ...base, policyChangeSummary: obligations };
};

/** Aggregate triage counts so the dashboard can show one honest line. */
const buildTriage = (decoratedInsights) => {
  const triage = { obligations: 0, applies: 0, outOfScope: 0, unclear: 0, needsReview: 0 };

  for (const insight of decoratedInsights) {
    for (const ob of insight.policyChangeSummary || []) {
      triage.obligations++;
      if (ob.applicability === 'APPLIES') triage.applies++;
      else if (ob.applicability === 'OUT_OF_SCOPE') triage.outOfScope++;
      else triage.unclear++;
    }
    if (insight.humanApprovalStatus === 'Pending') triage.needsReview++;
  }

  return triage;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc Upload PDF, extract policy provenance via Gemini, apply 2nd-pass PII guard,
 *       verify every clause against the real document text, persist
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

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'The uploaded file is empty.',
    });
  }

  if (mimetype !== 'application/pdf') {
    return res.status(415).json({
      success: false,
      message: `Invalid file type: "${mimetype}". Only PDF files are accepted.`,
    });
  }

  let documentRecord = null;
  let stage = 'create-document';

  try {
    documentRecord = await Document.create({
      filename: originalname,
      uploadedBy: req.user._id,
      status: 'pending',
    });

    // ── Encode the in-memory PDF for the Gemini request (no disk write) ──────
    const pdfPart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    // ── Pull the real text out of the PDF so clauses can be verified ─────────
    stage = 'extract-text';
    const extracted = extractPdfText(buffer);
    console.log(
      `[research] 📄 "${originalname}": ${(size / 1024).toFixed(1)} KB, ${extracted.pageCount} page(s), ` +
        `text layer ${extracted.usable ? 'found' : 'NOT found (scanned?)'}`
    );

    stage = 'init-gemini';
    const geminiClient = getGeminiClient();
    let geminiResult = null;
    let usedModelName = null;
    let lastError = null;

    // Preferred first, then whatever this API key can actually see. Google
    // retires model names regularly (2.5-pro is already closed to new keys),
    // so the list is discovered at runtime instead of trusted forever.
    const PREFERRED_MODELS = [
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-pro-latest',
    ];

    const score = (name) => {
      let sc = 0;
      if (/flash/i.test(name)) sc += 10;
      if (/latest/i.test(name)) sc += 5;
      if (/preview|exp/i.test(name)) sc -= 2;
      if (/pro/i.test(name)) sc -= 1;
      if (/thinking/i.test(name)) sc -= 6;
      return sc;
    };

    const discovered = (await listAvailableModels()).slice().sort((a, b) => score(b) - score(a));
    // Discovered models are known to exist for this key, so they go first;
    // PREFERRED_MODELS is only a backstop for when ListModels itself fails.
    const candidateModels = [...new Set([...discovered, ...PREFERRED_MODELS])].slice(0, 12);

    /**
     * A model that is missing, retired, renamed or over quota must never abort
     * the whole upload — only a genuine content error should stop us.
     */
    const isAvailabilityError = (err) => {
      const m = String(err?.message || '');
      // Deliberately narrow: model-availability / capacity failures only.
      // A bad prompt or a missing API key must fail fast, not burn 4 models.
      return /429|\b50[023]\b|quota|rate limit|high demand|not found|no longer available|deprecated|invalid model|unknown model|resource_exhausted|overloaded|does not exist/i.test(m);
    };

    stage = 'gemini';
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
        break; // Succeeded
      } catch (err) {
        lastError = err;
        if (isAvailabilityError(err)) {
          console.warn(`[research] ⚠️  ${modelName} unavailable: ${String(err.message).slice(0, 110)}`);
          continue;
        }
        throw err;
      }
    }

    // ── Second route: the same models, called directly over REST ────────────
    // Protects against a stale SDK, not a stale model list.
    if (!geminiResult) {
      console.warn('[research] SDK route exhausted; falling back to the REST endpoint...');
      for (const modelName of candidateModels) {
        try {
          const { text } = await generateWithRest({
            model: modelName,
            prompt: buildGeminiPrompt(),
            pdfBase64: pdfPart.inlineData.data,
          });
          geminiResult = { response: { text: () => text } };
          usedModelName = `${modelName} (REST)`;
          break;
        } catch (err) {
          lastError = err;
          console.warn(`[research] ⚠️  REST ${modelName} failed: ${String(err.message).slice(0, 110)}`);
        }
      }
    }

    if (!geminiResult) {
      // Give the caller something actionable instead of a bare 500.
      const detail = String(lastError?.message || 'no model responded').slice(0, 240);
      const err = new Error(`No Gemini model could be used with this API key. Last error: ${detail}`);
      err.statusCode = 503;
      throw err;
    }

    console.log(`[research] ✅ Extraction used model: ${usedModelName}`);

    stage = 'parse';
    const rawResponseText = geminiResult.response.text();
    const parsed = parseGeminiResponse(rawResponseText);

    // ── Deterministic Second-Pass PII Guard ─────────────────────────────────
    stage = 'pii-guard';
    const { items: sanitizedPolicies, meta: piiAudit } = redactPolicyChanges(parsed.policyChangeSummary);

    // ── Clause Verification against the actual PDF text ─────────────────────
    stage = 'clause-verify';
    const { items: verifiedPolicies, gaps: provenanceGaps } = verifyObligationClauses(
      sanitizedPolicies,
      extracted
    );

    const hasPiiRedaction =
      parsed.piiRedacted || piiAudit.modelRedactions > 0 || piiAudit.serverRedactions > 0;

    // ── Save Insight Record with Provenance & PII Telemetry ─────────────────
    stage = 'save-insight';
    const insight = await Insight.create({
      documentId: documentRecord._id,
      policyChangeSummary: verifiedPolicies,
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

    console.log(
      `[research] ✅ Processed "${originalname}": ${verifiedPolicies.length} mandates | ` +
        `Provenance: ${provenanceGaps.verified} verified, ${provenanceGaps.mismatch} unverifiable, ${provenanceGaps.unverified} no-text-layer | ` +
        `PII (Model: ${piiAudit.modelRedactions}, Server: ${piiAudit.serverRedactions}, Residual: ${piiAudit.residualAfterScan})`
    );

    return res.status(201).json({
      success: true,
      message: 'Document analyzed with provenance and deterministic PII verification.',
      data: {
        document: {
          id: documentRecord._id,
          filename: documentRecord.filename,
          status: documentRecord.status,
          uploadDate: documentRecord.uploadDate,
          pageCount: extracted.pageCount,
        },
        insight: decorateInsight(
          {
            id: insight._id,
            policyChangeSummary: insight.policyChangeSummary,
            riskLevel: insight.riskLevel,
            piiRedacted: insight.piiRedacted,
            piiAudit: insight.piiAudit,
            humanApprovalStatus: insight.humanApprovalStatus,
          },
          req.user
        ),
        provenance: provenanceGaps,
      },
    });
  } catch (error) {
    console.error(
      `[research] ❌ upload failed at stage "${stage}" for "${originalname}": ${error.name}: ${error.message}`
    );

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
        .populate({ path: 'approvedBy', select: 'id username' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Insight.countDocuments(filter),
    ]);

    const decorated = insights.map((i) => decorateInsight(i, req.user));

    return res.status(200).json({
      success: true,
      data: {
        insights: decorated,
        triage: buildTriage(decorated),
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
 * @desc Approve or reject an insight with SHA-256 hash chaining.
 *       Maker-checker: only an administrator may decide.
 * @route PUT /api/research/insights/:id/approve
 */
const updateInsightApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { humanApprovalStatus } = req.body;

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

    // ── Maker-checker: the preparer cannot be the finaliser ─────────────────
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only an administrator can approve or reject a compliance finding.',
      });
    }

    const note = (
      typeof req.body.reason === 'string'
        ? req.body.reason
        : typeof req.body.note === 'string'
          ? req.body.note
          : ''
    ).trim();

    if (humanApprovalStatus === 'Rejected' && note.length < 10) {
      return res.status(422).json({
        success: false,
        message: 'A rejection reason of at least 10 characters is required.',
        errors: [{ field: 'reason', message: 'A rejection reason of at least 10 characters is required.' }],
      });
    }

    // ── Hash-Chained Audit Ledger ───────────────────────────────────────────
    const lastFinalized = await Insight.findOne({
      approvalHash: { $ne: null },
    }).sort({ approvedAt: -1 });

    const prevHash = lastFinalized?.approvalHash || 'GENESIS_COMPLIANCE_BLOCK_0000000000000000';
    const timestamp = new Date().toISOString();
    const userId = req.user._id.toString();

    const ledgerPayload = `${prevHash}|${insight._id}|${humanApprovalStatus}|${userId}|${timestamp}|${note}`;
    const approvalHash = crypto.createHash('sha256').update(ledgerPayload).digest('hex');

    insight.humanApprovalStatus = humanApprovalStatus;
    insight.approvalReason = note || null;
    insight.reviewerNote = note || null;
    insight.prevApprovalHash = prevHash;
    insight.approvalHash = approvalHash;
    insight.approvedBy = req.user._id;
    insight.approvedAt = new Date(timestamp);
    insight.clarificationRequestedBy = null;
    insight.clarificationRequestedAt = null;

    await insight.save();

    console.log(
      `[audit-ledger] 🔗 ${humanApprovalStatus} by ${req.user.username} (${req.user.role}): block ${approvalHash.slice(0, 12)}... (prev: ${prevHash.slice(0, 12)}...)`
    );

    const populated = await Insight.findById(insight._id).populate({
      path: 'approvedBy',
      select: 'id username',
    });

    return res.status(200).json({
      success: true,
      message: `Insight has been successfully ${humanApprovalStatus.toLowerCase()}.`,
      data: {
        insight: decorateInsight(populated.toObject ? populated.toObject() : populated, req.user),
        auditReceipt: {
          approvalHash,
          prevApprovalHash: prevHash,
          timestamp,
          actor: { id: req.user._id, username: req.user.username, role: req.user.role },
          reviewerNote: note || null,
          ledgerValid: true,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc Request clarification on an insight. Status stays Pending - this is a
 *       question, not a decision, so it never writes to the hash chain.
 * @route POST /api/research/insights/:id/clarify
 */
const clarifyInsight = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `"${id}" is not a valid Insight ID.` });
    }

    const insight = await Insight.findById(id);
    if (!insight) {
      return res.status(404).json({ success: false, message: 'Insight not found.' });
    }

    if (insight.humanApprovalStatus !== 'Pending') {
      return res.status(409).json({
        success: false,
        message: `Insight has already been ${insight.humanApprovalStatus.toLowerCase()}. Decisions are locked by the audit trail.`,
      });
    }

    insight.reviewerNote = req.body.question.trim();
    insight.clarificationRequestedBy = req.user._id;
    insight.clarificationRequestedAt = new Date();
    await insight.save();

    return res.status(200).json({
      success: true,
      message: 'Clarification requested. The finding stays Pending.',
      data: {
        insight: {
          id: insight._id,
          humanApprovalStatus: insight.humanApprovalStatus,
          reviewerNote: insight.reviewerNote,
          clarificationRequestedAt: insight.clarificationRequestedAt,
          clarificationRequestedBy: {
            id: req.user._id,
            username: req.user.username,
          },
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc Verify the integrity of the SHA-256 audit ledger
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
      const prevHash =
        i === 0 ? 'GENESIS_COMPLIANCE_BLOCK_0000000000000000' : chain[i - 1].approvalHash;

      if (current.prevApprovalHash !== prevHash) {
        isValid = false;
        failureReason = `Block link mismatch at index ${i}: expected prevHash ${prevHash}, got ${current.prevApprovalHash}`;
        break;
      }

      const userId = current.approvedBy?.toString() || 'SYSTEM_REVIEWER';
      const timestamp = current.approvedAt?.toISOString() || '';
      const ledgerPayload = `${prevHash}|${current._id}|${current.humanApprovalStatus}|${userId}|${timestamp}|${current.approvalReason || ''}`;
      const recomputed = crypto.createHash('sha256').update(ledgerPayload).digest('hex');
      if (recomputed !== current.approvalHash) {
        isValid = false;
        failureReason = `Hash mismatch at block index ${i}: stored=${current.approvalHash.slice(0, 12)}..., recomputed=${recomputed.slice(0, 12)}...`;
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
 * @desc Regulatory Version Diff
 * @route POST /api/research/compare
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

    const changesA = policiesA.map((p) => p.change || p);
    const changesB = policiesB.map((p) => p.change || p);

    const added = policiesB.filter(
      (b) => !changesA.some((a) => String(a).toLowerCase().includes(String(b.change || '').slice(0, 25).toLowerCase()))
    );

    const removed = policiesA.filter(
      (a) => !changesB.some((b) => String(b).toLowerCase().includes(String(a.change || '').slice(0, 25).toLowerCase()))
    );

    const modified = [];
    policiesA.forEach((pA) => {
      const match = policiesB.find((pB) => {
        const textA = (pA.change || '').toLowerCase();
        const textB = (pB.change || '').toLowerCase();
        if (textA === textB || textB.length < 20 || textA.length < 20) return false;
        return textA.includes(textB.slice(0, 20)) || textB.includes(textA.slice(0, 20));
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
    const insight = await Insight.findById(id)
      .populate('documentId', 'filename uploadedBy uploadDate status')
      .populate('approvedBy', 'id username')
      .lean();
    if (!insight) {
      return res.status(404).json({ success: false, message: 'Insight not found.' });
    }
    return res.status(200).json({
      success: true,
      data: { insight: decorateInsight(insight, req.user) },
    });
  } catch (error) {
    return next(error);
  }
};

// ─── Evidence Exports ────────────────────────────────────────────────────────

const slugify = (s) =>
  String(s || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'document';

/** Load one insight with everything the evidence pack needs. */
const loadInsightForExport = async (id) => {
  const insight = await Insight.findById(id)
    .populate('documentId', 'filename uploadDate status')
    .populate('approvedBy', 'username')
    .populate('clarificationRequestedBy', 'username')
    .lean();
  return insight;
};

/** Re-run the same hash-chain verification used by /audit/verify. */
const verifyChainState = async () => {
  const chain = await Insight.find({ approvalHash: { $ne: null } }).sort({ approvedAt: 1 }).lean();
  if (!chain.length) return { valid: true, entries: 0, failureReason: null };

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    const prevHash =
      i === 0 ? 'GENESIS_COMPLIANCE_BLOCK_0000000000000000' : chain[i - 1].approvalHash;

    if (current.prevApprovalHash !== prevHash) {
      return { valid: false, entries: chain.length, failureReason: `Block link mismatch at index ${i}.` };
    }
    const userId = current.approvedBy?.toString() || 'SYSTEM_REVIEWER';
    const timestamp = current.approvedAt?.toISOString() || '';
    const payload = `${prevHash}|${current._id}|${current.humanApprovalStatus}|${userId}|${timestamp}|${current.approvalReason || ''}`;
    const recomputed = crypto.createHash('sha256').update(payload).digest('hex');
    if (recomputed !== current.approvalHash) {
      return { valid: false, entries: chain.length, failureReason: `Hash mismatch at block index ${i}.` };
    }
  }
  return { valid: true, entries: chain.length, failureReason: null, lastHash: chain[chain.length - 1].approvalHash };
};

/**
 * @desc Downloadable audit pack (markdown evidence bundle)
 * @route GET /api/research/insights/:id/audit-pack
 */
const getAuditPack = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `"${id}" is not a valid Insight ID.` });
    }

    const insight = await loadInsightForExport(id);
    if (!insight) return res.status(404).json({ success: false, message: 'Insight not found.' });

    const chain = await verifyChainState();
    const docName = insight.documentId?.filename || 'Regulatory document';
    const obligations = decorateInsight(insight, req.user).policyChangeSummary;

    const lines = [];
    lines.push(`# Audit Pack — ${docName}`);
    lines.push('');
    lines.push(`- **Document:** ${docName}`);
    lines.push(`- **Paragraph:** ${insight._id}`);
    lines.push(`- **Risk classification:** ${insight.riskLevel}`);
    lines.push(`- **Decision status:** ${insight.humanApprovalStatus}`);
    lines.push(`- **Ingested:** ${insight.createdAt}`);
    lines.push(`- **Generated:** ${new Date().toISOString()}`);
    lines.push(`- **Generated for:** ${req.user.username} (${req.user.role})`);
    lines.push('');
    lines.push(`> This document was produced from a synthetic test corpus modelled on FINRA / SEC / GDPR / HIPAA / Basel III / FinCEN formats. It is a software demonstration artefact, not legal advice.`);
    lines.push('');

    lines.push('## Obligations');
    obligations.forEach((ob, idx) => {
      lines.push('');
      lines.push(`### ${idx + 1}. ${ob.change}`);
      lines.push('');
      lines.push(`- **Applicability:** ${ob.applicability}`);
      lines.push(`- **Tier:** ${ob.obligation || 'MANDATORY'}`);
      lines.push(`- **Deadline:** ${ob.deadline || 'Not specified'}`);
      lines.push(`- **Applies to:** ${(ob.appliesTo || []).join(', ') || 'Not stated by the document'}`);
      if (ob.meaning) lines.push(`- **What this means:** ${ob.meaning}`);
      lines.push(`- **Clause reference:** ${ob.verbatimClause ? `p.${ob.page}` : 'No verifiable clause — reference withheld'}`);
      lines.push(
        `- **Clause verification:** ${ob.clauseVerification || 'unverified'}${
          ob.clauseVerification === 'mismatch' ? ' (quoted text not found in the PDF, so it is not presented as a citation)' : ''
        }`
      );
      if (ob.verbatimClause) {
        lines.push('');
        lines.push(`> ${ob.verbatimClause}`);
      }
    });

    lines.push('');
    lines.push('## Decision');
    lines.push('');
    if (insight.humanApprovalStatus === 'Pending') {
      lines.push('- **Status:** Pending — no human decision recorded yet.');
    } else {
      lines.push(`- **Decision:** ${insight.humanApprovalStatus}`);
      lines.push(`- **Actor:** ${insight.approvedBy?.username || 'unknown'}`);
      lines.push(`- **Timestamp:** ${insight.approvedAt ? new Date(insight.approvedAt).toISOString() : 'not recorded'}`);
      lines.push(`- **Reason:** ${insight.reviewerNote || insight.approvalReason || '_none recorded_'}`);
    }
    if (insight.clarificationRequestedAt) {
      lines.push(
        `- **Clarification requested by:** ${insight.clarificationRequestedBy?.username || 'unknown'} at ${new Date(insight.clarificationRequestedAt).toISOString()} — "${insight.reviewerNote || ''}"`
      );
    }

    lines.push('');
    lines.push('## Audit ledger');
    lines.push('');
    lines.push(`- **Chain valid:** ${chain.valid ? 'yes' : 'NO — integrity failure'}`);
    lines.push(`- **Ledger blocks:** ${chain.entries}`);
    if (chain.failureReason) lines.push(`- **Failure:** ${chain.failureReason}`);
    if (insight.approvalHash) {
      lines.push(`- **This block hash:** ${insight.approvalHash}`);
      lines.push(`- **Previous block hash:** ${insight.prevApprovalHash}`);
    }

    lines.push('');
    lines.push('## Integrity');
    lines.push('');
    const body = lines.join('\n');
    const digest = crypto.createHash('sha256').update(body).digest('hex');
    lines.push(`- **SHA-256 of this pack (excluding this line):** ${digest}`);
    lines.push('');

    const content = lines.join('\n');
    const filename = `audit-pack-${slugify(docName.replace(/\.pdf$/i, ''))}-${new Date()
      .toISOString()
      .slice(0, 10)}.md`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(content);
  } catch (error) {
    return next(error);
  }
};

/** RFC 4180 CSV field escaping. */
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * @desc Obligations as CSV for spreadsheet review
 * @route GET /api/research/insights/:id/obligations.csv
 */
const getObligationsCsv = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `"${id}" is not a valid Insight ID.` });
    }

    const insight = await loadInsightForExport(id);
    if (!insight) return res.status(404).json({ success: false, message: 'Insight not found.' });

    const obligations = decorateInsight(insight, req.user).policyChangeSummary;
    const docName = insight.documentId?.filename || 'document';

    const header = [
      'obligation',
      'clause_reference',
      'page',
      'deadline',
      'applicability',
      'owner',
      'decision',
    ];

    const rows = obligations.map((ob) => [
      ob.change,
      ob.verbatimClause ? squash(ob.verbatimClause) : '',
      ob.page ?? '',
      ob.deadline || '',
      ob.applicability,
      insight.approvedBy?.username || 'unassigned',
      insight.humanApprovalStatus,
    ]);

    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const filename = `obligations-${slugify(docName.replace(/\.pdf$/i, ''))}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM so Excel opens UTF-8 correctly
    return res.status(200).send('\uFEFF' + csv);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadDocument,
  getInsights,
  updateInsightApproval,
  clarifyInsight,
  getInsightById,
  compareDocuments,
  verifyAuditChain,
  getAuditPack,
  getObligationsCsv,
};
