import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

/**
 * Provider layer.
 *
 * Universal multi-provider engine supporting Google AI Studio, Groq,
 * OpenAI, Anthropic Claude, and OpenRouter.
 *
 * Two rules drive this file:
 *  1. Every model is reachable with a caller-supplied key (BYOK). The server key
 *     is only a fallback for the anonymous trial, so our own free quota is never
 *     the thing that caps the product.
 *  2. Callers ask for a *tier*, never a model id. Swapping models when a free
 *     tier changes is then a one-line edit here.
 */

export type ProviderId = 'google' | 'groq' | 'openai' | 'anthropic' | 'openrouter';

/**
 * `fast` runs the high-volume stages (questions, features, tasks, revisions).
 * `deep` runs the one stage where quality is worth the extra quota: the PRD.
 */
export type ModelTier = 'fast' | 'deep';

/**
 * Ordered fallback chain per tier. Free tiers return 503 "high demand" under
 * load often enough that a single model id is not a working configuration.
 * Retrying the same overloaded model does not help; moving to a different one does.
 */
const MODELS: Record<ProviderId, Record<ModelTier, readonly string[]>> = {
  // Google AI Studio
  google: {
    fast: ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    deep: ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-flash-lite-latest'],
  },
  // Groq high-speed inference
  groq: {
    fast: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
    deep: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
  },
  // OpenAI flagship models
  openai: {
    fast: ['gpt-4o-mini', 'gpt-4o'],
    deep: ['gpt-4o', 'o3-mini', 'gpt-4o-mini'],
  },
  // Anthropic Claude
  anthropic: {
    fast: ['claude-3-5-haiku-latest', 'claude-3-5-haiku-20241022'],
    deep: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  // OpenRouter (Universal gateway to 100+ models)
  openrouter: {
    fast: ['deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.5-flash'],
    deep: ['anthropic/claude-3.7-sonnet', 'openai/gpt-4o', 'deepseek/deepseek-r1'],
  },
};

export type Credentials = {
  provider: ProviderId;
  /** BYOK key. Falls back to the server key when omitted. */
  apiKey?: string;
  /** Custom model override. When set, overrides the tier's default chain. */
  model?: string;
};

export function serverKey(provider: ProviderId): string | undefined {
  switch (provider) {
    case 'google':
      return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY;
  }
}

export type ResolvedModel = { id: string; model: LanguageModel };

/** Every candidate for a tier, best first. Callers walk the list on failure. */
export function resolveChain(creds: Credentials, tier: ModelTier): ResolvedModel[] {
  const apiKey = creds.apiKey ?? serverKey(creds.provider);
  if (!apiKey) {
    const envMap: Record<ProviderId, string> = {
      google: 'GOOGLE_GENERATIVE_AI_API_KEY',
      groq: 'GROQ_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
    };
    throw new Error(
      `No API key for provider "${creds.provider}". Set ${envMap[creds.provider]} in .env.local, or pass a BYOK key.`,
    );
  }

  let factory: (modelId: string) => LanguageModel;
  switch (creds.provider) {
    case 'google':
      factory = createGoogleGenerativeAI({ apiKey });
      break;
    case 'groq':
      factory = createGroq({ apiKey });
      break;
    case 'openai':
      factory = createOpenAI({ apiKey });
      break;
    case 'anthropic':
      factory = createAnthropic({ apiKey });
      break;
    case 'openrouter':
      factory = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      });
      break;
  }

  // Caller specifically asked for a custom model id
  if (creds.model) {
    return [
      {
        id: `${creds.provider}:${creds.model}`,
        model: factory(creds.model),
      },
    ];
  }

  return MODELS[creds.provider][tier].map((id) => ({
    id: `${creds.provider}:${id}`,
    model: factory(id),
  }));
}

export type DetectedModel = {
  id: string;
  name?: string;
  contextWindow?: number;
};

/**
 * Auto-detects models actually callable with the given API key.
 */
export async function listProviderModels(
  provider: ProviderId,
  apiKey?: string,
): Promise<DetectedModel[]> {
  const key = apiKey ?? serverKey(provider);
  if (!key) return [];

  try {
    switch (provider) {
      case 'google': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`,
        );
        if (!res.ok) return [];
        const { models } = (await res.json()) as {
          models: { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }[];
        };
        return (models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName,
            contextWindow: m.inputTokenLimit,
          }))
          .filter((m) => /^gemini-(\d|flash|pro)/.test(m.id));
      }
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return [];
        const { data } = (await res.json()) as { data: { id: string; context_window?: number; active?: boolean }[] };
        return (data ?? [])
          .filter((m) => m.active !== false && !/whisper|guard/i.test(m.id))
          .map((m) => ({ id: m.id, contextWindow: m.context_window }));
      }
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return [];
        const { data } = (await res.json()) as { data: { id: string }[] };
        return (data ?? [])
          .filter((m) => /^(gpt-4|gpt-3\.5|o1|o3)/i.test(m.id) && !/realtime|audio|transcribe/i.test(m.id))
          .map((m) => ({ id: m.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
      }
      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return [];
        const { data } = (await res.json()) as {
          data: { id: string; name?: string; context_length?: number }[];
        };
        return (data ?? [])
          .slice(0, 100)
          .map((m) => ({ id: m.id, name: m.name, contextWindow: m.context_length }));
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
        });
        if (!res.ok) {
          // Anthropic /v1/models endpoint might require specific permissions; fallback to known working set
          return [
            { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet (Latest)' },
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (Latest)' },
            { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Latest)' },
          ];
        }
        const { data } = (await res.json()) as { data: { id: string; display_name?: string }[] };
        return (data ?? []).map((m) => ({ id: m.id, name: m.display_name }));
      }
    }
  } catch {
    return [];
  }
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
