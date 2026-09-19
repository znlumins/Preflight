import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { nanoid } from 'nanoid';

/**
 * Anonymous sessions.
 *
 * No accounts in v1. A plan belongs to a cookie, which is enough to let someone
 * arrive, generate, come back tomorrow, and still find their work — without a
 * signup wall in front of the thing they came to try.
 */

const COOKIE = 'preflight_sid';
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Reads the session id, creating one if this is a first visit. */
export async function getSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;

  const id = nanoid(21);
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return id;
}

/** Reads the session id without creating one. Use in read-only paths. */
export async function peekSessionId(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

/**
 * A salted hash of the caller's IP, or null when there is none (local dev).
 *
 * The cookie alone is a weak identity for rate limiting: clearing it hands out
 * a fresh allowance. The IP is a second key that survives that. Only the hash
 * is stored — the address itself is personal data this app has no use for.
 *
 * On Vercel both headers are set by the platform and overwrite whatever the
 * client sent, so they cannot be spoofed from the browser.
 */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!ip) return null;
  const salt = process.env.ENCRYPTION_KEY ?? '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Who is asking, for rate limiting and metering: the cookie session and the IP. */
export type Caller = { sessionId: string; ipHash: string | null };

/** The caller of a request that spends quota, creating the session if needed. */
export async function getCaller(): Promise<Caller> {
  const [sessionId, ipHash] = await Promise.all([getSessionId(), clientIpHash()]);
  return { sessionId, ipHash };
}
