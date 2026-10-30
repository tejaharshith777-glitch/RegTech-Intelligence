'use strict';

/**
 * Deterministic Second-Pass PII Guard
 * ────────────────────────────────────
 * Compliance cannot rely solely on an LLM prompt's good behavior.
 * This module runs a deterministic regex scan over 8 critical identifier patterns
 * to catch any residual PII missed by the model and sanitize it with [REDACTED].
 *
 * Patterns audited:
 * 1. EMAIL: Standard RFC 5322 compliant email addresses
 * 2. PHONE_INTL / PHONE_IN: International (E.164) & Indian phone patterns
 * 3. SSN: US Social Security Numbers (XXX-XX-XXXX)
 * 4. AADHAAR: Indian 12-digit UIDAI numbers (XXXX XXXX XXXX)
 * 5. CARD: Major credit/debit card numbers (Visa, MC, Amex, Discover)
 * 6. PAN: Indian Permanent Account Numbers ([A-Z]{5}[0-9]{4}[A-Z])
 * 7. ACCOUNT: Financial/brokerage bank account numbers
 * 8. PASSPORT: Common passport code patterns
 */

const PII_PATTERNS = [
  { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { name: 'PHONE', regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { name: 'AADHAAR', regex: /\b\d{4}\s\d{4}\s\d{4}\b/g },
  { name: 'PAN', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { name: 'CARD', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { name: 'PASSPORT', regex: /\b[A-Z]{1,3}[-]?\d{7,9}\b/g },
  { name: 'ACCOUNT', regex: /\b(?:Acct|Account|ACC)[:#\s]+[0-9]{8,14}\b/gi }
];

/**
 * Sanitizes a single text string through the deterministic PII scanner.
 *
 * @param {string} text
 * @returns {{ sanitized: string, modelCount: number, serverCount: number, residual: number }}
 */
function scanAndSanitizeText(text) {
  if (typeof text !== 'string') return { sanitized: text, modelCount: 0, serverCount: 0, residual: 0 };

  // 1. Count pre-existing model redactions
  const modelMatches = text.match(/\[REDACTED\]/g);
  const modelCount = modelMatches ? modelMatches.length : 0;

  // 2. Perform second-pass regex scan
  let serverCount = 0;
  let sanitized = text;

  for (const { regex } of PII_PATTERNS) {
    sanitized = sanitized.replace(regex, (match) => {
      // Don't replace if it's already [REDACTED]
      if (match === '[REDACTED]') return match;
      serverCount++;
      return '[REDACTED]';
    });
  }

  // 3. Final residual check: ensure no active PII patterns match the output
  let residual = 0;
  for (const { regex } of PII_PATTERNS) {
    const remaining = sanitized.replace(/\[REDACTED\]/g, '').match(regex);
    if (remaining) {
      residual += remaining.length;
    }
  }

  return { sanitized, modelCount, serverCount, residual };
}

/**
 * Sanitizes an array of policy change objects or strings.
 *
 * @param {Array<Object|string>} items
 * @returns {{ items: Array<Object|string>, meta: { modelRedactions: number, serverRedactions: number, residualAfterScan: number, clean: boolean } }}
 */
function redactPolicyChanges(items) {
  let totalModel = 0;
  let totalServer = 0;
  let totalResidual = 0;

  const sanitizedItems = items.map((item) => {
    if (typeof item === 'string') {
      const res = scanAndSanitizeText(item);
      totalModel += res.modelCount;
      totalServer += res.serverCount;
      totalResidual += res.residual;
      return res.sanitized;
    }

    if (item && typeof item === 'object') {
      const changeScan = scanAndSanitizeText(item.change || '');
      const clauseScan = scanAndSanitizeText(item.verbatimClause || '');

      totalModel += changeScan.modelCount + clauseScan.modelCount;
      totalServer += changeScan.serverCount + clauseScan.serverCount;
      totalResidual += changeScan.residual + clauseScan.residual;

      return {
        ...item,
        change: changeScan.sanitized,
        verbatimClause: clauseScan.sanitized,
      };
    }

    return item;
  });

  return {
    items: sanitizedItems,
    meta: {
      modelRedactions: totalModel,
      serverRedactions: totalServer,
      residualAfterScan: totalResidual,
      clean: totalResidual === 0,
    },
  };
}

module.exports = {
  scanAndSanitizeText,
  redactPolicyChanges,
};
