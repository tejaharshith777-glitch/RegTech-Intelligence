'use strict';

/**
 * Minimal, dependency-free PDF text extractor.
 * ─────────────────────────────────────────────
 * Why this exists
 * ---------------
 * The AI is asked to copy a verbatim clause out of the PDF. Compliance cannot
 * take that on faith: a hallucinated clause is worse than no clause at all.
 * This module pulls the real text out of the PDF buffer so the controller can
 * check that the quoted sentence actually exists in the document.
 *
 * It handles the two common cases:
 *   1. Uncompressed content streams  -> read directly
 *   2. FlateDecode-compressed streams -> zlib.inflateSync (built into Node)
 *
 * It does NOT attempt OCR. If a PDF is a scanned image there is no text layer,
 * `usable` is false, and the caller must mark provenance as 'unverified'
 * rather than pretend it checked.
 */

const zlib = require('zlib');

/** Decode PDF string escapes: \( \) \\ \n \r \t \b \f \ddd octal. */
const unescapePdfString = (raw) => {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    switch (next) {
      case 'n': out += '\n'; i++; break;
      case 'r': out += '\r'; i++; break;
      case 't': out += '\t'; i++; break;
      case 'b': out += '\b'; i++; break;
      case 'f': out += '\f'; i++; break;
      case '(': out += '('; i++; break;
      case ')': out += ')'; i++; break;
      case '\\': out += '\\'; i++; break;
      case '\n': i++; break; // line continuation
      case '\r': i++; if (raw[i + 1] === '\n') i++; break;
      default: {
        // Octal escape, up to 3 digits
        const oct = /^[0-7]{1,3}/.exec(raw.slice(i + 1, i + 4));
        if (oct) {
          out += String.fromCharCode(parseInt(oct[0], 8));
          i += oct[0].length;
        } else {
          out += next;
          i++;
        }
      }
    }
  }
  return out;
};

/** Extract every string literal shown by Tj / TJ / ' / " operators. */
const extractShownText = (content) => {
  const pieces = [];
  let i = 0;

  while (i < content.length) {
    // Text-show operator: ( ... ) Tj
    if (content[i] === '(') {
      let depth = 1;
      let j = i + 1;
      let body = '';
      while (j < content.length && depth > 0) {
        const c = content[j];
        if (c === '\\') {
          body += c + (content[j + 1] ?? '');
          j += 2;
          continue;
        }
        if (c === '(') depth++;
        if (c === ')') {
          depth--;
          if (depth === 0) break;
        }
        body += c;
        j++;
      }
      const after = content.slice(j + 1, j + 12);
      // Only keep it if it is actually displayed by a text operator.
      if (/^\s*(Tj|TJ|'|")/.test(after)) {
        pieces.push(unescapePdfString(body));
      }
      i = j + 1;
      continue;
    }
    i++;
  }

  return pieces.join('');
};

/** Decode one stream object's bytes, inflating when /FlateDecode is declared. */
const decodeStream = (dict, bytes) => {
  const isFlate = /\/FlateDecode/.test(dict);
  if (!isFlate) return bytes.toString('latin1');
  try {
    return zlib.inflateSync(bytes).toString('latin1');
  } catch {
    try {
      // Some producers emit raw deflate without the zlib header.
      return zlib.inflateRawSync(bytes).toString('latin1');
    } catch {
      return '';
    }
  }
};

/**
 * Parse the PDF into per-page text plus a flat document text.
 *
 * @param {Buffer} buffer
 * @returns {{ pages: string[], text: string, pageCount: number, usable: boolean }}
 */
function extractPdfText(buffer) {
  const empty = { pages: [], text: '', pageCount: 0, usable: false };
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return empty;

  const raw = buffer.toString('latin1');

  // 1. Index every indirect object: number -> { dict, stream }
  const objects = new Map();
  const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = objRe.exec(raw)) !== null) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const end = raw.indexOf('endobj', start);
    if (end === -1) continue;
    const body = raw.slice(start, end);

    const streamIdx = body.indexOf('stream');
    let dict = body;
    let streamText = '';
    if (streamIdx !== -1) {
      dict = body.slice(0, streamIdx);
      let dataStart = streamIdx + 'stream'.length;
      if (body[dataStart] === '\r') dataStart++;
      if (body[dataStart] === '\n') dataStart++;

      const dataEnd = body.lastIndexOf('endstream');
      const slice = body.slice(dataStart, dataEnd === -1 ? undefined : dataEnd);
      const bytes = Buffer.from(slice, 'latin1');
      streamText = decodeStream(dict, bytes);
    }
    objects.set(num, { dict, streamText });
  }

  // 2. Collect page objects in document order
  const pageNums = [];
  for (const [num, obj] of objects) {
    if (/\/Type\s*\/Page\b(?!s)/.test(obj.dict)) pageNums.push(num);
  }
  pageNums.sort((a, b) => a - b);

  const pages = [];
  for (const num of pageNums) {
    const page = objects.get(num);
    // /Contents may be a single ref or an array of refs
    const refs = [...page.dict.matchAll(/(\d+)\s+\d+\s+R/g)]
      .map((r) => Number(r[1]))
      .filter((n) => objects.has(n) && objects.get(n).streamText);

    const contentsRef = /\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/.exec(page.dict);
    let chosen = refs;
    if (contentsRef) {
      const wanted = [...contentsRef[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => Number(r[1]));
      const fromContents = wanted.filter((n) => objects.has(n));
      if (fromContents.length) chosen = fromContents;
    }

    const pageText = chosen.map((n) => extractShownText(objects.get(n).streamText)).join(' ');
    pages.push(pageText);
  }

  // 3. Fall back to "concatenate every content stream" when the page tree could
  //    not be resolved (broken xref, unusual producer, etc.)
  let text = pages.join('\n');
  if (!text.trim()) {
    text = [...objects.values()].map((o) => extractShownText(o.streamText)).join('\n');
  }

  const thePages = pages.some((p) => p.trim()) ? pages : [text];

  return {
    pages: thePages,
    text,
    pageCount: pageNums.length || thePages.length,
    usable: text.trim().length > 0,
  };
}

/** Collapse all whitespace so line breaks in the PDF do not cause false negatives. */
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Whitespace-free comparison, for clauses split across text-show operators. */
const stripAll = (s) => String(s || '').replace(/\s+/g, '');

/**
 * Is `clause` genuinely present in the document text?
 *
 * @param {string} clause
 * @param {{ text: string, usable: boolean }} extracted
 * @returns {{ verified: boolean, confidence: 'exact'|'loose'|'none' }}
 */
function verifyClause(clause, extracted) {
  if (!clause || !extracted?.usable) return { verified: false, confidence: 'none' };

  const haystack = squash(extracted.text);
  const needle = squash(clause);

  if (needle.length >= 12 && haystack.includes(needle)) {
    return { verified: true, confidence: 'exact' };
  }

  // Loose match: ignore every space, to survive line-wrapped clauses.
  const flatHay = stripAll(extracted.text);
  const flatNeedle = stripAll(clause);
  if (flatNeedle.length >= 12 && flatHay.includes(flatNeedle)) {
    return { verified: true, confidence: 'loose' };
  }

  return { verified: false, confidence: 'none' };
}

module.exports = { extractPdfText, verifyClause, squash, stripAll };
