import { eq } from 'drizzle-orm';
import { db } from './db';
import { apiKeys } from './db/schema';
import { decrypt, encrypt, hintOf } from './crypto';
import type { Credentials, ProviderId } from './ai/provider';

/**
 * Bring-your-own-key.
 *
 * The shared pool key is a trial, not the product: one free Google key covers
 * roughly 71 plans a day for everyone combined. A user's own key moves that
 * ceiling onto their own quota, which is the only version of "free" that
 * survives more than a handful of users.
 */

export type KeyStatus = { provider: ProviderId; hint: string; savedAt: string } | null;

/** Safe to send to the browser: provider and four characters, never the key. */
export async function keyStatus(sessionId: string): Promise<KeyStatus> {
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.sessionId, sessionId)).limit(1);
  if (!row) return null;
  return { provider: row.provider, hint: row.hint, savedAt: row.createdAt.toISOString() };
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
      target: apiKeys.sessionId,
      set: {
        provider,
        ciphertext: encrypt(trimmed),
        hint: hintOf(trimmed),
        createdAt: new Date(),
        lastUsedAt: null,
      },
    });
}

export async function deleteKey(sessionId: string) {
  await db.delete(apiKeys).where(eq(apiKeys.sessionId, sessionId));
}

/**
 * The credentials a request should run on: the user's key when they have saved
 * one, the shared pool otherwise.
 *
 * `byok` also decides model tiering. A pool request is single-tier because the
 * full Flash models allow only ~20 free requests a day; someone spending their
 * own quota gets the better model for the PRD.
 */
export async function credentialsFor(
  sessionId: string,
): Promise<{ creds: Credentials; byok: boolean }> {
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.sessionId, sessionId)).limit(1);
  if (!row) return { creds: { provider: 'google' }, byok: false };

  // Best-effort: a stale row (key rotated, ENCRYPTION_KEY changed) must not
  // take the whole request down, so fall back to the pool.
  try {
    const apiKey = decrypt(row.ciphertext);
    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.sessionId, sessionId))
      .catch(() => {});
    return { creds: { provider: row.provider, apiKey }, byok: true };
  } catch {
    return { creds: { provider: 'google' }, byok: false };
  }
}

/** Confirms a key works before it is saved, so failures surface at paste time. */
export async function verifyKey(provider: ProviderId, apiKey: string): Promise<string | null> {
  const key = apiKey.trim();
  if (!key) return 'API key kosong.';

  try {
    const res =
      provider === 'google'
        ? await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
          )
        : await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });

    if (res.ok) return null;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return 'API key ditolak provider. Pastikan kamu menyalinnya utuh.';
    }
    return `Provider membalas ${res.status}. Coba lagi sebentar lagi.`;
  } catch {
    return 'Tidak bisa menghubungi provider untuk mengecek key.';
  }
}
