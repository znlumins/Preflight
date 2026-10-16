import { and, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { apiKeys } from './db/schema';
import { decrypt, encrypt, hintOf } from './crypto';
import type { Credentials, ProviderId } from './ai/provider';

/**
 * Bring-your-own-key.
 *
 * Users can save keys for multiple providers (Google, Anthropic, OpenAI,
 * OpenRouter, Groq). Each provider has its own entry per session.
 */

export type SavedKey = { provider: ProviderId; hint: string; savedAt: string };
export type KeyStatusMap = Partial<Record<ProviderId, SavedKey>>;

/** Safe to send to the browser: maps provider -> { hint, savedAt } */
export async function keyStatus(sessionId: string): Promise<KeyStatusMap> {
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.sessionId, sessionId));
  const map: KeyStatusMap = {};
  for (const row of rows) {
    map[row.provider as ProviderId] = {
      provider: row.provider as ProviderId,
      hint: row.hint,
      savedAt: row.createdAt.toISOString(),
    };
  }
  return map;
}

export async function saveKey(sessionId: string, provider: ProviderId, apiKey: string) {
  const trimmed = apiKey.trim();
  await db
    .insert(apiKeys)
    .values({
      sessionId,
      provider,
      ciphertext: encrypt(trimmed),
      hint: hintOf(trimmed),
    })
    .onConflictDoUpdate({
      target: [apiKeys.sessionId, apiKeys.provider],
      set: {
        ciphertext: encrypt(trimmed),
        hint: hintOf(trimmed),
        createdAt: new Date(),
        lastUsedAt: null,
      },
    });
}

export async function deleteKey(sessionId: string, provider?: ProviderId) {
  if (provider) {
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.sessionId, sessionId), eq(apiKeys.provider, provider)));
  } else {
    await db.delete(apiKeys).where(eq(apiKeys.sessionId, sessionId));
  }
}

/**
 * The credentials a request should run on:
 * If requestedProvider is specified, checks that provider's saved key.
 * Otherwise falls back to any saved key or the shared pool.
 */
export async function credentialsFor(
  sessionId: string,
  requestedProvider?: ProviderId,
  requestedModel?: string,
): Promise<{ creds: Credentials; byok: boolean }> {
  if (requestedProvider) {
    const [row] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.sessionId, sessionId), eq(apiKeys.provider, requestedProvider)))
      .limit(1);

    if (row) {
      try {
        const apiKey = decrypt(row.ciphertext);
        void db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(and(eq(apiKeys.sessionId, sessionId), eq(apiKeys.provider, requestedProvider)))
          .catch(() => {});
        return {
          creds: { provider: requestedProvider, apiKey, model: requestedModel },
          byok: true,
        };
      } catch {
        // Stale key, fall back to pool
      }
    }

    return {
      creds: { provider: requestedProvider, model: requestedModel },
      byok: false,
    };
  }

  // No specific provider requested: check if any key exists
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.sessionId, sessionId))
    .orderBy(desc(apiKeys.lastUsedAt), desc(apiKeys.createdAt))
    .limit(1);

  if (!row) {
    return { creds: { provider: 'google', model: requestedModel }, byok: false };
  }

  try {
    const apiKey = decrypt(row.ciphertext);
    return {
      creds: { provider: row.provider as ProviderId, apiKey, model: requestedModel },
      byok: true,
    };
  } catch {
    return { creds: { provider: 'google', model: requestedModel }, byok: false };
  }
}

/** Confirms a key works before it is saved, so failures surface at paste time. */
export async function verifyKey(provider: ProviderId, apiKey: string): Promise<string | null> {
  const key = apiKey.trim();
  if (!key) return 'API key kosong.';

  try {
    let res: Response;
    switch (provider) {
      case 'google':
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
        );
        break;
      case 'groq':
        res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
      case 'openai':
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
      case 'anthropic':
        res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
        });
        break;
      case 'openrouter':
        res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
    }

    if (res.ok) return null;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return 'API key ditolak provider. Pastikan kamu menyalinnya utuh.';
    }
    return `Provider membalas ${res.status}. Coba lagi sebentar lagi.`;
  } catch {
    return 'Tidak bisa menghubungi provider untuk mengecek key.';
  }
}
