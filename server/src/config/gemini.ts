import { GoogleGenerativeAI } from '@google/generative-ai';

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const GEMINI_MODEL = 'gemini-2.5-pro';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

/**
 * Retries a Gemini API call with exponential backoff on transient errors (503, 429).
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable = /503|429|service unavailable|overloaded|high demand|resource exhausted/i.test(message);
      if (!isRetryable || attempt === maxRetries) throw error;
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[Gemini] Retryable error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
