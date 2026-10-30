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

module.exports = { getGeminiClient };
