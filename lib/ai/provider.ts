import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';

/**
 * Provider layer.
 *
 * Two rules drive this file:
 *  1. Every model is reachable with a caller-supplied key (BYOK). The server key
 *     is only a fallback for the anonymous trial, so our own free quota is never
 *     the thing that caps the product.
 *  2. Callers ask for a *tier*, never a model id. Swapping models when a free
 *     tier changes is then a one-line edit here.
 */

export type ProviderId = 'google' | 'groq';

/**
 * `fast` runs the high-volume stages (questions, features, tasks, revisions).
 * `deep` runs the one stage where quality is worth the extra quota: the PRD.
 */
export type ModelTier = 'fast' | 'deep';

/**
 * Ordered fallback chain per tier. Free tiers return 503 "high demand" under
 * load often enough that a single model id is not a working configuration —
 * the first spike run died on exactly that. Retrying the same overloaded model
 * does not help; moving to a different one does.
 */
const MODELS: Record<ProviderId, Record<ModelTier, readonly string[]>> = {
  // Verified callable with `npx tsx scripts/list-models.ts`. Note that the
  // listing endpoint still advertises models that are closed to new keys, so
  // prefer recent ids and keep the `-latest` alias first.
  // Measured, not assumed: full Flash models allow only ~20 free requests a day
  // ("Quota exceeded ... limit: 20, model: gemini-3.8-flash"), while Flash-Lite
  // allows ~500. So the deep chain must end at Flash-Lite — falling back from
  // one 20/day model to another 20/day model fails for the same reason twice.
  // On a free key the PRD gets one attempt at the better model, then degrades.
  google: {
    fast: ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    deep: ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-flash-lite-latest'],
  },
  // Groq retired the whole Llama line; these three are what the key can reach.
  // Both tiers lead with 120b: the 20b model cannot hold the task schema (it
  // returns unparseable JSON), and Groq's quota is per-account here rather than
  // per-model, so the smaller model buys no extra headroom.
  groq: {
    fast: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
    deep: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
  },
};

export type Credentials = {
  provider: ProviderId;
  /** BYOK key. Falls back to the server key when omitted. */
  apiKey?: string;
};

function serverKey(provider: ProviderId): string | undefined {
  return provider === 'google'
    ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
    : process.env.GROQ_API_KEY;
}

export type ResolvedModel = { id: string; model: LanguageModel };

/** Every candidate for a tier, best first. Callers walk the list on failure. */
export function resolveChain(creds: Credentials, tier: ModelTier): ResolvedModel[] {
  const apiKey = creds.apiKey ?? serverKey(creds.provider);
  if (!apiKey) {
    throw new Error(
      `No API key for provider "${creds.provider}". Set ${
        creds.provider === 'google' ? 'GOOGLE_GENERATIVE_AI_API_KEY' : 'GROQ_API_KEY'
      } in .env.local, or pass a BYOK key.`,
    );
  }

  const factory =
    creds.provider === 'google'
      ? createGoogleGenerativeAI({ apiKey })
      : createGroq({ apiKey });

  return MODELS[creds.provider][tier].map((id) => ({
    id: `${creds.provider}:${id}`,
    model: factory(id),
  }));
}

/**
 * Whether moving to the next model in the chain could plausibly help.
 *
 * Two families qualify. Capacity and quota errors are temporary and another
 * model usually has headroom. Retirement errors are permanent but specific to
 * one id — Google withdraws models from new keys while still listing them, so
 * the chain must step past those too. A malformed schema or prompt fails
 * identically everywhere and must not be retried.
 */
export function isWorthRerouting(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const busy =
    /high demand|overload|unavailable|capacity|rate limit|quota|exhausted|timeout|503|429|500/i;
  const retired = /no longer available|not found|does not exist|not supported|deprecated/i;
  // A model too small to hold a schema returns unparseable JSON where a larger
  // one succeeds, so this is a model problem, not a prompt problem. Chains are
  // short, which bounds the cost when the schema really is at fault.
  const cannotHoldSchema = /failed to validate json|failed_generation|did not match schema/i;
  return busy.test(msg) || retired.test(msg) || cannotHoldSchema.test(msg);
}
