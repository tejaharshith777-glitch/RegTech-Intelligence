'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

let geminiClientInstance = null;

/**
 * Returns a singleton instance of the Google Generative AI client.
 * Throws if GEMINI_API_KEY is missing.
 */
const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  if (!geminiClientInstance) {
    geminiClientInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('[gemini] ✅ Google Generative AI client initialized.');
  }

  return geminiClientInstance;
};

/**
 * Ask Google which models this API key can actually use.
 *
 * Model names get retired (gemini-2.5-pro was recently closed to new keys), so
 * hardcoding a list guarantees a time bomb. This queries ListModels and caches
 * the answer in memory for 10 minutes.
 *
 * @returns {Promise<string[]>} model names that support generateContent
 */
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
let modelCache = { at: 0, names: [] };

const listAvailableModels = async ({ force = false } = {}) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  if (!force && modelCache.names.length && Date.now() - modelCache.at < MODEL_CACHE_TTL_MS) {
    return modelCache.names;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
    if (!res.ok) {
      console.warn(`[gemini] ListModels returned ${res.status}`);
      return modelCache.names;
    }

    const body = await res.json();
    const names = (body.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      // Skip the specialist families: they cannot do structured JSON extraction.
      .filter((n) => !/embedding|aqa|imagen|veo|tts|native-audio|image-generation|learnlm/i.test(n))
      .filter(Boolean);

    if (names.length) {
      modelCache = { at: Date.now(), names };
      console.log(`[gemini] ListModels: ${names.length} usable models (e.g. ${names.slice(0, 3).join(', ')})`);
    }
    return names;
  } catch (err) {
    console.warn(`[gemini] ListModels failed: ${err.message}`);
    return modelCache.names;
  }
};

/**
 * Call generateContent directly over REST, bypassing the SDK.
 *
 * The @google/generative-ai package is legacy. If Google retires a model name
 * or changes a transport detail, the SDK can fail for every model even when
 * the key and the model are perfectly fine. This path talks to the documented
 * v1beta endpoint with the same payload, so the upload keeps working.
 */
const generateWithRest = async ({ model, prompt, pdfBase64, mimeType = 'application/pdf' }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not defined in environment variables.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: pdfBase64 } }],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(`[REST ${res.status}] ${msg}`);
    err.status = res.status;
    throw err;
  }

  const text = (json?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('');

  if (!text) throw new Error('Gemini REST returned an empty candidate.');
  return { text };
};

module.exports = { getGeminiClient, listAvailableModels, generateWithRest };
